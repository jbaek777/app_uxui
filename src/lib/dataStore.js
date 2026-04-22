/**
 * dataStore.js — AsyncStorage 영구 저장 + Supabase 백그라운드 동기화
 *
 * 패턴:
 *   로드: Supabase 먼저 → 실패 시 AsyncStorage → 실패 시 mockData
 *   저장: AsyncStorage 즉시 + Supabase 백그라운드
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEYS = {
  MEAT:      '@meatbig_meat_inventory',
  STAFF:     '@meatbig_staff',
  YIELD:     '@meatbig_yield_history',
  SALES:     '@meatbig_sales_history',
  SUPPLIERS: '@meatbig_suppliers',
};

// ─── 매장 정보 헬퍼 ─────────────────────────────────────
// store_id (UUID) 는 온보딩 시 stores.id 를 AsyncStorage 에 캐시한 값.
// RLS 정책이 child 테이블의 store_id UUID 기반이므로 반드시 UUID 필요.
// 미설정 시(미온보딩 상태) insert 시도는 RLS 에 의해 거부됨 — 의도된 동작.

export async function getStoreUuid() {
  try {
    // 1) 캐시된 UUID 우선
    const cached = await AsyncStorage.getItem('@meatbig_store_uuid');
    if (cached) return cached;

    // 2) 캐시 없으면 Supabase 에서 조회 (내가 사장인 store 또는 소속된 store)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 내가 사장
    let { data: ownerStore } = await supabase
      .from('stores')
      .select('id')
      .eq('auth_uid', user.id)
      .limit(1)
      .maybeSingle();

    let uuid = ownerStore?.id || null;

    // 내가 직원
    if (!uuid) {
      const { data: mem } = await supabase
        .from('store_members')
        .select('store_id')
        .eq('auth_uid', user.id)
        .limit(1)
        .maybeSingle();
      uuid = mem?.store_id || null;
    }

    if (uuid) await AsyncStorage.setItem('@meatbig_store_uuid', uuid);
    return uuid;
  } catch {
    return null;
  }
}

export async function getStoreInfo() {
  try {
    const raw = await AsyncStorage.getItem('@meatbig_biz');
    const data = raw ? JSON.parse(raw) : {};
    const store_id = await getStoreUuid();    // UUID (RLS 필수)
    return {
      store_id,                                // UUID — 없으면 insert 거부됨
      store_name:  data.bizName || '',
      biz_type:    data.bizType || '개인사업자',
      region_si:   data.addrSi || '',
      region_gu:   data.addrGu || '',
      region_dong: data.addrDong || '',
    };
  } catch { return {}; }
}

// ─── 타임아웃 헬퍼 ──────────────────────────────────────
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

// ─── 범용 헬퍼 ──────────────────────────────────────────

async function loadLocal(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveLocal(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[dataStore] saveLocal error:', e);
  }
}

// ─── 고기 재고 ──────────────────────────────────────────

export const meatStore = {
  load: async (fallback) => {
    // 1) Supabase (5초 타임아웃)
    try {
      const { data, error } = await withTimeout(
        supabase.from('meat_inventory').select('*').order('created_at', { ascending: true })
      );
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => ({
          id: r.id, cut: r.cut, origin: r.origin,
          qty: Number(r.qty), unit: r.unit || 'kg',
          buyPrice: r.buy_price, sellPrice: r.sell_price,
          expire: r.expire, dday: r.dday, status: r.status,
          sold: r.sold, soldDate: r.sold_date,
          editCount: r.edit_count || 0, editLog: r.edit_log || [],
        }));
        await saveLocal(KEYS.MEAT, mapped);
        return mapped;
      }
    } catch {}
    // 2) AsyncStorage
    const local = await loadLocal(KEYS.MEAT);
    if (local && local.length > 0) return local;
    // 3) fallback (mockData)
    return fallback;
  },

  save: async (items) => {
    await saveLocal(KEYS.MEAT, items);
    // Supabase 동기화 (백그라운드)
    try {
      // 전체 교체 방식 (베타용 — 추후 diff 방식으로 개선)
      await supabase.from('meat_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (items.length > 0) {
        const info = await getStoreInfo();
        const rows = items.map(m => ({
          cut: m.cut, origin: m.origin, qty: m.qty, unit: m.unit || 'kg',
          buy_price: m.buyPrice, sell_price: m.sellPrice,
          expire: m.expire, dday: m.dday, status: m.status,
          sold: m.sold, sold_date: m.soldDate,
          edit_count: m.editCount || 0, edit_log: m.editLog || [],
          ...info,
        }));
        await supabase.from('meat_inventory').insert(rows);
      }
    } catch (e) {
      console.warn('[meatStore] supabase sync error:', e);
    }
  },
};

// ─── 직원 ───────────────────────────────────────────────

export const staffStore = {
  load: async (fallback) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('employees').select('*').order('name')
      );
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => ({
          id: r.id, name: r.name, role: r.role,
          pin: r.pin, hire: r.hire,
          health: r.health, edu: r.edu,
          status: r.status, color: r.color,
        }));
        await saveLocal(KEYS.STAFF, mapped);
        return mapped;
      }
    } catch {}
    const local = await loadLocal(KEYS.STAFF);
    if (local && local.length > 0) return local;
    return fallback;
  },

  save: async (items) => {
    await saveLocal(KEYS.STAFF, items);
    try {
      await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (items.length > 0) {
        const info = await getStoreInfo();
        const rows = items.map(s => ({
          name: s.name, role: s.role, pin: s.pin, hire: s.hire,
          health: s.health, edu: s.edu, status: s.status, color: s.color,
          ...info,
        }));
        await supabase.from('employees').insert(rows);
      }
    } catch (e) {
      console.warn('[staffStore] supabase sync error:', e);
    }
  },
};

// ─── 수율 히스토리 ──────────────────────────────────────

export const yieldStore = {
  load: async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('yield_history').select('*').order('created_at', { ascending: false })
      );
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => ({
          id: r.id, label: r.label,
          date: r.calc_date,
          initWeight: Number(r.init_weight),
          finalWeight: Number(r.final_weight),
          yieldPct: r.yield_pct, lossKg: r.loss_kg,
          realCost: r.real_cost, recommend: r.recommend,
        }));
        await saveLocal(KEYS.YIELD, mapped);
        return mapped;
      }
    } catch {}
    return (await loadLocal(KEYS.YIELD)) || [];
  },

  add: async (entry) => {
    // AsyncStorage
    const prev = (await loadLocal(KEYS.YIELD)) || [];
    const updated = [entry, ...prev];
    await saveLocal(KEYS.YIELD, updated);
    // Supabase
    try {
      const info = await getStoreInfo();
      await supabase.from('yield_history').insert({
        label: entry.label, calc_date: entry.date,
        init_weight: entry.initWeight, final_weight: entry.finalWeight,
        yield_pct: entry.yieldPct, loss_kg: entry.lossKg,
        real_cost: entry.realCost, recommend: entry.recommend,
        ...info,
      });
    } catch {}
    return updated;
  },
};

// ─── 판매 이력 ──────────────────────────────────────────

export const salesStore = {
  addSale: async (item) => {
    // Supabase에 판매 기록 추가
    try {
      const info = await getStoreInfo();
      await supabase.from('sales_history').insert({
        cut: item.cut, origin: item.origin, qty: item.qty,
        buy_price: item.buyPrice, sell_price: item.sellPrice,
        total: item.qty * item.sellPrice,
        sold_date: new Date().toLocaleDateString('ko-KR'),
        ...info,
      });
    } catch {}
  },
};

// ─── 매장 등록 ──────────────────────────────────────────

export const storeStore = {
  register: async () => {
    try {
      const info = await getStoreInfo();
      if (!info.store_id || info.store_id === 'unknown') return;
      const { error } = await supabase
        .from('stores')
        .upsert({ ...info, registered_at: new Date().toISOString() }, { onConflict: 'store_id' });
      if (error) console.log('storeStore.register error:', error.message);
    } catch (e) { console.log('storeStore.register exception:', e.message); }
  },
};

// ─── 소비기한 수정 로그 ─────────────────────────────────

export const expiryLogStore = {
  log: async (meatId, cut, oldExpire, newExpire, editCount) => {
    try {
      const info = await getStoreInfo();
      await supabase.from('expiry_edit_logs').insert({
        meat_id: meatId, cut, old_expire: oldExpire,
        new_expire: newExpire, edit_count: editCount,
        ...info,
      });
    } catch {}
  },
};

// ─── 위생 점검 로그 ─────────────────────────────────────

export const hygieneStore = {
  load: async (fallback = []) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('hygiene_logs').select('*').order('created_at', { ascending: false }).limit(100)
      );
      if (!error && data && data.length > 0) return data;
    } catch {}
    try {
      const raw = await AsyncStorage.getItem('@meatbig_hygiene');
      if (raw) return JSON.parse(raw);
    } catch {}
    return fallback;
  },
  save: async (logs) => {
    try {
      await AsyncStorage.setItem('@meatbig_hygiene', JSON.stringify(logs));
    } catch {}
    try {
      const info = await getStoreInfo();
      const rows = logs.map(l => ({ ...l, ...info }));
      await supabase.from('hygiene_logs').delete().eq('store_id', info.store_id || '');
      if (rows.length > 0) await supabase.from('hygiene_logs').insert(rows);
    } catch (e) { console.log('hygieneStore.save error:', e.message); }
  },
  addLog: async (log) => {
    try {
      const info = await getStoreInfo();
      await supabase.from('hygiene_logs').insert({ ...log, ...info });
    } catch (e) { console.log('hygieneStore.addLog error:', e.message); }
  },
};

// ─── 거래처 ─────────────────────────────────────────────

export const supplierStore = {
  load: async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('suppliers').select('*').order('created_at', { ascending: true })
      );
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => ({ id: r.id, name: r.name, contact: r.contact, memo: r.memo }));
        await saveLocal(KEYS.SUPPLIERS, mapped);
        return mapped;
      }
    } catch {}
    return (await loadLocal(KEYS.SUPPLIERS)) || [];
  },
  save: async (items) => {
    await saveLocal(KEYS.SUPPLIERS, items);
    try {
      const info = await getStoreInfo();
      await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (items.length > 0) {
        const rows = items.map(s => ({ id: s.id, name: s.name, contact: s.contact, memo: s.memo, ...info }));
        await supabase.from('suppliers').insert(rows);
      }
    } catch (e) { console.warn('[supplierStore] supabase sync error:', e); }
  },
};

// ─── 온도 기록 ───────────────────────────────────────────

export const tempStore = {
  load: async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('temp_records').select('*').order('created_at', { ascending: false }).limit(100)
      );
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => ({
          id: r.id, date: r.date, time: r.time,
          temp: Number(r.temp), humidity: Number(r.humidity),
          person: r.person, note: r.note, status: r.status,
        }));
        await saveLocal('@meatbig_temp_records', mapped);
        return mapped;
      }
    } catch {}
    return (await loadLocal('@meatbig_temp_records')) || [];
  },
  add: async (record) => {
    const prev = (await loadLocal('@meatbig_temp_records')) || [];
    const updated = [record, ...prev];
    await saveLocal('@meatbig_temp_records', updated);
    try {
      const info = await getStoreInfo();
      await supabase.from('temp_records').insert({ ...record, ...info });
    } catch (e) { console.warn('[tempStore] supabase sync error:', e); }
    return updated;
  },
  delete: async (id) => {
    const prev = (await loadLocal('@meatbig_temp_records')) || [];
    const updated = prev.filter(r => r.id !== id);
    await saveLocal('@meatbig_temp_records', updated);
    try {
      await supabase.from('temp_records').delete().eq('id', id);
    } catch (e) { console.warn('[tempStore] supabase delete error:', e); }
    return updated;
  },
};

// ─── 교육일지 ────────────────────────────────────────────

export const educationStore = {
  load: async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('education_logs').select('*').order('created_at', { ascending: false })
      );
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => ({
          id: r.id, date: r.date, attendees: r.attendees,
          topics: r.topics || [], notes: r.notes,
        }));
        await saveLocal('@meatbig_education_logs', mapped);
        return mapped;
      }
    } catch {}
    return (await loadLocal('@meatbig_education_logs')) || [];
  },
  add: async (log) => {
    const prev = (await loadLocal('@meatbig_education_logs')) || [];
    const updated = [log, ...prev];
    await saveLocal('@meatbig_education_logs', updated);
    try {
      const info = await getStoreInfo();
      await supabase.from('education_logs').insert({ ...log, topics: log.topics, ...info });
    } catch (e) { console.warn('[educationStore] supabase sync error:', e); }
    return updated;
  },
  delete: async (id) => {
    const prev = (await loadLocal('@meatbig_education_logs')) || [];
    const updated = prev.filter(l => l.id !== id);
    await saveLocal('@meatbig_education_logs', updated);
    try {
      await supabase.from('education_logs').delete().eq('id', id);
    } catch (e) { console.warn('[educationStore] supabase delete error:', e); }
    return updated;
  },
};

// ─── 일일 마감 리포트 ────────────────────────────────────

export const closingStore = {
  save: async (report) => {
    try {
      const info = await getStoreInfo();
      await supabase.from('closing_reports').insert({
        ...report,
        ...info,
        report_date: new Date().toLocaleDateString('ko-KR'),
        created_at: new Date().toISOString(),
      });
    } catch (e) { console.log('closingStore.save error:', e.message); }
  },
};
