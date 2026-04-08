/**
 * MeatBig AI 에이전트 러너
 * 사용법: node run-agent.js <validation|planning|design|security>
 *
 * 필요한 환경변수:
 *   ANTHROPIC_API_KEY  — Claude API 키
 *   NOTION_API_KEY     — Notion Integration 토큰
 *   NOTION_DATABASE_ID — AI팀 리포트 DB ID
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Client }  = require('@notionhq/client');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── 초기화 ───────────────────────────────────────────────────
const AGENT_TYPE = process.argv[2];
const VALID_TYPES = ['validation', 'planning', 'design', 'security'];
if (!VALID_TYPES.includes(AGENT_TYPE)) {
  console.error(`❌ 사용법: node run-agent.js <${VALID_TYPES.join('|')}>`);
  process.exit(1);
}

const TODAY   = new Date().toISOString().split('T')[0];
const REPO    = process.cwd();
const DB_ID   = process.env.NOTION_DATABASE_ID;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion    = new Client({ auth: process.env.NOTION_API_KEY });

// ── 유틸 ────────────────────────────────────────────────────
function rf(relPath, max = 3500) {
  try {
    const c = fs.readFileSync(path.join(REPO, relPath), 'utf8');
    return c.length > max ? c.slice(0, max) + '\n... [이하 생략]' : c;
  } catch {
    return `[없음: ${relPath}]`;
  }
}

function gitLog(n = 15) {
  try { return execSync(`git log --oneline -${n}`, { cwd: REPO }).toString().trim(); }
  catch { return '[git log 불가]'; }
}

// Notion 텍스트 2000자 제한 → 여러 블록으로 분할
function toNotionBlocks(markdown) {
  const blocks = [];
  const lines  = markdown.split('\n');
  let   chunk  = '';

  const flush = () => {
    if (chunk.trim()) {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: chunk.trim() } }] },
      });
      chunk = '';
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ') && chunk) flush();
    if ((chunk + line + '\n').length > 1900) flush();
    chunk += line + '\n';
  }
  flush();
  return blocks.length ? blocks : [{
    object: 'block', type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: '(내용 없음)' } }] },
  }];
}

// ── 에이전트 설정 ────────────────────────────────────────────
const AGENTS = {

  // ── 🔍 검증 ──────────────────────────────────────────────
  validation: {
    title:  `🔍 검증 리포트 — ${TODAY}`,
    select: '🔍 검증',
    context: () => `
## 최근 커밋 이력
${gitLog()}

## 핵심 파일 분석
=== App.js ===
${rf('App.js', 2500)}

=== src/lib/supabase.js ===
${rf('src/lib/supabase.js')}

=== src/lib/AuthContext.js ===
${rf('src/lib/AuthContext.js')}

=== src/lib/SubscriptionContext.js ===
${rf('src/lib/SubscriptionContext.js', 2500)}

=== src/screens/ScanScreen.js ===
${rf('src/screens/ScanScreen.js', 2500)}
`,
    system: `당신은 MeatBig 앱(정육점 관리 React Native/Expo 앱) 코드 검증 전문가입니다.
코드를 분석해 다음을 점검하세요:
- 버그 위험: 빈 catch{}, await 누락, null 체크 없는 .map()
- 코드 품질: console.log 잔존, TODO/FIXME, 미사용 import
- Supabase: 서비스 키 노출, EXPO_PUBLIC_ 민감 키
- 하드코딩된 값, 중복 코드

반드시 다음 JSON만 응답 (코드블록 없이 순수 JSON):
{
  "status": "✅ 완료" | "⚠️ 주의필요" | "🚨 긴급",
  "severity": "낮음" | "보통" | "높음",
  "summary": "한 줄 요약 (50자 이내)",
  "content": "마크다운 리포트 (## 섹션 구분)"
}`,
  },

  // ── 📋 기획 ──────────────────────────────────────────────
  planning: {
    title:  `📋 주간 기획 리포트 — ${TODAY}`,
    select: '📋 기획',
    context: () => `
## 최근 커밋 이력 (지난 2주)
${gitLog(20)}

## 프로젝트 현황

### ✅ 완료된 기능
- [1-A] OCR → 재고 자동 연결
- [1-B] 오프라인 안정성 (NetworkContext)
- [1-C] 푸시 알림 3종 (소비기한/숙성완료/위생점검)
- [1-E] 구독 결제 UI + 사업장 단위 구독 (stub)
- [2-A] 직원/사장 권한 분리 (RoleContext)
- [2-B] 거래처·발주 관리
- [2-C] 마진 대시보드 강화
- [2-D] 빈 화면 온보딩 개선
- [2-F] 세무 리포트 CSV
- [3-D] 계정 시스템 (이메일 로그인/회원가입)
- 교육일지·세무리포트 PDF 출력 추가
- 삼성폰 레이아웃 버그 수정 (useSafeAreaInsets)
- 실제 축산물이력제 API 연동
- 코드 보안 강화 (서비스 키 번들 제거)

### ⏳ 미완료 (우선순위순)
1. [1-D] 앱스토어/구글플레이 등록 — 🔥 수익화 전제조건
2. [2-E] 컨설팅 신청 버튼 — Day 1 수익 (50~300만원/건)
3. RevenueCat SDK 실결제 연동
4. ML Kit 바코드/OCR 교체 (Anthropic API 비용 절감)
5. Google/카카오 소셜 로그인
6. 전자서명 PDF 기능

### 🔧 첫 EAS 바이너리 빌드 때 처리 (OTA 불가)
- react-native-vision-camera v4
- @react-native-ml-kit/text-recognition
- react-native-purchases (RevenueCat)
- react-native-signature-canvas
- Google/카카오 OAuth SDK

## 현재 App.js 네비게이션 구조
${rf('App.js', 1500)}
`,
    system: `당신은 MeatBig 앱의 주간 기획 에이전트입니다.
프로젝트 현황과 최근 커밋을 분석하여 이번 주 최적 작업 계획을 수립하세요.
수익화(앱스토어, 구독 결제)를 항상 최우선으로 고려하세요.

반드시 다음 JSON만 응답 (코드블록 없이 순수 JSON):
{
  "status": "📝 정보",
  "severity": "낮음",
  "summary": "1단계 N% · TOP3: [작업1] / [작업2] / [작업3]",
  "content": "마크다운 리포트 (## 📊 현황, ## 🎯 TOP 3 작업, ## 💰 수익화 진행, ## 📌 감독자 메시지)"
}`,
  },

  // ── 🎨 디자인 ────────────────────────────────────────────
  design: {
    title:  `🎨 디자인 리포트 — ${TODAY}`,
    select: '🎨 디자인',
    context: () => `
## 디자인 시스템 (theme.js)
${rf('src/theme.js')}

## 주요 화면
=== DashboardScreen.js ===
${rf('src/screens/DashboardScreen.js', 2500)}

=== LoginScreen.js ===
${rf('src/screens/LoginScreen.js', 2000)}

=== PaywallScreen.js ===
${rf('src/screens/PaywallScreen.js', 2000)}

=== InventoryScreen.js (일부) ===
${rf('src/screens/InventoryScreen.js', 1500)}
`,
    system: `당신은 MeatBig 앱 UI/UX 디자인 전문가입니다.
다음을 점검하세요:
- 테마 버그: StyleSheet.create() 안에서 colors.* 직접 사용 (인라인으로 써야 함)
- pal = isDark ? darkColors : lightColors 패턴 미적용 화면
- sc() 스케일 함수 미사용 하드코딩 fontSize/padding
- UX: 빈 상태 없는 화면, 로딩 인디케이터 없는 비동기
- 구독 전환율: PaywallScreen 개선점
- 신규 사용자 첫인상: LoginScreen, OnboardingScreen

반드시 다음 JSON만 응답 (코드블록 없이 순수 JSON):
{
  "status": "✅ 완료" | "⚠️ 주의필요" | "🚨 긴급",
  "severity": "낮음" | "보통" | "높음",
  "summary": "테마버그 N건 · UX개선 N건 · 일관성 N건",
  "content": "마크다운 리포트"
}`,
  },

  // ── 🔒 보안 ──────────────────────────────────────────────
  security: {
    title:  `🔒 보안 리포트 — ${TODAY}`,
    select: '🔒 보안',
    context: () => `
## 보안 핵심 파일
=== src/lib/supabase.js ===
${rf('src/lib/supabase.js')}

=== src/lib/AuthContext.js ===
${rf('src/lib/AuthContext.js')}

=== src/lib/dataStore.js ===
${rf('src/lib/dataStore.js', 3000)}

=== src/lib/SubscriptionContext.js ===
${rf('src/lib/SubscriptionContext.js', 2000)}

=== src/screens/OnboardingScreen.js ===
${rf('src/screens/OnboardingScreen.js', 2500)}

## .env.local 파일 존재 여부
${fs.existsSync(path.join(REPO, '.env.local')) ? '파일 존재함 (GitHub에 커밋되지 않아야 함)' : '파일 없음 (정상)'}

## .gitignore 내용
${rf('.gitignore', 1000)}
`,
    system: `당신은 MeatBig 앱(React Native/Expo) 보안 전문가입니다.
다음을 점검하세요:
- EXPO_PUBLIC_ 키 노출 (JS 번들에 포함됨 — ANTHROPIC_API_KEY는 즉시 제거 권고)
- supabaseAdmin/서비스 키 클라이언트 노출
- auth_uid 없이 테이블 접근, .select('*') 과도 사용
- signOut 시 AsyncStorage 완전 초기화 여부
- 입력값 검증 (이메일, 사업자번호, invite_pin)
- console.log에 민감 데이터 출력
- .env.local이 .gitignore에 포함됐는지

반드시 다음 JSON만 응답 (코드블록 없이 순수 JSON):
{
  "status": "✅ 완료" | "⚠️ 주의필요" | "🚨 긴급",
  "severity": "낮음" | "보통" | "높음",
  "summary": "Critical N건 · Warning N건 · Info N건",
  "content": "마크다운 리포트 (## 🚨 Critical, ## ⚠️ Warning, ## 📝 Info, ## ✅ 정상, ## 🛡️ 우선 조치 TOP3)"
}`,
  },
};

// ── 메인 실행 ────────────────────────────────────────────────
async function main() {
  const cfg = AGENTS[AGENT_TYPE];
  console.log(`\n🤖 [${cfg.title}] 시작\n`);

  // 1) Claude API 호출
  let result;
  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 2048,
      system:     cfg.system,
      messages:   [{ role: 'user', content: `분석 대상:\n\n${cfg.context()}` }],
    });
    const raw = response.content[0]?.text ?? '';
    result = JSON.parse(raw);
    console.log(`✅ Claude 분석 완료 — ${result.summary}`);
  } catch (err) {
    console.error('⚠️ Claude 분석 실패:', err.message);
    result = {
      status:   '⚠️ 주의필요',
      severity: '보통',
      summary:  'Claude 분석 실패 — 수동 확인 필요',
      content:  `## ❌ 에이전트 실행 오류\n\n\`\`\`\n${err.message}\n\`\`\`\n\n수동으로 코드를 점검해주세요.`,
    };
  }

  // 2) Notion 페이지 생성
  try {
    await notion.pages.create({
      parent: { database_id: DB_ID },
      properties: {
        '제목':    { title:     [{ text: { content: cfg.title } }] },
        '에이전트': { select:    { name: cfg.select } },
        '날짜':    { date:      { start: TODAY } },
        '상태':    { select:    { name: result.status } },
        '요약':    { rich_text: [{ text: { content: result.summary.slice(0, 200) } }] },
        '심각도':  { select:    { name: result.severity } },
      },
      children: toNotionBlocks(result.content),
    });
    console.log(`✅ Notion 리포트 등록 완료\n`);
  } catch (err) {
    console.error('❌ Notion 저장 실패:', err.message);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
