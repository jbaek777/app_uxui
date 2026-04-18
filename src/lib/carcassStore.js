/**
 * carcassStore.js — 계근 입고(원두 분할) 저장소
 *
 * - carcass_sessions:    한 마리 단위 헤더 + 3단 무게 + 집계
 * - carcass_parts:       부위별 계근
 * - carcass_part_presets: 매장별 부위 프리셋 (커스텀 부위 포함)
 *
 * 저장 패턴: AsyncStorage 즉시 + Supabase 백그라운드 (기존 dataStore 패턴 동일)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getStoreInfo } from './dataStore';

const K_SESSIONS    = '@meatbig_carcass_sessions';
const K_PRESET      = '@meatbig_carcass_preset';   // 단일 기본 프리셋 (다중 품종 저장 시 'species'로 분기)
const K_YIELD_STATS = '@meatbig_carcass_yield_stats';

function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function loadLocal(key) {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
async function saveLocal(key, data) {
  try { await AsyncStorage.setItem(key, JSON.stringify(data)); }
  catch (e) { console.warn('[carcassStore] saveLocal', e); }
}

// ─────────────────────────────────────────────────────
// 세션 저장 (부위 포함) → Supabase insert + 로컬 누적
// ─────────────────────────────────────────────────────
export const carcassStore = {
  saveSession: async (session, parts) => {
    const info = await getStoreInfo();
    const now  = new Date().toISOString();

    const localEntry = {
      id: session.localId || `local-${Date.now()}`,
      ...session,
      ...info,
      parts,
      created_at: now,
    };

    // 1) AsyncStorage 누적 (최근 100건)
    try {
      const arr = (await loadLocal(K_SESSIONS)) || [];
      arr.unshift(localEntry);
      await saveLocal(K_SESSIONS, arr.slice(0, 100));
    } catch {}

    // 2) Supabase
    try {
      const { data: sess, error: sessErr } = await withTimeout(
        supabase.from('carcass_sessions').insert({ ...session, ...info }).select().single()
      );
      if (sessErr || !sess) {
        console.warn('[carcassStore] session insert failed', sessErr);
        return { ok: false, error: sessErr, localEntry };
      }
      if (parts && parts.length > 0) {
        const rows = parts.map(p => ({ ...p, session_id: sess.id, store_id: info.store_id }));
        const { error: partsErr } = await withTimeout(
          supabase.from('carcass_parts').insert(rows)
        );
        if (partsErr) console.warn('[carcassStore] parts insert failed', partsErr);
      }
      return { ok: true, session: sess };
    } catch (e) {
      console.warn('[carcassStore] saveSession error', e);
      return { ok: false, error: e, localEntry };
    }
  },

  // 세션 삭제 (Supabase + 로컬 동시)
  // carcass_parts 는 ON DELETE CASCADE 로 자동 삭제됨.
  deleteSession: async (id) => {
    if (!id) return { ok: false, error: new Error('id required') };

    // 1) 로컬 즉시 제거 (UI 반응성)
    try {
      const arr = (await loadLocal(K_SESSIONS)) || [];
      const next = arr.filter(s => s.id !== id && s.localId !== id);
      await saveLocal(K_SESSIONS, next);
    } catch {}

    // 2) Supabase 삭제
    try {
      // local-만 있는 세션이면 서버엔 없으므로 스킵
      if (typeof id === 'string' && id.startsWith('local-')) {
        return { ok: true, localOnly: true };
      }
      const { error } = await withTimeout(
        supabase.from('carcass_sessions').delete().eq('id', id)
      );
      if (error) {
        console.warn('[carcassStore.deleteSession]', error);
        return { ok: false, error };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[carcassStore.deleteSession] error', e);
      return { ok: false, error: e };
    }
  },

  // 이력 (최근 N건)
  loadHistory: async (limit = 50) => {
    try {
      const { data } = await withTimeout(
        supabase.from('carcass_sessions')
          .select('*, carcass_parts(*)')
          .order('created_at', { ascending: false })
          .limit(limit)
      );
      if (data && data.length > 0) return data;
    } catch {}
    return (await loadLocal(K_SESSIONS)) || [];
  },

  // ─── 매장 프리셋 (커스텀 부위 저장) ──────────────────
  loadPreset: async (species = '한우') => {
    // 로컬 먼저 (빠른 진입)
    const local = await loadLocal(`${K_PRESET}:${species}`);
    if (local) return local;

    try {
      const info = await getStoreInfo();
      if (!info.store_id) return null;
      const { data } = await withTimeout(
        supabase.from('carcass_part_presets')
          .select('*')
          .eq('store_id', info.store_id)
          .eq('species', species)
          .maybeSingle()
      );
      if (data) {
        await saveLocal(`${K_PRESET}:${species}`, data);
        return data;
      }
    } catch {}
    return null;
  },

  savePreset: async (species, preset) => {
    await saveLocal(`${K_PRESET}:${species}`, preset);
    try {
      const info = await getStoreInfo();
      if (!info.store_id) return;
      await withTimeout(
        supabase.from('carcass_part_presets')
          .upsert(
            {
              ...preset,
              species,
              ...info,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'store_id,species' }
          )
      );
    } catch (e) {
      console.warn('[carcassStore.savePreset]', e);
    }
  },

  // ─── 부위별 평균 수율 조회 (carcass_yield_stats 뷰) ───
  // 같은 매장 · 같은 품종의 과거 세션을 집계한 평균 ratio를 반환.
  // 반환: { "등심": { avg_ratio, sample_count, avg_price_kg, stddev_ratio }, ... }
  loadYieldStats: async (species = '한우') => {
    const cacheKey = `${K_YIELD_STATS}:${species}`;

    // 로컬 캐시 먼저 반환 (즉시 반응성)
    const cached = await loadLocal(cacheKey);

    try {
      const info = await getStoreInfo();
      if (!info.store_id) return cached || {};

      const { data, error } = await withTimeout(
        supabase.from('carcass_yield_stats')
          .select('part_name, avg_ratio, sample_count, avg_price_kg, stddev_ratio, last_recorded_at')
          .eq('store_id', info.store_id)
          .eq('species', species)
      );
      if (error || !data) return cached || {};

      const map = {};
      for (const row of data) {
        map[row.part_name] = {
          avg_ratio:     Number(row.avg_ratio) || 0,
          sample_count:  Number(row.sample_count) || 0,
          avg_price_kg:  Number(row.avg_price_kg) || 0,
          stddev_ratio:  Number(row.stddev_ratio) || 0,
          last_at:       row.last_recorded_at || null,
        };
      }
      await saveLocal(cacheKey, map);
      return map;
    } catch (e) {
      console.warn('[carcassStore.loadYieldStats]', e);
      return cached || {};
    }
  },
};
