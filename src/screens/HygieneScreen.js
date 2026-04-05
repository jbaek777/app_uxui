import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, TextInput,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { hygieneStore } from '../lib/dataStore';

// ── 자체위생관리점검표 구조 ──────────────────────────────────
const CATEGORIES = [
  {
    id: 'personal',
    label: '개인위생 (공통)',
    icon: '🙌',
    items: [
      '건강상태 (설사, 구토, 발열, 황달, 화농성 상처 등) 이상 없음',
      '청결한 위생복 (위생모, 위생화, 앞치마 등) 착용',
      '손 세척 및 소독 실시',
      '작업 중 음식물 섭취 금지',
      '장신구 (귀걸이, 반지, 시계 등) 착용 금지',
    ],
  },
  {
    id: 'before',
    label: '작업전 위생상태',
    icon: '🔍',
    items: [
      '작업장 바닥, 벽 청결 상태',
      '작업대 및 도마 세척·소독 상태',
      '칼, 갈고리 등 기구류 세척·소독 상태',
      '냉장·냉동 설비 온도 관리 상태 (냉장 0~10°C, 냉동 -18°C 이하)',
      '에어커튼, 방충망 등 방충 시설 정상 작동',
      '원료육 보관 적정 온도 유지 여부',
      '유통기한 경과 또는 부패·변질 제품 없음',
      '세제·소독제 라벨 부착 및 용도 분리 보관',
      '방서 및 해충 흔적 없음',
    ],
  },
  {
    id: 'during',
    label: '작업중 위생상태',
    icon: '⚙️',
    items: [
      '원료육 해동 방법 적절 (냉장 해동 또는 흐르는 물)',
      '교차오염 방지 (원료육·가공품·완제품 분리)',
      '작업 중 이물 혼입 방지',
      '세척수 온도 및 수질 적절',
      '칼·도마 등 기구류 교차오염 방지 (색상 구분 등)',
      '작업 중 부산물·폐기물 적시 처리',
      '냉장·냉동 보관 온도 이탈 여부 확인',
      '위생복 오염 시 즉시 교체',
      '손 세척 주기적 실시 (작업 전, 화장실 사용 후, 오염 후)',
      '내포장재 사전 이물 확인',
    ],
  },
  {
    id: 'after',
    label: '작업후 위생상태',
    icon: '✅',
    items: [
      '작업대, 도마, 칼 등 세척·소독 후 건조',
      '작업장 바닥, 벽, 배수로 청소 및 소독',
      '폐기물 적정 처리 및 처리 용기 세척',
      '냉장·냉동 설비 점검 및 온도 기록',
      '다음 작업 준비 (도구 세척, 소독제 준비 등)',
    ],
  },
];

const OX_OPTIONS = [
  { value: 'O', label: 'O', color: '#22c55e' },
  { value: '△', label: '△', color: '#f59e0b' },
  { value: 'X', label: 'X', color: '#ef4444' },
];

