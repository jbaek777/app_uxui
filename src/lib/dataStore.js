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
  MEAT:    '@meatbig_meat_inventory',
  STAFF:   '@meatbig_staff',
  YIELD:   '@meatbig_yield_history',
  SALES:   '@meatbig_sales_history',
};

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
    // 1) Supabase
    try {
      const { data, error } = await supabase
        .from('meat_inventory')
        .select('*')
        .order('created_at', { ascending: true });
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
        const rows = items.map(m => ({
          cut: m.cut, origin: m.origin, qty: m.qty, unit: m.unit || 'kg',
          buy_price: m.buyPrice, sell_price: m.sellPrice,
          expire: m.expire, dday: m.dday, status: m.status,
          sold: m.sold, sold_date: m.soldDate,
          edit_count: m.editCount || 0, edit_log: m.editLog || [],
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
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
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
        const rows = items.map(s => ({
          name: s.name, role: s.role, pin: s.pin, hire: s.hire,
          health: s.health, edu: s.edu, status: s.status, color: s.color,
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
      const { data, error } = await supabase
        .from('yield_history')
        .select('*')
        .order('created_at', { ascending: false });
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
      await supabase.from('yield_history').insert({
        label: entry.label, calc_date: entry.date,
        init_weight: entry.initWeight, final_weight: entry.finalWeight,
        yield_pct: entry.yieldPct, loss_kg: entry.lossKg,
        real_cost: entry.realCost, recommend: entry.recommend,
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
      await supabase.from('sales_history').insert({
        cut: item.cut, origin: item.origin, qty: item.qty,
        buy_price: item.buyPrice, sell_price: item.sellPrice,
        total: item.qty * item.sellPrice,
        sold_date: new Date().toLocaleDateString('ko-KR'),
      });
    } catch {}
  },
};

// ─── 소비기한 수정 로그 ─────────────────────────────────

export const expiryLogStore = {
  log: async (meatId, cut, oldExpire, newExpire, editCount) => {
    try {
      await supabase.from('expiry_edit_logs').insert({
        meat_id: meatId, cut, old_expire: oldExpire,
        new_expire: newExpire, edit_count: editCount,
      });
    } catch {}
  },
};
