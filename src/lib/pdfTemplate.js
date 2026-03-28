/**
 * pdfTemplate.js
 * MeatBig 공통 PDF 출력 템플릿
 * 모든 서류는 이 파일의 함수를 조합해 생성합니다.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { businessInfo } from '../data/mockData';

// ─── 문서 일련번호 생성 ──────────────────────────────────────
const DOC_PREFIX = {
  hygiene : 'HG',
  temp    : 'TM',
  aging   : 'AG',
  closing : 'CL',
  staff   : 'ST',
};

function genDocNo(type) {
  const prefix = DOC_PREFIX[type] || 'MB';
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq  = String(Math.floor(Math.random() * 900) + 100);
  return `MB-${prefix}-${yymm}-${seq}`;
}

// ─── 공통 CSS ────────────────────────────────────────────────
export const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Nanum Gothic", sans-serif;
    font-size: 13px;
    color: #1a1f36;
    background: #fff;
    padding: 28px 32px;
  }

  /* ── 문서 헤더 ── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #C0392B;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .doc-header-left .brand {
    font-size: 18px;
    font-weight: 900;
    color: #C0392B;
    letter-spacing: -0.5px;
  }
  .doc-header-left .biz-info {
    font-size: 11px;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.6;
  }
  .doc-header-right { text-align: right; }
  .doc-header-right .doc-title {
    font-size: 20px;
    font-weight: 900;
    color: #1a1f36;
    line-height: 1.2;
  }
  .doc-header-right .doc-meta {
    font-size: 11px;
    color: #6b7280;
    margin-top: 6px;
    line-height: 1.7;
  }
  .doc-header-right .doc-no {
    display: inline-block;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 10px;
    font-family: monospace;
    color: #374151;
    margin-top: 4px;
  }

  /* ── 요약 박스 (마감정산 등) ── */
  .summary-grid {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  .summary-box {
    flex: 1;
    border: 1.5px solid #d1d5db;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  .summary-box .s-label { font-size: 10px; color: #6b7280; font-weight: 700; margin-bottom: 4px; }
  .summary-box .s-value { font-size: 18px; font-weight: 900; color: #1a1f36; }
  .summary-box .s-value.accent { color: #C0392B; }
  .summary-box .s-value.green  { color: #15803d; }
  .summary-box .s-value.warn   { color: #92400e; }

  /* ── 섹션 제목 ── */
  .section-title {
    font-size: 12px;
    font-weight: 900;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-left: 4px solid #C0392B;
    padding-left: 8px;
    margin: 20px 0 10px;
  }

  /* ── 공통 테이블 ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 4px;
  }
  thead tr {
    background: #f3f4f6;
  }
  th {
    padding: 9px 10px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #4b5563;
    border: 1px solid #d1d5db;
    white-space: nowrap;
  }
  td {
    padding: 9px 10px;
    border: 1px solid #d1d5db;
    vertical-align: middle;
    line-height: 1.5;
  }
  tr:nth-child(even) td { background: #f9fafb; }

  /* ── 상태 표시 ── */
  .status-ok   { font-weight: 700; color: #15803d; }
  .status-warn { font-weight: 700; color: #92400e; background: #fef9c3; padding: 1px 6px; border-radius: 3px; }
  .status-done { font-weight: 700; color: #1d4ed8; }
  .mono        { font-family: "Courier New", monospace; font-size: 11px; }
  .bold        { font-weight: 700; }
  .center      { text-align: center; }
  .right       { text-align: right; }

  /* ── 진행 바 ── */
  .prog-wrap { height: 7px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 5px; }
  .prog-fill { height: 7px; background: #C0392B; border-radius: 4px; }

  /* ── OX 체크리스트 ── */
  .ox-table td.ox-o { font-weight: 900; color: #15803d; font-size: 15px; text-align: center; }
  .ox-table td.ox-x { font-weight: 900; color: #C0392B; font-size: 15px; text-align: center; background: #fef2f2; }
  .ox-table td.ox-dash { color: #9ca3af; text-align: center; }

  /* ── 서명란 ── */
  .signature-section {
    margin-top: 28px;
    border-top: 2px solid #1a1f36;
    padding-top: 16px;
    display: flex;
    gap: 0;
  }
  .sig-box {
    flex: 1;
    border: 1px solid #d1d5db;
    padding: 10px 14px;
    min-height: 64px;
    position: relative;
  }
  .sig-box:not(:last-child) { border-right: none; }
  .sig-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .sig-line {
    border-bottom: 1px solid #9ca3af;
    height: 28px;
    margin-bottom: 4px;
  }
  .sig-date { font-size: 10px; color: #9ca3af; }

  /* ── 법적 고지 ── */
  .legal-note {
    margin-top: 12px;
    padding: 8px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 10px;
    color: #6b7280;
    line-height: 1.6;
  }

  /* ── 문서 푸터 ── */
  .doc-footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #9ca3af;
  }

  /* ── 페이지 나누기 방지 ── */
  table { page-break-inside: auto; }
  tr    { page-break-inside: avoid; }
`;

// ─── 공통 헤더 빌더 ─────────────────────────────────────────
export function buildHeader({ title, type, period }) {
  const biz = businessInfo;
  const docNo = genDocNo(type);
  const printDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return `
    <div class="doc-header">
      <div class="doc-header-left">
        <div class="brand">MEATBIG</div>
        <div class="biz-info">
          ${biz.bizName}&nbsp;&nbsp;|&nbsp;&nbsp;사업자등록번호: ${biz.bizNo}<br>
          대표자: ${biz.owner}&nbsp;&nbsp;|&nbsp;&nbsp;축종: ${biz.species.join(', ')}
        </div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">${title}</div>
        <div class="doc-meta">
          출력일시: ${printDate}<br>
          ${period ? `대상 기간: ${period}` : ''}
        </div>
        <div class="doc-no">${docNo}</div>
      </div>
    </div>`;
}

// ─── 서명란 빌더 ────────────────────────────────────────────
export function buildSignature(signers = ['작성자', '확인자', '점장']) {
  const today = new Date().toLocaleDateString('ko-KR');
  const boxes = signers.map(name => `
    <div class="sig-box">
      <div class="sig-label">${name}</div>
      <div class="sig-line"></div>
      <div class="sig-date">${today}</div>
    </div>`).join('');
  return `<div class="signature-section">${boxes}</div>`;
}

// ─── 법적 고지 ───────────────────────────────────────────────
export function buildLegal(text) {
  return `<div class="legal-note">※ ${text}</div>`;
}

// ─── 공통 푸터 ───────────────────────────────────────────────
export function buildFooter(totalPages = 1, page = 1) {
  return `
    <div class="doc-footer">
      <span>MeatBig — 축산물 이력 관리 시스템</span>
      <span>${page} / ${totalPages} 페이지</span>
      <span>© ${new Date().getFullYear()} MeatBig. All rights reserved.</span>
    </div>`;
}

// ─── 전체 HTML 조립 ─────────────────────────────────────────
export function buildHTML(bodyContent) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${PDF_CSS}</style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// 서류별 HTML 생성 함수
// ═══════════════════════════════════════════════════════════════

/** 위생관리 점검표 */
export function genHygieneHTML(logs) {
  const period = logs.length > 0
    ? `${logs[logs.length - 1].date} ~ ${logs[0].date}`
    : new Date().toLocaleDateString('ko-KR');

  const KEYS = ['개인위생', '도마·칼 소독', '냉장고 온도', '작업대 청결', '방충·방서', '원산지 표시판'];

  const rows = logs.map(l => {
    // items 배열에서 O/X 추출
    const getVal = (keyword) => {
      const found = l.items.find(i => i.includes(keyword));
      if (!found) return '<td class="ox-dash">—</td>';
      const isO = found.includes('O') || found.includes('✓');
      return isO
        ? '<td class="ox-o">O</td>'
        : '<td class="ox-x">X</td>';
    };
    const tempItem = l.items.find(i => i.includes('°C') || i.includes('온도:'));
    const tempVal = tempItem ? tempItem.replace(/.*?(\d+\.?\d*°?C?).*/, '$1') : '—';

    return `<tr>
      <td class="center">${l.date}</td>
      <td class="center">${l.time}</td>
      <td class="center bold">${l.session || '오전'}</td>
      <td class="center">${l.inspector}</td>
      ${getVal('개인위생')}
      ${getVal('도마')}
      <td class="center">${tempVal}</td>
      ${getVal('작업대')}
      ${getVal('방충')}
      ${getVal('원산지')}
      <td class="center ${l.status === 'pass' ? 'status-ok' : 'status-warn'}">
        ${l.status === 'pass' ? '✓ 적합' : '⚠ 주의'}
      </td>
    </tr>`;
  }).join('');

  const passCount = logs.filter(l => l.status === 'pass').length;
  const warnCount = logs.length - passCount;

  const body = `
    ${buildHeader({ title: '위생관리 점검표', type: 'hygiene', period })}

    <div class="summary-grid">
      <div class="summary-box">
        <div class="s-label">총 점검 횟수</div>
        <div class="s-value">${logs.length}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">적합 판정</div>
        <div class="s-value green">${passCount}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">주의 판정</div>
        <div class="s-value ${warnCount > 0 ? 'warn' : ''}">${warnCount}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">적합률</div>
        <div class="s-value accent">${logs.length > 0 ? Math.round(passCount / logs.length * 100) : 0}%</div>
      </div>
    </div>

    <div class="section-title">일일 위생 점검 기록</div>
    <table class="ox-table">
      <thead>
        <tr>
          <th class="center">날짜</th>
          <th class="center">시간</th>
          <th class="center">구분</th>
          <th class="center">점검자</th>
          <th class="center">개인위생</th>
          <th class="center">도마·칼</th>
          <th class="center">냉장온도</th>
          <th class="center">작업대</th>
          <th class="center">방충·방서</th>
          <th class="center">원산지표시</th>
          <th class="center">판정</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${buildSignature(['작성자', '위생관리자', '점장'])}
    ${buildLegal('본 위생관리 기록은 「식품위생법」 및 HACCP 기준에 따라 2년간 보관하여야 합니다.')}
    ${buildFooter()}`;

  return buildHTML(body);
}

/** 온도관리 기록부 */
export function genTempHTML(records) {
  const period = records.length > 0
    ? `${records[records.length - 1].date} ~ ${records[0].date}`
    : new Date().toLocaleDateString('ko-KR');

  const rows = records.map(r => {
    const tempWarn = r.temp > 4;
    return `<tr>
      <td class="center">${r.date}</td>
      <td class="center">${r.time}</td>
      <td class="center">${r.person}</td>
      <td class="center ${tempWarn ? 'status-warn' : 'status-ok'}">${r.temp}°C</td>
      <td class="center">${r.humidity}%</td>
      <td class="center ${r.status === 'warn' ? 'status-warn' : 'status-ok'}">
        ${r.status === 'warn' ? '⚠ 주의' : '✓ 정상'}
      </td>
      <td>${r.note || '—'}</td>
    </tr>`;
  }).join('');

  const avgTemp = records.length > 0
    ? (records.reduce((s, r) => s + r.temp, 0) / records.length).toFixed(1)
    : '—';
  const warnCount = records.filter(r => r.status === 'warn').length;

  const body = `
    ${buildHeader({ title: '온도관리 기록부', type: 'temp', period })}

    <div class="summary-grid">
      <div class="summary-box">
        <div class="s-label">총 기록 횟수</div>
        <div class="s-value">${records.length}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">평균 온도</div>
        <div class="s-value">${avgTemp}°C</div>
      </div>
      <div class="summary-box">
        <div class="s-label">이상 감지</div>
        <div class="s-value ${warnCount > 0 ? 'warn' : 'green'}">${warnCount}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">관리 기준</div>
        <div class="s-value" style="font-size:13px;">냉장 ≤ 4°C</div>
      </div>
    </div>

    <div class="section-title">온도·습도 측정 기록</div>
    <table>
      <thead>
        <tr>
          <th class="center">날짜</th>
          <th class="center">시간</th>
          <th class="center">측정자</th>
          <th class="center">냉장 온도</th>
          <th class="center">습도</th>
          <th class="center">상태</th>
          <th>비고·조치사항</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${buildSignature(['측정자', '시설관리자', '점장'])}
    ${buildLegal('냉장 보관 기준: 10°C 이하 (식품공전). 숙성실: 0~4°C. 이상 발생 시 즉시 점검 후 기록하여야 합니다.')}
    ${buildFooter()}`;

  return buildHTML(body);
}

/** 숙성 관리 대장 */
export function genAgingHTML(items) {
  const active = items.filter(i => !i.completed);
  const done   = items.filter(i => i.completed);

  const makeRow = (i) => {
    const pct = Math.min(100, Math.round((i.day / i.targetDay) * 100));
    const yld = (i.weight / i.initWeight * 100).toFixed(1);
    const statusLabel = i.completed ? '완성' : i.status === 'aging' ? '숙성 중' : '초기';
    const statusClass = i.completed ? 'status-done' : i.status === 'aging' ? 'status-ok' : '';
    return `<tr>
      <td class="mono">${i.trace}</td>
      <td class="bold">${i.cut}</td>
      <td class="center">${i.grade}등급</td>
      <td class="center">${i.origin}</td>
      <td class="center">${i.startDate}</td>
      <td class="center">${i.day}일 / ${i.targetDay}일
        <div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>
      </td>
      <td class="center bold ${pct >= 100 ? 'status-done' : ''}">${pct}%</td>
      <td class="center">${parseFloat(i.initWeight).toFixed(1)}kg → ${parseFloat(i.weight).toFixed(1)}kg</td>
      <td class="center ${parseFloat(yld) >= 85 ? 'status-ok' : parseFloat(yld) >= 75 ? '' : 'status-warn'}">${yld}%</td>
      <td class="center">${i.temp}°C / ${i.humidity}%</td>
      <td class="center ${statusClass}">${statusLabel}</td>
    </tr>`;
  };

  const avgYield = items.length > 0
    ? (items.reduce((s, i) => s + (i.weight / i.initWeight * 100), 0) / items.length).toFixed(1)
    : '—';

  const body = `
    ${buildHeader({ title: '숙성 관리 대장', type: 'aging',
      period: new Date().toLocaleDateString('ko-KR') })}

    <div class="summary-grid">
      <div class="summary-box">
        <div class="s-label">총 관리 건수</div>
        <div class="s-value">${items.length}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">숙성 진행 중</div>
        <div class="s-value">${active.length}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">숙성 완료</div>
        <div class="s-value green">${done.length}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">평균 수율</div>
        <div class="s-value accent">${avgYield}%</div>
      </div>
    </div>

    <div class="section-title">숙성 진행 현황 (${active.length}건)</div>
    <table>
      <thead>
        <tr>
          <th>이력번호</th>
          <th>부위명</th>
          <th class="center">등급</th>
          <th class="center">원산지</th>
          <th class="center">입고일</th>
          <th class="center">숙성 경과</th>
          <th class="center">진행률</th>
          <th class="center">중량 변화</th>
          <th class="center">수율</th>
          <th class="center">온도/습도</th>
          <th class="center">상태</th>
        </tr>
      </thead>
      <tbody>
        ${active.length > 0 ? active.map(makeRow).join('') : '<tr><td colspan="11" class="center" style="color:#9ca3af;padding:20px">진행 중인 숙성 항목 없음</td></tr>'}
      </tbody>
    </table>

    ${done.length > 0 ? `
    <div class="section-title">숙성 완료 이력 (${done.length}건)</div>
    <table>
      <thead>
        <tr>
          <th>이력번호</th>
          <th>부위명</th>
          <th class="center">등급</th>
          <th class="center">원산지</th>
          <th class="center">입고일</th>
          <th class="center">숙성 경과</th>
          <th class="center">진행률</th>
          <th class="center">중량 변화</th>
          <th class="center">수율</th>
          <th class="center">온도/습도</th>
          <th class="center">상태</th>
        </tr>
      </thead>
      <tbody>${done.map(makeRow).join('')}</tbody>
    </table>` : ''}

    ${buildSignature(['작성자', '품질관리자', '점장'])}
    ${buildLegal('본 대장은 드라이에이징 이력 관리 목적으로 작성되었으며, 이력번호는 축산물 이력제 기준입니다.')}
    ${buildFooter()}`;

  return buildHTML(body);
}

/** 일일 마감 정산서 */
export function genClosingHTML(sales, waste, inventory) {
  const today = new Date().toLocaleDateString('ko-KR');
  const totalSales  = sales.reduce((s, r) => s + r.total, 0);
  const totalWaste  = waste.reduce((s, w) => s + (parseFloat(w.qty) || 0) * (w.lossUnit || 5000), 0);
  const totalMargin = totalSales > 0
    ? ((totalSales - waste.length * 1000) / totalSales * 100).toFixed(1) : '0';

  const saleRows = sales.map(r => `<tr>
    <td class="center">${r.time}</td>
    <td class="bold">${r.cut}</td>
    <td class="center">${r.origin || '—'}</td>
    <td class="center">${r.qty}kg</td>
    <td class="right">${r.price.toLocaleString()}원/kg</td>
    <td class="right bold">${r.total.toLocaleString()}원</td>
  </tr>`).join('');

  const wasteRows = waste.length > 0
    ? waste.map(w => `<tr>
        <td class="bold">${w.cut}</td>
        <td class="center">${w.qty}kg</td>
        <td>${w.reason || '사유 미입력'}</td>
        <td class="right status-warn">-${((parseFloat(w.qty) || 0) * (w.lossUnit || 5000)).toLocaleString()}원 추정</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="center" style="color:#9ca3af;padding:12px">폐기 내역 없음</td></tr>';

  const stockRows = inventory.map(m => {
    const expWarn = m.dday <= 1;
    return `<tr>
      <td class="bold">${m.cut}</td>
      <td>${m.origin}</td>
      <td class="center ${m.qty < 5 ? 'status-warn' : ''}">${m.qty}kg</td>
      <td class="center ${expWarn ? 'status-warn' : ''}">${m.expire}</td>
      <td class="center ${expWarn ? 'status-warn' : 'status-ok'}">D-${m.dday}</td>
    </tr>`;
  }).join('');

  const body = `
    ${buildHeader({ title: '일일 마감 정산서', type: 'closing', period: today })}

    <div class="summary-grid">
      <div class="summary-box">
        <div class="s-label">오늘 총매출</div>
        <div class="s-value accent">${totalSales.toLocaleString()}원</div>
      </div>
      <div class="summary-box">
        <div class="s-label">판매 건수</div>
        <div class="s-value">${sales.length}건</div>
      </div>
      <div class="summary-box">
        <div class="s-label">폐기 손실 추정</div>
        <div class="s-value ${totalWaste > 0 ? 'warn' : 'green'}">${totalWaste > 0 ? '-' : ''}${totalWaste.toLocaleString()}원</div>
      </div>
      <div class="summary-box">
        <div class="s-label">추정 마진율</div>
        <div class="s-value green">${totalMargin}%</div>
      </div>
    </div>

    <div class="section-title">판매 내역 (${sales.length}건)</div>
    <table>
      <thead>
        <tr>
          <th class="center">시간</th>
          <th>부위명</th>
          <th class="center">원산지·등급</th>
          <th class="center">판매량</th>
          <th class="right">단가</th>
          <th class="right">금액</th>
        </tr>
      </thead>
      <tbody>
        ${saleRows}
        <tr style="background:#f3f4f6">
          <td colspan="5" class="right bold">합계</td>
          <td class="right bold" style="font-size:14px">${totalSales.toLocaleString()}원</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">폐기 내역</div>
    <table>
      <thead>
        <tr>
          <th>부위명</th>
          <th class="center">폐기량</th>
          <th>폐기 사유</th>
          <th class="right">손실 추정액</th>
        </tr>
      </thead>
      <tbody>${wasteRows}</tbody>
    </table>

    <div class="section-title">잔여 재고 현황</div>
    <table>
      <thead>
        <tr>
          <th>부위명</th>
          <th>원산지·등급</th>
          <th class="center">잔량</th>
          <th class="center">소비기한</th>
          <th class="center">D-day</th>
        </tr>
      </thead>
      <tbody>${stockRows}</tbody>
    </table>

    ${buildSignature(['마감 담당자', '확인자', '점장'])}
    ${buildLegal('본 정산서는 일일 매출·폐기 기록 목적으로 작성되었습니다. 실제 정산은 POS 데이터를 기준으로 하십시오.')}
    ${buildFooter()}`;

  return buildHTML(body);
}

/** 직원 보건증 현황 */
export function genStaffHTML(staff) {
  const today = new Date();

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return 999;
    const parts = dateStr.split('.');
    if (parts.length < 3) return 999;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return Math.ceil((d - today) / 86400000);
  };

  const rows = staff.map(s => {
    const healthLeft = getDaysLeft(s.health);
    const eduLeft    = getDaysLeft(s.edu);
    const healthWarn = healthLeft <= 30;
    const eduWarn    = eduLeft <= 30;
    return `<tr>
      <td class="bold">${s.name}</td>
      <td class="center">${s.role}</td>
      <td class="center">${s.hire}</td>
      <td class="center ${healthWarn ? 'status-warn' : 'status-ok'}">${s.health}</td>
      <td class="center ${healthWarn ? 'status-warn' : 'status-ok'}">${healthWarn ? `D-${healthLeft}` : '정상'}</td>
      <td class="center ${eduWarn ? 'status-warn' : 'status-ok'}">${s.edu}</td>
      <td class="center ${s.status === 'expired' ? 'status-warn' : 'status-ok'}">
        ${s.status === 'expired' ? '⚠ 갱신 필요' : '✓ 정상'}
      </td>
    </tr>`;
  }).join('');

  const expired = staff.filter(s => s.status === 'expired').length;

  const body = `
    ${buildHeader({ title: '직원 보건증 현황', type: 'staff',
      period: today.toLocaleDateString('ko-KR') })}

    <div class="summary-grid">
      <div class="summary-box">
        <div class="s-label">총 직원 수</div>
        <div class="s-value">${staff.length}명</div>
      </div>
      <div class="summary-box">
        <div class="s-label">정상</div>
        <div class="s-value green">${staff.length - expired}명</div>
      </div>
      <div class="summary-box">
        <div class="s-label">갱신 필요</div>
        <div class="s-value ${expired > 0 ? 'warn' : 'green'}">${expired}명</div>
      </div>
      <div class="summary-box">
        <div class="s-label">관리 기준일</div>
        <div class="s-value" style="font-size:13px;">${today.toLocaleDateString('ko-KR')}</div>
      </div>
    </div>

    <div class="section-title">직원별 위생 교육 이수 현황</div>
    <table>
      <thead>
        <tr>
          <th>이름</th>
          <th class="center">역할</th>
          <th class="center">입사일</th>
          <th class="center">보건증 만료일</th>
          <th class="center">보건증 상태</th>
          <th class="center">위생교육 이수일</th>
          <th class="center">종합 상태</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${buildSignature(['작성자', '위생관리자'])}
    ${buildLegal('보건증은 「식품위생법」 제40조에 따라 1년마다 갱신하여야 합니다. 만료 30일 전 사전 갱신을 권장합니다.')}
    ${buildFooter()}`;

  return buildHTML(body);
}

// ═══════════════════════════════════════════════════════════════
// 공통 출력 실행 함수
// ═══════════════════════════════════════════════════════════════
export async function printAndShare(html, fileName = 'MeatBig_문서') {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    let shared = false;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${fileName} 내보내기`,
          UTI: 'com.adobe.pdf',
        });
        shared = true;
      }
    } catch (_) {}
    if (!shared) {
      // 공유 불가 시 네이티브 인쇄 다이얼로그 사용
      await Print.printAsync({ html });
    }
  } catch (e) {
    console.error('PDF 오류:', e);
    try {
      // 최종 fallback: 인쇄 다이얼로그
      await Print.printAsync({ html });
    } catch (_) {
      Alert.alert('오류', 'PDF 생성 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.');
    }
  }
}
