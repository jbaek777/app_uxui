import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn } from '../components/UI';
import { hygieneData, agingData, tempData, staffData } from '../data/mockData';

const PDF_STYLE = `
  body { font-family: sans-serif; padding: 32px; color: #1a1f36; background: #fff; }
  h1 { font-size: 22px; border-bottom: 3px solid #C0392B; padding-bottom: 10px; margin-bottom: 6px; }
  .meta { font-size: 12px; color: #9099b8; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f5f6fa; padding: 10px 12px; text-align: left; font-size: 12px; color: #5a6480; border: 1px solid #dde1ef; }
  td { padding: 10px 12px; font-size: 13px; border: 1px solid #dde1ef; }
  tr:nth-child(even) td { background: #fafafa; }
  .ok { color: #27AE60; font-weight: bold; }
  .warn { color: #F39C12; font-weight: bold; }
  .footer { margin-top: 40px; font-size: 11px; color: #9099b8; text-align: right; }
`;

const DOCS = [
  {
    id: 'hygiene',
    title: '위생관리 점검표',
    icon: '🧼',
    desc: '일일 위생·HACCP 점검 기록',
    color: colors.gn,
    getHTML: () => {
      const rows = hygieneData.map(l => `<tr>
        <td>${l.date} ${l.time}</td>
        <td>${l.session || '오전'}</td>
        <td>${l.inspector}</td>
        <td>${l.items.join(', ')}</td>
        <td class="${l.status === 'pass' ? 'ok' : 'warn'}">${l.status === 'pass' ? '✓ 적합' : '⚠ 주의'}</td>
      </tr>`).join('');
      return `<html><head><style>${PDF_STYLE}</style></head><body>
        <h1>🧼 위생관리 점검표</h1>
        <div class="meta">출력일: ${new Date().toLocaleDateString('ko-KR')} | 총 ${hygieneData.length}건</div>
        <table><thead><tr><th>일시</th><th>구분</th><th>담당자</th><th>점검내용</th><th>판정</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="footer">MeatBig — 자동 생성 문서</div>
      </body></html>`;
    },
  },
  {
    id: 'temp',
    title: '온도관리 기록부',
    icon: '🌡️',
    desc: '냉장·숙성실 온도·습도 기록',
    color: colors.cyan,
    getHTML: () => {
      const rows = tempData.map(r => `<tr>
        <td>${r.date} ${r.time}</td>
        <td>${r.person}</td>
        <td class="${r.temp > 4 ? 'warn' : 'ok'}">${r.temp}°C</td>
        <td>${r.humidity}%</td>
        <td class="${r.status === 'warn' ? 'warn' : 'ok'}">${r.status === 'warn' ? '⚠ 주의' : '✓ 정상'}</td>
        <td>${r.note}</td>
      </tr>`).join('');
      return `<html><head><style>${PDF_STYLE}</style></head><body>
        <h1>🌡️ 온도관리 기록부</h1>
        <div class="meta">출력일: ${new Date().toLocaleDateString('ko-KR')}</div>
        <table><thead><tr><th>일시</th><th>측정자</th><th>온도</th><th>습도</th><th>상태</th><th>비고</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="footer">MeatBig — 자동 생성 문서</div>
      </body></html>`;
    },
  },
  {
    id: 'aging',
    title: '숙성 관리 대장',
    icon: '🥩',
    desc: '드라이에이징 이력 및 수율 기록',
    color: colors.a2,
    getHTML: () => {
      const rows = agingData.map(i => {
        const pct = Math.min(100, Math.round((i.day / i.targetDay) * 100));
        const yld = (i.weight / i.initWeight * 100).toFixed(1);
        return `<tr>
          <td style="font-family:monospace;font-size:11px">${i.trace}</td>
          <td><strong>${i.cut}</strong></td>
          <td>${i.grade}등급</td>
          <td>${i.origin}</td>
          <td>${i.day}일 / ${i.targetDay}일 (${pct}%)</td>
          <td>${yld}%</td>
          <td>${i.temp}°C / ${i.humidity}%</td>
          <td class="${i.status === 'done' ? 'ok' : 'warn'}">${i.status === 'done' ? '✓ 완성' : '숙성 중'}</td>
        </tr>`;
      }).join('');
      return `<html><head><style>${PDF_STYLE}</style></head><body>
        <h1>🥩 숙성 관리 대장</h1>
        <div class="meta">출력일: ${new Date().toLocaleDateString('ko-KR')} | 총 ${agingData.length}건</div>
        <table><thead><tr><th>이력번호</th><th>부위</th><th>등급</th><th>원산지</th><th>숙성진행</th><th>수율</th><th>온도/습도</th><th>상태</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="footer">MeatBig — 자동 생성 문서</div>
      </body></html>`;
    },
  },
  {
    id: 'staff',
    title: '직원 보건증 현황',
    icon: '👥',
    desc: '보건증·위생교육 이수증 만료일',
    color: colors.pu,
    getHTML: () => {
      const rows = staffData.map(s => `<tr>
        <td>${s.name}</td>
        <td>${s.role}</td>
        <td class="${s.status === 'expired' ? 'warn' : 'ok'}">${s.health}</td>
        <td class="ok">${s.edu}</td>
        <td class="${s.status === 'expired' ? 'warn' : 'ok'}">${s.status === 'expired' ? '⚠ 갱신 필요' : '✓ 정상'}</td>
      </tr>`).join('');
      return `<html><head><style>${PDF_STYLE}</style></head><body>
        <h1>👥 직원 보건증 현황</h1>
        <div class="meta">출력일: ${new Date().toLocaleDateString('ko-KR')}</div>
        <table><thead><tr><th>이름</th><th>역할</th><th>보건증 만료</th><th>위생교육 만료</th><th>상태</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="footer">MeatBig — 자동 생성 문서</div>
      </body></html>`;
    },
  },
];

