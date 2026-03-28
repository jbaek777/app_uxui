import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, TextInput,
} from 'react-native';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { OXPair } from '../components/OXButton';
import { hygieneData as initData } from '../data/mockData';
import { hygieneStore } from '../lib/dataStore';

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
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [logs, setLogs] = useState(initData);
  const [loaded, setLoaded] = useState(false);
  const isFirst = useRef(true);

  useEffect(() => {
    hygieneStore.load(initData).then(data => {
      setLogs(data);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (loaded) hygieneStore.save(logs);
  }, [logs]);

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
    hygieneStore.addLog(newLog);
    setModal(false);
    Alert.alert('점검 완료 ✓', `${session} 위생점검이 저장되었습니다.\n점검자: ${inspector.trim()}`);
  };

  const pass = logs.filter(l => l.status === 'pass').length;
  const passCount = logs.filter(l => l.status === 'pass').length;
  const hygieneScore = logs.length === 0 ? '--' : Math.round((passCount / logs.length) * 100);

  const todayStr = new Date().toLocaleDateString('ko-KR');

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
      <View style={styles.statRow}>
        <StatBox value={`${logs.length}건`} label="이번 달" color={pal.a2} pal={pal} />
        <StatBox value={`${pass}건`} label="적합 판정" color={pal.gn} pal={pal} />
        <StatBox value={logs.length === 0 ? '--점' : `${hygieneScore}점`} label="위생 점수" color={pal.ac} pal={pal} />
      </View>

      {/* 오늘 세션 현황 */}
      <View style={styles.todayRow}>
        {SESSIONS.map(s => {
          const done = logs.find(l => l.session === s && (l.date === todayStr || l.log_date === todayStr));
          return (
            <View key={s} style={[styles.sessionCard, { borderColor: done ? pal.gn + '70' : pal.bd, backgroundColor: pal.s1 }]}>
              <Text style={{ fontSize: 20 }}>{s === '오전' ? '🌅' : s === '오후' ? '☀️' : '🌙'}</Text>
              <Text style={[styles.sessionLabel, { color: done ? pal.gn : pal.t3 }]}>
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
          <View key={log.id} style={[styles.logCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <View style={styles.logTop}>
              <View>
                <Text style={[styles.logDate, { color: pal.tx }]}>{log.date} {log.time}</Text>
                <Text style={[styles.logMeta, { color: pal.t3 }]}>{log.session} 점검 · {log.inspector}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: log.status === 'pass' ? pal.gn + '20' : pal.yw + '20' }]}>
                <Text style={[styles.badgeText, { color: log.status === 'pass' ? pal.gn : pal.yw }]}>
                  {log.status === 'pass' ? '✓ 적합' : '⚠ 주의'}
                </Text>
              </View>
            </View>
            <View style={{ gap: 3, marginTop: spacing.sm }}>
              {log.items.slice(0, 3).map((item, i) => (
                <Text key={i} style={[styles.logItem, { color: pal.t2 }]}>• {item}</Text>
              ))}
              {log.items.length > 3 && <Text style={[styles.logMore, { color: pal.t3 }]}>+ {log.items.length - 3}개 더</Text>}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 점검 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: pal.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>위생·HACCP 점검</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === 0 && (
            <View style={styles.stepWrap}>
              <Text style={[styles.stepTitle, { color: pal.tx }]}>점검 시간을{'\n'}선택하세요</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                {SESSIONS.map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.sessionSelectBtn, { backgroundColor: pal.s1, borderColor: session === s ? pal.ac : pal.bd }, session === s && { backgroundColor: pal.ac + '15' }]}
                    onPress={() => setSession(s)}>
                    <Text style={{ fontSize: 36 }}>{s === '오전' ? '🌅' : s === '오후' ? '☀️' : '🌙'}</Text>
                    <Text style={[styles.sessionSelectText, { color: session === s ? pal.ac : pal.t2 }]}>{s} 점검</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <PrimaryBtn label="시작 →" onPress={() => setStep(1)} style={{ marginTop: spacing.xl }} />
            </View>
          )}

          {step === 1 && (
            <>
              <View style={[styles.progressWrap, { backgroundColor: pal.bd }]}>
                <View style={[styles.progressFill, { width: `${(doneItems / totalItems) * 100}%`, backgroundColor: pal.ac }]} />
              </View>
              <Text style={[styles.progressText, { color: pal.t3 }]}>{doneItems} / {totalItems} 완료</Text>

              <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
                {CHECKLIST.map(item => (
                  <View key={item.key} style={[styles.checkItem, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                    <View style={styles.checkLeft}>
                      <Text style={{ fontSize: 30 }}>{item.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.checkLabel, { color: pal.tx }]}>{item.label}</Text>
                        <Text style={[styles.checkDesc, { color: pal.t3 }]}>{item.desc}</Text>
                      </View>
                    </View>
                    <OXPair value={checks[item.key]} onChange={val => setChecks(p => ({ ...p, [item.key]: val }))} />
                  </View>
                ))}

                <View style={[styles.tempBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                  <Text style={[styles.tempTitle, { color: pal.tx }]}>🌡️ 냉장고 실측 온도 (°C)</Text>
                  <View style={styles.tempBtns}>
                    {['1', '2', '3', '4', '5+'].map(t => (
                      <TouchableOpacity key={t}
                        style={[styles.tempBtn, { borderColor: fridgeTemp === t ? pal.cyan : pal.bd, backgroundColor: fridgeTemp === t ? pal.cyan : pal.s2 }]}
                        onPress={() => setFridgeTemp(t)}>
                        <Text style={[styles.tempBtnText, { color: fridgeTemp === t ? '#fff' : pal.t2 }, fridgeTemp === t && { fontWeight: '900' }]}>
                          {t === '5+' ? '5°C↑' : `${t}°C`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 점검자 이름 입력 */}
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

                <PrimaryBtn
                  label={doneItems >= totalItems ? '✓ 점검 완료 — 저장하기' : `${totalItems - doneItems}개 항목이 남았습니다`}
                  onPress={doneItems >= totalItems ? handleSave : undefined}
                  color={doneItems >= totalItems ? pal.gn : pal.t3}
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

const StatBox = ({ value, label, color, pal }) => (
  <View style={[styles.statBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
    <Text style={[styles.statVal, { color }]}>{value}</Text>
    <Text style={[styles.statLbl, { color: pal.t3 }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  statRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statBox: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, alignItems: 'center', ...shadow.sm },
  statVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 3 },
  statLbl: { fontSize: fontSize.xxs, fontWeight: '600', textAlign: 'center' },

  todayRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sessionCard: { flex: 1, borderRadius: radius.sm, borderWidth: 1.5, padding: spacing.sm, alignItems: 'center', gap: 4 },
  sessionLabel: { fontSize: fontSize.sm, fontWeight: '700' },

  logCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logDate: { fontSize: fontSize.md, fontWeight: '700', marginBottom: 3 },
  logMeta: { fontSize: fontSize.xs },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: fontSize.xs, fontWeight: '800' },
  logItem: { fontSize: fontSize.xs },
  logMore: { fontSize: fontSize.xs, fontStyle: 'italic' },

  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900' },
  closeBtn: { fontSize: 22, padding: 4 },

  stepWrap: { flex: 1, padding: spacing.lg },
  stepTitle: { fontSize: fontSize.xxl, fontWeight: '900', lineHeight: 44, marginTop: spacing.lg },
  sessionSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, borderWidth: 2, padding: spacing.lg, ...shadow.sm },
  sessionSelectText: { fontSize: fontSize.lg, fontWeight: '800' },

  progressWrap: { height: 6, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: fontSize.xs, textAlign: 'right', paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: spacing.sm },

  checkItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  checkLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, marginRight: spacing.sm },
  checkLabel: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 3 },
  checkDesc: { fontSize: fontSize.xs },

  tempBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  tempTitle: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: spacing.sm },
  tempBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tempBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1.5 },
  tempBtnText: { fontSize: fontSize.sm, fontWeight: '700' },

  inspectorBox: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginTop: spacing.md },
  inspectorLabel: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: spacing.sm },
  inspectorInput: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: fontSize.md, minHeight: 52 },
});
