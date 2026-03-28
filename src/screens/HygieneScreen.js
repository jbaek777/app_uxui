import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, TextInput,
} from 'react-native';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { OXPair } from '../components/OXButton';
import { hygieneData as initData } from '../data/mockData';

const SESSIONS = ['오전', '오후', '마감'];
const CHECKLIST = [
  { key: 'personal',  label: '개인위생',      icon: '🙌', desc: '손 세척·위생복 착용 확인' },
  { key: 'tools',     label: '도마·칼 소독',  icon: '🔪', desc: '200ppm 염소 소독 후 건조' },
  { key: 'fridge',    label: '냉장고 온도',   icon: '🌡️', desc: '10°C 이하 (숙성실 0~4°C)' },
  { key: 'workbench', label: '작업대 청결',   icon: '🪣', desc: '작업 전·후 소독 및 건조' },
  { key: 'pest',      label: '방충·방서',     icon: '🐛', desc: '해충 흔적 없음 확인' },
  { key: 'origin',    label: '원산지 표시판', icon: '🪧', desc: '현재 판매 부위와 일치 확인' },
];

export default function HygieneScreen() {
  const [logs, setLogs] = useState(initData);
  const [modal, setModal] = useState(false);
  const [session, setSession] = useState('오전');
  const [checks, setChecks] = useState({});
  const [fridgeTemp, setFridgeTemp] = useState(null);
  const [step, setStep] = useState(0);
  const [inspector, setInspector] = useState('');

  const totalItems = CHECKLIST.length;
  const doneItems = Object.keys(checks).filter(k => checks[k]).length;

  const openModal = () => {
    setChecks({});
    setFridgeTemp(null);
    setStep(0);
    setInspector('');
    setModal(true);
  };

  const handleSave = () => {
    if (!inspector.trim()) {
      Alert.alert('입력 오류', '점검자 이름을 입력해주세요.');
      return;
    }
    const items = CHECKLIST.map(c => `${c.label} ${checks[c.key] || '?'}`);
    if (fridgeTemp) items.push(`냉장고 온도: ${fridgeTemp}°C`);
    const hasX = Object.values(checks).includes('X');
    const newLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ko-KR'),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      session,
      items,
      status: hasX ? 'warning' : 'pass',
      inspector: inspector.trim(),
    };
    setLogs([newLog, ...logs]);
    setModal(false);
    Alert.alert('점검 완료 ✓', `${session} 위생점검이 저장되었습니다.\n점검자: ${inspector.trim()}`);
  };

  const pass = logs.filter(l => l.status === 'pass').length;

  return (
    <View style={styles.container}>
      <View style={styles.statRow}>
        <StatBox value={`${logs.length}건`} label="이번 달" color={colors.a2} />
        <StatBox value={`${pass}건`} label="적합 판정" color={colors.gn} />
        <StatBox value="94점" label="위생 점수" color={colors.ac} />
      </View>

      {/* 오늘 세션 현황 */}
      <View style={styles.todayRow}>
        {SESSIONS.map(s => {
          const done = logs.find(l => l.session === s);
          return (
            <View key={s} style={[styles.sessionCard, { borderColor: done ? colors.gn + '70' : colors.bd }]}>
              <Text style={{ fontSize: 20 }}>{s === '오전' ? '🌅' : s === '오후' ? '☀️' : '🌙'}</Text>
              <Text style={[styles.sessionLabel, { color: done ? colors.gn : colors.t3 }]}>
                {done ? '✓ ' : ''}{s}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <PrimaryBtn label="📋 지금 점검 시작" onPress={openModal} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        {logs.map(log => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logTop}>
              <View>
                <Text style={styles.logDate}>{log.date} {log.time}</Text>
                <Text style={styles.logMeta}>{log.session} 점검 · {log.inspector}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: log.status === 'pass' ? colors.gn + '20' : colors.yw + '20' }]}>
                <Text style={[styles.badgeText, { color: log.status === 'pass' ? colors.gn : colors.yw }]}>
                  {log.status === 'pass' ? '✓ 적합' : '⚠ 주의'}
                </Text>
              </View>
            </View>
            <View style={{ gap: 3, marginTop: spacing.sm }}>
              {log.items.slice(0, 3).map((item, i) => (
                <Text key={i} style={styles.logItem}>• {item}</Text>
              ))}
              {log.items.length > 3 && <Text style={styles.logMore}>+ {log.items.length - 3}개 더</Text>}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 점검 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>위생·HACCP 점검</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === 0 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>점검 시간을{'\n'}선택하세요</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                {SESSIONS.map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.sessionSelectBtn, session === s && styles.sessionSelectBtnActive]}
                    onPress={() => setSession(s)}>
                    <Text style={{ fontSize: 36 }}>{s === '오전' ? '🌅' : s === '오후' ? '☀️' : '🌙'}</Text>
                    <Text style={[styles.sessionSelectText, session === s && { color: colors.ac }]}>{s} 점검</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <PrimaryBtn label="시작 →" onPress={() => setStep(1)} style={{ marginTop: spacing.xl }} />
            </View>
          )}

          {step === 1 && (
            <>
              <View style={styles.progressWrap}>
                <View style={[styles.progressFill, { width: `${(doneItems / totalItems) * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{doneItems} / {totalItems} 완료</Text>

              <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
                {CHECKLIST.map(item => (
                  <View key={item.key} style={styles.checkItem}>
                    <View style={styles.checkLeft}>
                      <Text style={{ fontSize: 30 }}>{item.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.checkLabel}>{item.label}</Text>
                        <Text style={styles.checkDesc}>{item.desc}</Text>
                      </View>
                    </View>
                    <OXPair value={checks[item.key]} onChange={val => setChecks(p => ({ ...p, [item.key]: val }))} />
                  </View>
                ))}

                <View style={styles.tempBox}>
                  <Text style={styles.tempTitle}>🌡️ 냉장고 실측 온도 (°C)</Text>
                  <View style={styles.tempBtns}>
                    {['1', '2', '3', '4', '5+'].map(t => (
                      <TouchableOpacity key={t}
                        style={[styles.tempBtn, fridgeTemp === t && styles.tempBtnActive]}
                        onPress={() => setFridgeTemp(t)}>
                        <Text style={[styles.tempBtnText, fridgeTemp === t && { color: '#fff', fontWeight: '900' }]}>
                          {t === '5+' ? '5°C↑' : `${t}°C`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 점검자 이름 입력 */}
                <View style={styles.inspectorBox}>
                  <Text style={styles.inspectorLabel}>✍️ 점검자 이름</Text>
                  <TextInput
                    style={styles.inspectorInput}
                    value={inspector}
                    onChangeText={setInspector}
                    placeholder="이름을 입력하세요"
                    placeholderTextColor={colors.t3}
                  />
                </View>

                <PrimaryBtn
                  label={doneItems >= totalItems ? '✓ 점검 완료 — 저장하기' : `${totalItems - doneItems}개 항목이 남았습니다`}
                  onPress={doneItems >= totalItems ? handleSave : undefined}
                  color={doneItems >= totalItems ? colors.gn : colors.t3}
                  style={{ marginTop: spacing.md, opacity: doneItems >= totalItems ? 1 : 0.55 }}
                />
                <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const StatBox = ({ value, label, color }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statVal, { color }]}>{value}</Text>
    <Text style={styles.statLbl}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, alignItems: 'center', ...shadow.sm },
  statVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 3 },
  statLbl: { fontSize: fontSize.xxs, color: colors.t3, fontWeight: '600', textAlign: 'center' },

  todayRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sessionCard: { flex: 1, backgroundColor: colors.s1, borderRadius: radius.sm, borderWidth: 1.5, padding: spacing.sm, alignItems: 'center', gap: 4 },
  sessionLabel: { fontSize: fontSize.sm, fontWeight: '700' },

  logCard: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logDate: { fontSize: fontSize.md, fontWeight: '700', color: colors.tx, marginBottom: 3 },
  logMeta: { fontSize: fontSize.xs, color: colors.t3 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: fontSize.xs, fontWeight: '800' },
  logItem: { fontSize: fontSize.xs, color: colors.t2 },
  logMore: { fontSize: fontSize.xs, color: colors.t3, fontStyle: 'italic' },

  modalWrap: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.bd, backgroundColor: colors.s1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900', color: colors.tx },
  closeBtn: { fontSize: 22, color: colors.t2, padding: 4 },

  stepWrap: { flex: 1, padding: spacing.lg },
  stepTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.tx, lineHeight: 44, marginTop: spacing.lg },
  sessionSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 2, borderColor: colors.bd, padding: spacing.lg, ...shadow.sm },
  sessionSelectBtnActive: { borderColor: colors.ac, backgroundColor: colors.ac + '15' },
  sessionSelectText: { fontSize: fontSize.lg, fontWeight: '800', color: colors.t2 },

  progressWrap: { height: 6, backgroundColor: colors.bd, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.ac, borderRadius: 3 },
  progressText: { fontSize: fontSize.xs, color: colors.t3, textAlign: 'right', paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: spacing.sm },

  checkItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  checkLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, marginRight: spacing.sm },
  checkLabel: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: 3 },
  checkDesc: { fontSize: fontSize.xs, color: colors.t3 },

  tempBox: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm },
  tempTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx, marginBottom: spacing.sm },
  tempBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tempBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.bd, backgroundColor: colors.s2 },
  tempBtnActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  tempBtnText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },

  inspectorBox: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.a2 + '60', padding: spacing.md, marginTop: spacing.md },
  inspectorLabel: { fontSize: fontSize.sm, color: colors.a2, fontWeight: '800', marginBottom: spacing.sm },
  inspectorInput: { backgroundColor: colors.s2, borderWidth: 1.5, borderColor: colors.bd, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: fontSize.md, color: colors.tx, minHeight: 52 },
});