const PERIODS = ['이번 주', '이번 달', '전체'];

async function printDoc(doc) {
  try {
    const html = doc.getHTML();
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${doc.title}.pdf` });
    } else {
      Alert.alert('저장 완료', 'PDF가 저장되었습니다.');
    }
  } catch (e) {
    Alert.alert('오류', 'PDF 생성 중 오류가 발생했습니다.');
  }
}

export default function DocumentScreen({ navigation }) {
  const [period, setPeriod] = useState('이번 달');

  return (
    <View style={styles.container}>
      {/* 기간 필터 */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text style={styles.hint}>아래 서류를 PDF로 출력·공유할 수 있습니다</Text>

        {DOCS.map(doc => (
          <View key={doc.id} style={styles.docCard}>
            <View style={[styles.docIconBox, { backgroundColor: doc.color + '20' }]}>
              <Text style={{ fontSize: 34 }}>{doc.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docTitle}>{doc.title}</Text>
              <Text style={styles.docDesc}>{doc.desc}</Text>
            </View>
            <TouchableOpacity style={[styles.printBtn, { backgroundColor: doc.color }]}
              onPress={() => printDoc(doc)}>
              <Text style={styles.printBtnText}>PDF</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 바로가기 */}
        <Text style={styles.sectionLabel}>점검 입력 바로가기</Text>
        <View style={styles.shortcutRow}>
          <Shortcut icon="🧼" label="위생 일지" onPress={() => navigation.navigate('Hygiene')} />
          <Shortcut icon="🌡️" label="온도 기록" onPress={() => navigation.navigate('Temp')} />
          <Shortcut icon="💰" label="마감 정산" onPress={() => navigation.navigate('Closing')} />
        </View>
      </ScrollView>
    </View>
  );
}

const Shortcut = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.8}>
    <Text style={{ fontSize: 30 }}>{icon}</Text>
    <Text style={styles.shortcutLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  periodRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  periodBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.bd, alignItems: 'center', backgroundColor: colors.s1 },
  periodBtnActive: { backgroundColor: colors.ac, borderColor: colors.ac },
  periodText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },
  periodTextActive: { color: '#fff', fontWeight: '900' },

  hint: { fontSize: fontSize.xs, color: colors.t3, marginBottom: spacing.md },

  docCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  docIconBox: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: 4 },
  docDesc: { fontSize: fontSize.xs, color: colors.t3 },
  printBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  printBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '900' },

  sectionLabel: { fontSize: fontSize.xs, color: colors.t3, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 1 },
  shortcutRow: { flexDirection: 'row', gap: spacing.sm },
  shortcut: { flex: 1, backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, alignItems: 'center', gap: 8, ...shadow.sm },
  shortcutLabel: { fontSize: fontSize.xs, color: colors.t2, fontWeight: '700', textAlign: 'center' },
});
