import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 환경변수 또는 직접 입력
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── 숙성관리 ───────────────────────────────────────────
export const agingApi = {
  getAll: () => supabase.from('aging_items').select('*').order('created_at', { ascending: false }),
  create: (data) => supabase.from('aging_items').insert(data).select().single(),
  update: (id, data) => supabase.from('aging_items').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('aging_items').delete().eq('id', id),
};

// ─── 위생일지 ───────────────────────────────────────────
export const hygieneApi = {
  getAll: () => supabase.from('hygiene_logs').select('*').order('log_date', { ascending: false }),
  create: (data) => supabase.from('hygiene_logs').insert(data).select().single(),
  update: (id, data) => supabase.from('hygiene_logs').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('hygiene_logs').delete().eq('id', id),
};

// ─── 직원관리 ───────────────────────────────────────────
export const employeeApi = {
  getAll: () => supabase.from('employees').select('*').order('name'),
  create: (data) => supabase.from('employees').insert(data).select().single(),
  update: (id, data) => supabase.from('employees').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('employees').delete().eq('id', id),
};

// ─── 서류관리 ───────────────────────────────────────────
export const documentApi = {
  getAll: () => supabase.from('documents').select('*').order('created_at', { ascending: false }),
  create: (data) => supabase.from('documents').insert(data).select().single(),
  delete: (id) => supabase.from('documents').delete().eq('id', id),
};

// ─── 재고관리 ───────────────────────────────────────────
export const inventoryApi = {
  getAll: () => supabase.from('inventory').select('*').order('name'),
  create: (data) => supabase.from('inventory').insert(data).select().single(),
  update: (id, data) => supabase.from('inventory').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('inventory').delete().eq('id', id),
};

// ─── 온도·습도 ──────────────────────────────────────────
export const sensorApi = {
  getAll: (limit = 100) =>
    supabase.from('sensor_logs').select('*').order('recorded_at', { ascending: false }).limit(limit),
  create: (data) => supabase.from('sensor_logs').insert(data).select().single(),
  getLatest: () =>
    supabase.from('sensor_logs').select('*').order('recorded_at', { ascending: false }).limit(1).single(),
};
