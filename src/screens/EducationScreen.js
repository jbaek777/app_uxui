import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, TextInput,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { educationStore } from '../lib/dataStore';

const DEFAULT_TOPICS = [
  '개인위생 및 손 씻기',
  '음식물 섭취 및 흡연 금지',
  '위생장비 세척 및 소독',
  '유통기한 관리 및 선입선출',
  '냉장고 온도 관리',
  '실내 환기 및 청소',
  '위생복 착용 수칙',
  '바닥 청소 및 배수로 관리',
  '거래명세서 작성 방법',
  '방역 및 소독 절차',
  '손 세척 시점 및 방법',
];

export default function EducationScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;

  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(false);

  // Form state
  const [date, setDate] = useState('');
  const [attendees, setAttendees] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [notes, setNotes] = useState('');
  const [customTopic, setCustomTopic] = useState('');

  useEffect(() => {
    educationStore.load().then(data => setLogs(data));
  }, []);

  const openModal = () => {
    const now = new Date();
    setDate(`${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`);
    setAttendees('');
    setSelectedTopics([]);
    setNotes('');
    setCustomTopic('');
    setModal(true);
  };

  const toggleTopic = (topic) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const addCustomTopic = () => {
    const t = customTopic.trim();
    if (!t) return;
    if (!selectedTopics.includes(t)) setSelectedTopics(prev => [...prev, t]);
    setCustomTopic('');
  };

  const handleSave = async () => {
    if (!date.trim()) { Alert.alert('입력 오류', '교육일시를 입력해주세요.'); return; }
    if (!attendees.trim()) { Alert.alert('입력 오류', '교육대상을 입력해주세요.'); return; }
    if (selectedTopics.length === 0) { Alert.alert('입력 오류', '교육내용을 1개 이상 선택해주세요.'); return; }

    const newLog = {
      id: Date.now().toString(),
      date: date.trim(),
      attendees: attendees.trim(),
      topics: [...selectedTopics],
      notes: notes.trim(),
    };
    const updated = await educationStore.add(newLog);
    setLogs(updated);
    setModal(false);
    Alert.alert('저장 완료 ✓', '교육일지가 저장되었습니다.');
  };

  const handleExportPDF = async (log) => {
    try {
      const html = genEducationHTML(log);
      const { uri: tmpUri } = await Print.printToFileAsync({ html, base64: false });
      const d = new Date();
      const datePrefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const filename = `${datePrefix}_교육일지.pdf`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({ from: tmpUri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: filename });
    } catch (e) {
      Alert.alert('오류', 'PDF 내보내기에 실패했습니다.');
    }
  };

  const handleDelete = (id) => {
    Alert.alert('삭제 확인', '이 교육일지를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        const updated = await educationStore.delete(id);
        setLogs(updated);
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md }}>
        <PrimaryBtn label="📝 교육일지 작성" onPress={openModal} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {logs.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>📚</Text>
            <Text style={[styles.emptyTitle, { color: pal.tx }]}>아직 교육일지가 없습니다</Text>
            <Text style={[styles.emptyDesc, { color: pal.t3 }]}>월 1회 직원 위생교육 기록을 작성하세요</Text>
          </View>
        )}
        {logs.map(log => (
          <View key={log.id} style={[styles.logCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <View style={styles.logTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logDate, { color: pal.tx }]}>{log.date}</Text>
                <Text style={[styles.logMeta, { color: pal.t3 }]}>대상: {log.attendees}</Text>
                <Text style={[styles.logTopics, { color: pal.t2 }]} numberOfLines={2}>
                  {log.topics.join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <TouchableOpacity style={[styles.pdfBtn, { backgroundColor: pal.a2 + '15', borderColor: pal.a2 + '40' }]} onPress={() => handleExportPDF(log)}>
                  <Text style={[styles.pdfBtnText, { color: pal.a2 }]}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(log.id)}>
                  <Text style={{ color: pal.t3, fontSize: 18 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 작성 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: pal.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>영업자 자체위생교육 실시</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
            {/* 교육일시 */}
            <FieldLabel label="교육일시" pal={pal} />
            <TextInput
              style={[styles.input, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              value={date}
              onChangeText={setDate}
              placeholder="예: 2026.04.01"
              placeholderTextColor={pal.t3}
            />

            {/* 교육대상 */}
            <FieldLabel label="교육대상" pal={pal} />
            <TextInput
              style={[styles.input, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              value={attendees}
              onChangeText={setAttendees}
              placeholder="예: 전 직원, 홍길동·이영희"
              placeholderTextColor={pal.t3}
            />

            {/* 교육내용 */}
            <FieldLabel label="교육내용" pal={pal} />
            <Text style={[styles.fieldHint, { color: pal.t3 }]}>항목을 탭하여 선택/해제</Text>
            <View style={styles.topicList}>
              {DEFAULT_TOPICS.map(topic => {
                const selected = selectedTopics.includes(topic);
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.topicChip, {
                      backgroundColor: selected ? pal.ac + '20' : pal.s1,
                      borderColor: selected ? pal.ac : pal.bd,
                    }]}
                    onPress={() => toggleTopic(topic)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.topicChipText, { color: selected ? pal.ac : pal.t2, fontWeight: selected ? '800' : '500' }]}>
                      {selected ? '✓ ' : ''}{topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {/* 사용자 추가 항목 */}
              {selectedTopics.filter(t => !DEFAULT_TOPICS.includes(t)).map(topic => (
                <TouchableOpacity
                  key={topic}
                  style={[styles.topicChip, { backgroundColor: pal.gn + '20', borderColor: pal.gn }]}
                  onPress={() => toggleTopic(topic)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.topicChipText, { color: pal.gn, fontWeight: '800' }]}>✓ {topic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 직접 추가 */}
            <View style={styles.customRow}>
              <TextInput
                style={[styles.customInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx, flex: 1 }]}
                value={customTopic}
                onChangeText={setCustomTopic}
                placeholder="직접 입력 후 추가"
                placeholderTextColor={pal.t3}
                onSubmitEditing={addCustomTopic}
                returnKeyType="done"
              />
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: pal.ac }]} onPress={addCustomTopic}>
                <Text style={styles.addBtnText}>추가</Text>
              </TouchableOpacity>
            </View>

            {selectedTopics.length > 0 && (
              <View style={[styles.selectedBox, { backgroundColor: pal.s1, borderColor: pal.gn + '40' }]}>
                <Text style={[styles.selectedTitle, { color: pal.gn }]}>선택된 교육내용 ({selectedTopics.length}개)</Text>
                {selectedTopics.map((t, i) => (
                  <View key={t} style={styles.selectedRow}>
                    <Text style={[styles.selectedText, { color: pal.tx }]}>{i + 1}. {t}</Text>
                    <TouchableOpacity onPress={() => toggleTopic(t)}>
                      <Text style={{ color: pal.t3 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* 기타사항 */}
            <FieldLabel label="기타사항 (선택)" pal={pal} />
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="특이사항이나 추가 내용을 입력하세요"
              placeholderTextColor={pal.t3}
              multiline
              numberOfLines={3}
            />

            <PrimaryBtn label="✓ 저장하기" onPress={handleSave} style={{ marginTop: spacing.lg }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ label, pal }) {
  return <Text style={[styles.fieldLabel, { color: pal.tx }]}>{label}</Text>;
}

// ── PDF 생성 ─────────────────────────────────────────────────
function genEducationHTML(log) {
  const topicRows = log.topics.map((t, i) =>
    `<tr><td style="padding:5px 8px;border:1px solid #ddd;">${i + 1}. ${t}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; padding: 32px; color: #111; }
    h2 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 8px; }
    .sub { text-align: center; font-size: 12px; color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f1f5f9; font-size: 12px; font-weight: bold; padding: 8px; border: 1px solid #ddd; text-align: left; width: 160px; }
    td { font-size: 13px; padding: 8px; border: 1px solid #ddd; }
    .section-title { font-weight: bold; font-size: 13px; background: #f8fafc; }
  </style></head><body>
  <h2>영업자 자체위생교육 실시</h2>
  <p class="sub">작성일: ${new Date().toLocaleDateString('ko-KR')}</p>
  <table>
    <tr><th>교육일시</th><td>${log.date}</td></tr>
    <tr><th>교육대상</th><td>${log.attendees}</td></tr>
  </table>
  <table>
    <tr><th class="section-title" colspan="1">교육내용</th></tr>
    ${topicRows}
  </table>
  ${log.notes ? `<table><tr><th>기타사항</th><td>${log.notes}</td></tr></table>` : ''}
  <p style="margin-top:40px;text-align:right;font-size:12px;">교육실시자 서명: ___________________</p>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyBox: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 6 },
  emptyDesc: { fontSize: fontSize.sm, textAlign: 'center' },

  logCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  logDate: { fontSize: fontSize.md, fontWeight: '700', marginBottom: 3 },
  logMeta: { fontSize: fontSize.xs, marginBottom: 3 },
  logTopics: { fontSize: fontSize.xs },
  pdfBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  pdfBtnText: { fontSize: 12, fontWeight: '800' },

  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.md, fontWeight: '900' },
  closeBtn: { fontSize: 22, padding: 4 },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm },
  fieldHint: { fontSize: 11, marginBottom: spacing.sm },
  input: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: fontSize.md, minHeight: 52 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  topicList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  topicChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  topicChipText: { fontSize: 13 },

  customRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  customInput: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.sm },
  addBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.sm, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: fontSize.sm },

  selectedBox: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.md },
  selectedTitle: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: spacing.sm },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  selectedText: { fontSize: fontSize.sm, flex: 1 },
});