export default function HygieneScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isFirst = useRef(true);

  useEffect(() => {
    hygieneStore.load([]).then(data => {
      setLogs(Array.isArray(data) ? data : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (loaded) hygieneStore.save(logs);
  }, [logs]);

  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(0); // 0=시작, 1-4=카테고리, 5=점검자/완료
  const [checks, setChecks] = useState({}); // { 'personal_0': 'O', ... }
  const [inspector, setInspector] = useState('');

  const openModal = () => {
    setChecks({});
    setInspector('');
    setPage(0);
    setModal(true);
  };

  const setItemCheck = (catId, idx, val) => {
    setChecks(p => ({ ...p, [`${catId}_${idx}`]: val }));
  };

  const catChecks = (cat) => cat.items.map((_, i) => checks[`${cat.id}_${i}`]);

  const isCatDone = (cat) => catChecks(cat).every(v => v !== undefined && v !== null);

  const hasX = Object.values(checks).includes('X');
  const hasDelta = Object.values(checks).includes('△');

  const handleSave = () => {
    if (!inspector.trim()) {
      Alert.alert('입력 오류', '점검자 이름을 입력해주세요.');
      return;
    }
    const allDone = CATEGORIES.every(cat => isCatDone(cat));
    if (!allDone) {
      Alert.alert('입력 오류', '모든 항목을 점검해주세요.');
      return;
    }
    const status = hasX ? 'fail' : hasDelta ? 'warning' : 'pass';
    const items = CATEGORIES.flatMap(cat =>
      cat.items.map((item, i) => `[${checks[`${cat.id}_${i}`] || '?'}] ${item}`)
    );
    const newLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ko-KR'),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      inspector: inspector.trim(),
      checks: { ...checks },
      items,
      status,
    };
    setLogs(prev => [newLog, ...prev]);
    hygieneStore.addLog(newLog);
    setModal(false);
    Alert.alert('점검 완료 ✓', `위생점검이 저장되었습니다.\n결과: ${status === 'pass' ? '✅ 적합' : status === 'warning' ? '⚠ 보통' : '❌ 불량'}`);
  };

  const handleExportPDF = async (log) => {
    try {
      const html = genHygieneLogHTML(log);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: '위생점검표 내보내기' });
    } catch (e) {
      Alert.alert('오류', 'PDF 내보내기에 실패했습니다.');
    }
  };

  const pass = logs.filter(l => l.status === 'pass').length;
  const hygieneScore = logs.length === 0 ? '--' : Math.round((pass / logs.length) * 100);

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
      <View style={styles.statRow}>
        <StatBox value={`${logs.length}건`} label="이번 달" color={pal.a2} pal={pal} />
        <StatBox value={`${pass}건`} label="적합 판정" color={pal.gn} pal={pal} />
        <StatBox value={logs.length === 0 ? '--점' : `${hygieneScore}점`} label="위생 점수" color={pal.ac} pal={pal} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <PrimaryBtn label="📋 자체위생관리점검 시작" onPress={openModal} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {logs.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🧼</Text>
            <Text style={[styles.emptyTitle, { color: pal.tx }]}>아직 점검 기록이 없습니다</Text>
            <Text style={[styles.emptyDesc, { color: pal.t3 }]}>위의 버튼을 눌러 오늘의 위생점검을 시작하세요</Text>
          </View>
        )}
        {logs.map(log => (
          <TouchableOpacity key={log.id} activeOpacity={0.85} onPress={() => handleExportPDF(log)}>
            <View style={[styles.logCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
              <View style={styles.logTop}>
                <View>
                  <Text style={[styles.logDate, { color: pal.tx }]}>{log.date} {log.time}</Text>
                  <Text style={[styles.logMeta, { color: pal.t3 }]}>점검자: {log.inspector}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: log.status === 'pass' ? pal.gn + '20' : log.status === 'warning' ? pal.yw + '20' : pal.rd + '20' }]}>
                  <Text style={[styles.badgeText, { color: log.status === 'pass' ? pal.gn : log.status === 'warning' ? pal.yw : pal.rd }]}>
                    {log.status === 'pass' ? '✅ 적합' : log.status === 'warning' ? '⚠ 보통' : '❌ 불량'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.pdfHint, { color: pal.t3 }]}>탭하여 PDF 내보내기 →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 점검 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: pal.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>
              {page === 0 ? '자체위생관리점검' : page <= CATEGORIES.length ? CATEGORIES[page - 1].label : '점검자 확인'}
            </Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 진행 표시 */}
          {page > 0 && (
            <View style={[styles.progressWrap, { backgroundColor: pal.bd }]}>
              <View style={[styles.progressFill, { width: `${(page / (CATEGORIES.length + 1)) * 100}%`, backgroundColor: pal.ac }]} />
            </View>
          )}

          {/* 시작 화면 */}
          {page === 0 && (
            <View style={styles.stepWrap}>
              <Text style={[styles.stepTitle, { color: pal.tx }]}>자체위생관리{'\n'}점검을 시작합니다</Text>
              <Text style={[styles.stepDesc, { color: pal.t3 }]}>
                총 4단계, 29개 항목을 순서대로 점검합니다.{'\n'}각 항목에 O(양호) / △(보통) / X(불량)을 선택하세요.
              </Text>
              {CATEGORIES.map((cat, i) => (
                <View key={cat.id} style={[styles.stepPreview, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                  <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                  <Text style={[styles.stepPreviewLabel, { color: pal.tx }]}>{i + 1}단계 · {cat.label}</Text>
                  <Text style={[styles.stepPreviewCount, { color: pal.t3 }]}>{cat.items.length}항목</Text>
                </View>
              ))}
              <PrimaryBtn label="점검 시작 →" onPress={() => setPage(1)} style={{ marginTop: spacing.xl }} />
            </View>
          )}

          {/* 카테고리별 점검 */}
          {page >= 1 && page <= CATEGORIES.length && (() => {
            const cat = CATEGORIES[page - 1];
            const done = isCatDone(cat);
            return (
              <>
                <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
                  <Text style={[styles.catDesc, { color: pal.t3 }]}>{cat.icon} {cat.label} — {cat.items.length}개 항목</Text>
                  {cat.items.map((item, i) => {
                    const val = checks[`${cat.id}_${i}`];
                    return (
                      <View key={i} style={[styles.checkItem, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                        <Text style={[styles.checkNum, { color: pal.t3 }]}>{i + 1}</Text>
                        <Text style={[styles.checkLabel, { color: pal.tx, flex: 1 }]}>{item}</Text>
                        <View style={styles.oxRow}>
                          {OX_OPTIONS.map(opt => (
                            <TouchableOpacity
                              key={opt.value}
                              style={[styles.oxBtn, { borderColor: val === opt.value ? opt.color : pal.bd, backgroundColor: val === opt.value ? opt.color + '20' : pal.s2 }]}
                              onPress={() => setItemCheck(cat.id, i, opt.value)}
                            >
                              <Text style={[styles.oxLabel, { color: val === opt.value ? opt.color : pal.t3, fontWeight: val === opt.value ? '900' : '600' }]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                    {page > 1 && (
                      <OutlineBtn label="← 이전" onPress={() => setPage(p => p - 1)} style={{ flex: 1 }} />
                    )}
                    <PrimaryBtn
                      label={done ? (page < CATEGORIES.length ? `다음 단계 →` : '마지막 단계 →') : `${cat.items.filter((_, i) => !checks[`${cat.id}_${i}`]).length}개 남음`}
                      onPress={done ? () => setPage(p => p + 1) : undefined}
                      style={{ flex: 2, opacity: done ? 1 : 0.5 }}
                    />
                  </View>
                </ScrollView>
              </>
            );
          })()}

          {/* 점검자 입력 + 최종 저장 */}
          {page === CATEGORIES.length + 1 && (
            <View style={styles.stepWrap}>
              <Text style={[styles.stepTitle, { color: pal.tx }]}>점검 완료!</Text>
              <View style={styles.resultRow}>
                <ResultChip count={Object.values(checks).filter(v => v === 'O').length} label="양호" color="#22c55e" />
                <ResultChip count={Object.values(checks).filter(v => v === '△').length} label="보통" color="#f59e0b" />
                <ResultChip count={Object.values(checks).filter(v => v === 'X').length} label="불량" color="#ef4444" />
              </View>
              <View style={[styles.inspectorBox, { backgroundColor: pal.s1, borderColor: pal.a2 + '60' }]}>
                <Text style={[styles.inspectorLabel, { color: pal.a2 }]}>✍️ 점검자 이름</Text>
                <TextInput
                  style={[styles.inspectorInput, { backgroundColor: pal.s2, borderColor: pal.bd, color: pal.tx }]}
                  value={inspector}
                  onChangeText={setInspector}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={pal.t3}
                />
              </View>
              <PrimaryBtn label="✓ 저장하기" onPress={handleSave} style={{ marginTop: spacing.lg }} />
              <OutlineBtn label="← 이전으로" onPress={() => setPage(CATEGORIES.length)} style={{ marginTop: spacing.sm }} />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function StatBox({ value, label, color, pal }) {
  return (
    <View style={[styles.statBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={[styles.statLbl, { color: pal.t3 }]}>{label}</Text>
    </View>
  );
}

function ResultChip({ count, label, color }) {
  return (
    <View style={[styles.resultChip, { backgroundColor: color + '15', borderColor: color + '40' }]}>
      <Text style={[styles.resultChipCount, { color }]}>{count}</Text>
      <Text style={[styles.resultChipLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ── PDF 생성 ─────────────────────────────────────────────────
function genHygieneLogHTML(log) {
  const rows = CATEGORIES.flatMap(cat =>
    cat.items.map((item, i) => {
      const val = log.checks?.[`${cat.id}_${i}`] || '?';
      const color = val === 'O' ? '#16a34a' : val === '△' ? '#d97706' : val === 'X' ? '#dc2626' : '#666';
      return `<tr>
        <td style="font-size:11px;padding:5px 6px;border:1px solid #ddd;">${item}</td>
        <td style="text-align:center;font-weight:900;color:${color};border:1px solid #ddd;">${val}</td>
      </tr>`;
    })
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; padding: 24px; color: #111; }
    h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
    .sub { text-align: center; color: #555; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; font-size: 12px; padding: 7px 6px; border: 1px solid #ddd; }
  </style></head><body>
  <h2>자체위생관리점검표</h2>
  <p class="sub">점검일: ${log.date} ${log.time} &nbsp;|&nbsp; 점검자: ${log.inspector}</p>
  <table>
    <tr><th style="width:80%">점검 항목</th><th>결과</th></tr>
    ${rows}
  </table>
  <p style="margin-top:16px;font-size:11px;color:#888;">O: 양호 / △: 보통 / X: 불량</p>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statBox: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, alignItems: 'center', ...shadow.sm },
  statVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 3 },
  statLbl: { fontSize: fontSize.xxs, fontWeight: '600', textAlign: 'center' },

  emptyBox: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 6 },
  emptyDesc: { fontSize: fontSize.sm, textAlign: 'center' },

  logCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logDate: { fontSize: fontSize.md, fontWeight: '700', marginBottom: 3 },
  logMeta: { fontSize: fontSize.xs },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: fontSize.xs, fontWeight: '800' },
  pdfHint: { fontSize: 11, marginTop: 6, textAlign: 'right' },

  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900' },
  closeBtn: { fontSize: 22, padding: 4 },

  progressWrap: { height: 5, overflow: 'hidden' },
  progressFill: { height: 5 },

  stepWrap: { flex: 1, padding: spacing.lg },
  stepTitle: { fontSize: fontSize.xxl, fontWeight: '900', lineHeight: 44, marginTop: spacing.sm, marginBottom: spacing.md },
  stepDesc: { fontSize: fontSize.sm, lineHeight: 22, marginBottom: spacing.lg },
  stepPreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  stepPreviewLabel: { fontSize: fontSize.sm, fontWeight: '700', flex: 1 },
  stepPreviewCount: { fontSize: fontSize.xs },

  catDesc: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: spacing.md },
  checkItem: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkNum: { fontSize: 11, fontWeight: '800', width: 18, textAlign: 'center' },
  checkLabel: { fontSize: 13, lineHeight: 18 },
  oxRow: { flexDirection: 'row', gap: 4 },
  oxBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  oxLabel: { fontSize: 14 },

  resultRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  resultChip: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, alignItems: 'center' },
  resultChipCount: { fontSize: fontSize.xl, fontWeight: '900' },
  resultChipLabel: { fontSize: fontSize.xs, fontWeight: '700', marginTop: 2 },

  inspectorBox: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md },
  inspectorLabel: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: spacing.sm },
  inspectorInput: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: fontSize.md, minHeight: 52 },
});
