// @ts-nocheck
/**
 * admin-toggle-feature — feature_flags 테이블 쓰기 프록시
 *
 * 왜 필요한가:
 *   · feature_flags 쓰기는 service_role 키가 있어야 가능 (RLS 잠금)
 *   · 이 키는 클라이언트 번들에 절대 넣으면 안 됨
 *   · Edge Function 에서 service_role 을 사용하고, 호출자는 PIN 으로 2차 검증
 *
 * 입력 (JSON):
 *   { action: 'toggle',  feature_key: string, is_free: boolean, master_pin: string }
 *   { action: 'bulk',    flags: [{feature_key, is_free}, ...],  master_pin: string }
 *
 * 필수 환경변수 (Supabase Dashboard → Edge Functions → Secrets):
 *   · SUPABASE_SERVICE_ROLE_KEY — Supabase Settings → API 의 service_role 키
 *   · ADMIN_MASTER_PIN          — 관리자 전용 PIN (기본값 '777777' 호환)
 *
 * 배포:
 *   npx supabase functions deploy admin-toggle-feature
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  // 1) 로그인된 사용자만 (anon 아님)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 2) 바디 파싱
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { action, master_pin } = body ?? {};
  if (!action || !master_pin) {
    return json({ error: 'Missing action / master_pin' }, 400);
  }

  // 3) 관리자 PIN 검증 (서버 시크릿)
  const expectedPin = Deno.env.get('ADMIN_MASTER_PIN') || '777777';
  if (master_pin !== expectedPin) {
    return json({ error: 'Invalid master PIN' }, 403);
  }

  // 4) service_role 로 feature_flags 쓰기 (RLS 우회)
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!svcKey) {
    return json({ error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing)' }, 500);
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', svcKey);

  try {
    if (action === 'toggle') {
      const { feature_key, is_free } = body;
      if (!feature_key || typeof is_free !== 'boolean') {
        return json({ error: 'Missing feature_key / is_free' }, 400);
      }
      const { error } = await admin
        .from('feature_flags')
        .upsert(
          { feature_key, is_free, updated_at: new Date().toISOString() },
          { onConflict: 'feature_key' },
        );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, feature_key, is_free });
    }

    if (action === 'bulk') {
      const { flags } = body;
      if (!Array.isArray(flags) || flags.length === 0) {
        return json({ error: 'flags must be non-empty array' }, 400);
      }
      const rows = flags
        .filter(f => f && typeof f.feature_key === 'string' && typeof f.is_free === 'boolean')
        .map(f => ({
          feature_key: f.feature_key,
          is_free:     f.is_free,
          updated_at:  new Date().toISOString(),
        }));
      if (rows.length === 0) {
        return json({ error: 'No valid rows in flags' }, 400);
      }
      const { error } = await admin
        .from('feature_flags')
        .upsert(rows, { onConflict: 'feature_key' });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, updated: rows.length });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});
