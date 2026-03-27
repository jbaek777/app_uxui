import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { colors, spacing, typography, radius } from '../theme';

const CHECK_ITEMS = [
  { key: 'handWash', label: '손 세척 및 소독' },
  { key: 'apron', label: '앞치마 착용 여부' },
  { key: 'gloves', label: '위생장갑 착용' },
  { key: 'hairNet', label: '두발 위생 (모자/헤어넷)' },
  { key: 'equipClean', label: '도마·칼 소독' },
  { key: 'roomClean', label: '작업장 청소·소독' },
  { key: 'wasteDispose', label: '폐기물 처리' },
  { key: 'tempCheck', label: '냉장고 온도 점검' },
];

const INITIAL_LOGS = [
  {
    id: '1',
    date: '2024-01-28',
    shift: '오전',
    inspector: '김철수',
    checks: { handWash: true, apron: true, gloves: true, hairNet: true, equipClean: true, roomClean: true, wasteDispose: true, tempCheck: true },
    notes: '이상 없음',
    score: 100,
  },
  {
    id: '2',
    date: '2024-01-27',
    shift: '오후',
    inspector: '이영희',
    checks: { handWash: true, apron: true, gloves: false, hairNet: true, equipClean: true, roomClean: false, wasteDispose: true, tempCheck: true },
    notes: '장갑 재고 부족, 작업장 청소 미흡',
    score: 75,
  },
];

function calcScore(checks) {
  const vals = Object.values(checks);
  return Math.round((vals.filter(Boolean).length / vals.length) * 100);
}

