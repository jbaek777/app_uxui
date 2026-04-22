// @ts-nocheck
/**
 * ocr-proxy — Anthropic OCR 호출 프록시 (Supabase Edge Function)
 *
 * 왜 프록시인가:
 *   · EXPO_PUBLIC_* 환경변수는 JS 번들에 그대로 포함되어 노출됨
 *   · 누군가 앱 번들을 디컴파일하면 Anthropic 키로 본인 요금 사용 가능
 *   · 서버(이 Edge Function)에서만 키를 쥐고 있도록 프록시 구현
 *
 * 호출 요건:
 *   · 로그인된 사용자만 (Authorization: Bearer <supabase-jwt>)
 *   · JSON body: { docType: string, prompt: string, imageBase64: string, mimeType: string }
 *
 * 환경변수 (Supabase 대시보드 → Project Settings → Edge Functions → Secrets 에 설정):
 *   · ANTHROPIC_API_KEY — Anthropic 콘솔에서 발급한 sk-ant-... 키
 *
 * 배포:
 *   npx supabase functions deploy ocr-proxy --no-verify-jwt=false
 *
 * 수동 호출 테스트:
 *   curl -X POST https://<project>.supabase.co/functions/v1/ocr-proxy \
 *     -H "Authorization: Bearer <user-jwt>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"docType":"거래명세서","prompt":"...","imageBase64":"...","mimeType":"image/jpeg"}'
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
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // 1) 사용자 인증 확인 (로그인된 사용자만 호출 가능)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 2) 요청 바디 파싱
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { docType, prompt, imageBase64, mimeType } = body ?? {};
  if (!docType || !prompt || !imageBase64) {
    return json({ error: 'Missing docType / prompt / imageBase64' }, 400);
  }

  // base64 페이로드 과대 방지 (약 8MB 제한 — Anthropic 권장)
  if (imageBase64.length > 11_000_000) {
    return json({ error: 'Image too large (>8MB after base64)' }, 413);
  }

  // 3) Anthropic API 호출 (서버사이드 — 키는 Secrets 에서 로드)
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json({ error: 'Server not configured (ANTHROPIC_API_KEY missing)' }, 500);
  }

  const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const safeMime  = SUPPORTED.includes(mimeType) ? mimeType : 'image/jpeg';

  // 30초 타임아웃
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: safeMime, data: imageBase64 } },
            { type: 'text',  text: prompt },
          ],
        }],
      }),
    });
    clearTimeout(timer);

    const data = await upstream.json();

    // Anthropic 에러는 그대로 400/401/기타 로 전달
    if (!upstream.ok || data.error) {
      const status = upstream.status || 500;
      return json({ error: data.error?.message || 'Anthropic error', type: data.error?.type }, status);
    }

    // 성공: content 만 전달 (가공 최소화)
    return json({ content: data.content, usage: data.usage ?? null });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      return json({ error: 'Upstream timeout (30s)' }, 504);
    }
    return json({ error: e?.message || 'Proxy failure' }, 500);
  }
});