function getScoreType(score) {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

export default function HygieneScreen() {
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [form, setForm] = useState({
    shift: '오전',
    inspector: '',
    checks: Object.fromEntries(CHECK_ITEMS.map((c) => [c.key, false])),
    notes: '',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const openAdd = () => {
    setSelectedLog(null);
    setForm({
      shift: '오전',
      inspector: '',
      checks: Object.fromEntries(CHECK_ITEMS.map((c) => [c.key, false])),
      notes: '',
    });
    setModalVisible(true);
  };

  const openDetail = (log) => {
    setSelectedLog(log);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.inspector.trim()) {
      Alert.alert('입력 오류', '점검자를 입력해주세요.');
      return;
    }
    const newLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      ...form,
      score: calcScore(form.checks),
    };
    setLogs((prev) => [newLog, ...prev]);
    setModalVisible(false);
  };

  const handleDelete = (id) => {
    Alert.alert('삭제', '이 일지를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { setLogs((p) => p.filter((l) => l.id !== id)); setModalVisible(false); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>위생일지</Text>
          <Text style={styles.subtitle}>일일 위생 점검 기록</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>작성</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {logs.length === 0 ? (
          <EmptyState icon="clipboard-outline" title="위생일지 없음" message="오늘 위생 점검을 기록해주세요." />
        ) : (
          logs.map((log) => (
            <TouchableOpacity key={log.id} onPress={() => openDetail(log)}>
              <Card style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View>
                    <Text style={styles.logDate}>{log.date}</Text>
                    <Text style={styles.logMeta}>{log.shift}조 · 점검자: {log.inspector}</Text>
                  </View>
                  <View style={styles.scoreWrap}>
                    <Text style={[styles.scoreNum, { color: log.score >= 90 ? colors.status.success : log.score >= 70 ? colors.status.warning : colors.status.danger }]}>
                      {log.score}점
                    </Text>
                    <Badge label={log.score >= 90 ? '우수' : log.score >= 70 ? '양호' : '미흡'} type={getScoreType(log.score)} />
                  </View>
                </View>
                <View style={styles.checkGrid}>
                  {CHECK_ITEMS.map((c) => (
                    <View key={c.key} style={styles.checkItem}>
                      <Ionicons
                        name={log.checks[c.key] ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={log.checks[c.key] ? colors.status.success : colors.status.danger}
                      />
                      <Text style={[styles.checkLabel, !log.checks[c.key] && styles.checkFailed]}>
                        {c.label}
                      </Text>
                    </View>
                  ))}
                </View>
                {log.notes ? (
                  <View style={styles.noteBox}>
                    <Ionicons name="chatbubble-outline" size={12} color={colors.text.tertiary} />
                    <Text style={styles.noteText}>{log.notes}</Text>
                  </View>
                ) : null}
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedLog ? '위생일지 상세' : '위생일지 작성'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
            {selectedLog ? (
              <View>
                <Card style={{ marginBottom: spacing.md }}>
                  <Text style={styles.detailDate}>{selectedLog.date} {selectedLog.shift}조</Text>
                  <Text style={styles.detailInspector}>점검자: {selectedLog.inspector}</Text>
                  <View style={[styles.scoreRow, { marginVertical: spacing.sm }]}>
                    <Text style={styles.formLabel}>종합 점수</Text>
                    <Text style={[styles.scoreNum, { color: selectedLog.score >= 90 ? colors.status.success : selectedLog.score >= 70 ? colors.status.warning : colors.status.danger }]}>
                      {selectedLog.score}점
                    </Text>
                  </View>
                  {CHECK_ITEMS.map((c) => (
                    <View key={c.key} style={styles.detailCheck}>
                      <Ionicons
                        name={selectedLog.checks[c.key] ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={selectedLog.checks[c.key] ? colors.status.success : colors.status.danger}
                      />
                      <Text style={styles.detailCheckLabel}>{c.label}</Text>
                      <Text style={{ ...typography.bodySmall, color: selectedLog.checks[c.key] ? colors.status.success : colors.status.danger, marginLeft: 'auto' }}>
                        {selectedLog.checks[c.key] ? '완료' : '미완료'}
                      </Text>
                    </View>
                  ))}
                  {selectedLog.notes ? (
                    <View style={{ marginTop: spacing.md }}>
                      <Text style={styles.formLabel}>특이사항</Text>
                      <Text style={{ ...typography.body, marginTop: 4 }}>{selectedLog.notes}</Text>
                    </View>
                  ) : null}
                </Card>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(selectedLog.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.status.danger} />
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>근무조</Text>
                    <View style={styles.chipRow}>
                      {['오전', '오후', '야간'].map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.chip, form.shift === s && styles.chipActive]}
                          onPress={() => setForm((p) => ({ ...p, shift: s }))}
                        >
                          <Text style={[styles.chipText, form.shift === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>점검자 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="이름 입력"
                    value={form.inspector}
                    onChangeText={(v) => setForm((p) => ({ ...p, inspector: v }))}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>점검 항목</Text>
                  <Card style={{ gap: 0, padding: 0 }}>
                    {CHECK_ITEMS.map((c, i) => (
                      <View key={c.key} style={[styles.switchRow, i < CHECK_ITEMS.length - 1 && styles.switchBorder]}>
                        <Text style={styles.switchLabel}>{c.label}</Text>
                        <Switch
                          value={form.checks[c.key]}
                          onValueChange={(v) =>
                            setForm((p) => ({ ...p, checks: { ...p.checks, [c.key]: v } }))
                          }
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={form.checks[c.key] ? colors.primary : '#ccc'}
                        />
                      </View>
                    ))}
                  </Card>
                  <Text style={styles.scorePreview}>
                    현재 점수: {calcScore(form.checks)}점
                  </Text>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>특이사항</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="특이사항 또는 조치사항 입력..."
                    value={form.notes}
                    multiline
                    numberOfLines={3}
                    onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>저장</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2 },
  subtitle: { ...typography.bodySmall },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  logCard: { marginBottom: spacing.sm },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  logDate: { ...typography.h4, marginBottom: 2 },
  logMeta: { ...typography.bodySmall },
  scoreWrap: { alignItems: 'flex-end', gap: 4 },
  scoreNum: { fontSize: 20, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '48%' },
  checkLabel: { fontSize: 11, color: colors.text.secondary, flex: 1 },
  checkFailed: { color: colors.status.danger },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, backgroundColor: colors.background, padding: spacing.sm, borderRadius: radius.sm },
  noteText: { ...typography.caption, flex: 1 },
  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.h3 },
  detailDate: { ...typography.h3, marginBottom: 4 },
  detailInspector: { ...typography.bodySmall, marginBottom: spacing.sm },
  detailCheck: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailCheckLabel: { ...typography.body, flex: 1 },
  formGroup: { gap: spacing.xs },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formLabel: { ...typography.bodySmall, fontWeight: '600' },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 15, color: colors.text.primary },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  switchBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  switchLabel: { ...typography.body, flex: 1 },
  scorePreview: { ...typography.bodySmall, color: colors.primary, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.status.danger + '40', backgroundColor: colors.status.danger + '08' },
  deleteBtnText: { color: colors.status.danger, fontWeight: '600', fontSize: 15 },
});
