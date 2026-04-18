import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { C, F, R, SH } from '../lib/v5';
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
    Alert.alert('저장 완료', '교육일지가 저장되었습니다.');
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
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* V5 Header */}
      <View style={styles.v5Header}>
        <View style={styles.v5HeaderAccent} />
        <View style={styles.v5HeaderContent}>
          <View style={styles.v5HeaderIcon}>
            <Ionicons name="school-outline" size={18} color={C.white} />
          </View>
          <Text style={styles.v5HeaderTitle}>위생 교육</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 16 }}>
        <PrimaryBtn label="교육일지 작성" onPress={openModal} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {logs.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: C.white, borderColor: C.border }]}>
            <View style={{ width: 48, height: 48, borderRadius: R.md, backgroundColor: C.redS, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Ionicons name="book-outline" size={26} color={C.red} />
            </View>
            <Text style={[styles.emptyTitle, { color: C.t1 }]}>아직 교육일지가 없습니다</Text>
            <Text style={[styles.emptyDesc, { color: C.t3 }]}>월 1회 직원 위생교육 기록을 작성하세요</Text>
          </View>
        )}
        {logs.map(log => (
          <View key={log.id} style={[styles.logCard, { backgroundColor: C.white, borderColor: C.border }]}>
            <View style={styles.logTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logDate, { color: C.t1 }]}>{log.date}</Text>
                <Text style={[styles.logMeta, { color: C.t3 }]}>대상: {log.attendees}</Text>
                <Text style={[styles.logTopics, { color: C.t2 }]} numberOfLines={2}>
                  {log.topics.join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <TouchableOpacity style={[styles.pdfBtn, { backgroundColor: C.redS, borderColor: C.red2 + '40' }]} onPress={() => handleExportPDF(log)}>
                  <Ionicons name="document-text-outline" size={14} color={C.red2} style={{ marginRight: 4 }} />
                  <Text style={[styles.pdfBtnText, { color: C.red2 }]}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(log.id)}>
                  <Ionicons name="trash-outline" size={20} color={C.t3} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 작성 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: C.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: C.white, borderBottomColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.t1 }]}>영업자 자체위생교육 실시</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Ionicons name="close" size={24} color={C.t2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            {/* 교육일시 */}
            <FieldLabel label="교육일시" />
            <TextInput
              style={[styles.input, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
              value={date}
              onChangeText={setDate}
              placeholder="예: 2026.04.01"
              placeholderTextColor={C.t3}
            />

            {/* 교육대상 */}
            <FieldLabel label="교육대상" />
            <TextInput
              style={[styles.input, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
              value={attendees}
              onChangeText={setAttendees}
              placeholder="예: 전 직원, 홍길동·이영희"
              placeholderTextColor={C.t3}
            />

            {/* 교육내용 */}
            <FieldLabel label="교육내용" />
            <Text style={[styles.fieldHint, { color: C.t3 }]}>항목을 탭하여 선택/해제</Text>
            <View style={styles.topicList}>
              {DEFAULT_TOPICS.map(topic => {
                const selected = selectedTopics.includes(topic);
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.topicChip, {
                      backgroundColor: selected ? C.redS : C.white,
                      borderColor: selected ? C.red : C.border,
                    }]}
                    onPress={() => toggleTopic(topic)}
                    activeOpacity={0.75}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color={C.red} style={{ marginRight: 4 }} />}
                    <Text style={[styles.topicChipText, { color: selected ? C.red : C.t2, fontWeight: selected ? '800' : '500' }]}>
                      {topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {/* 사용자 추가 항목 */}
              {selectedTopics.filter(t => !DEFAULT_TOPICS.includes(t)).map(topic => (
                <TouchableOpacity
                  key={topic}
                  style={[styles.topicChip, { backgroundColor: C.okS, borderColor: C.ok2 }]}
                  onPress={() => toggleTopic(topic)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="checkmark" size={14} color={C.ok2} style={{ marginRight: 4 }} />
                  <Text style={[styles.topicChipText, { color: C.ok2, fontWeight: '800' }]}>{topic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 직접 추가 */}
            <View style={styles.customRow}>
              <TextInput
                style={[styles.customInput, { backgroundColor: C.white, borderColor: C.border, color: C.t1, flex: 1 }]}
                value={customTopic}
                onChangeText={setCustomTopic}
                placeholder="직접 입력 후 추가"
                placeholderTextColor={C.t3}
                onSubmitEditing={addCustomTopic}
                returnKeyType="done"
              />
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.red }]} onPress={addCustomTopic}>
                <Text style={styles.addBtnText}>추가</Text>
              </TouchableOpacity>
            </View>

            {selectedTopics.length > 0 && (
              <View style={[styles.selectedBox, { backgroundColor: C.white, borderColor: C.ok2 + '40' }]}>
                <Text style={[styles.selectedTitle, { color: C.ok2 }]}>선택된 교육내용 ({selectedTopics.length}개)</Text>
                {selectedTopics.map((t, i) => (
                  <View key={t} style={styles.selectedRow}>
                    <Text style={[styles.selectedText, { color: C.t1 }]}>{i + 1}. {t}</Text>
                    <TouchableOpacity onPress={() => toggleTopic(t)}>
                      <Ionicons name="close-circle-outline" size={20} color={C.t3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* 기타사항 */}
            <FieldLabel label="기타사항 (선택)" />
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="특이사항이나 추가 내용을 입력하세요"
              placeholderTextColor={C.t3}
              multiline
              numberOfLines={3}
            />

            <PrimaryBtn label="저장하기" onPress={handleSave} style={{ marginTop: 24 }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ label }) {
  return <Text style={[styles.fieldLabel, { color: C.t1 }]}>{label}</Text>;
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

  // V5 Header
  v5Header: { backgroundColor: C.white, ...SH.sm },
  v5HeaderAccent: { height: 3, backgroundColor: C.red },
  v5HeaderContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  v5HeaderIcon: { width: 33, height: 33, borderRadius: R.sm, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  v5HeaderTitle: { fontSize: 22, fontWeight: '900', color: C.t1 },

  emptyBox: { borderRadius: R.lg, borderWidth: 1, padding: 32, alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: F.body, fontWeight: '800', marginBottom: 6 },
  emptyDesc: { fontSize: F.sm, textAlign: 'center' },

  logCard: { borderRadius: R.md, borderWidth: 1, padding: 16, marginBottom: 8, ...SH.sm },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  logDate: { fontSize: F.body, fontWeight: '700', marginBottom: 3 },
  logMeta: { fontSize: F.xs, marginBottom: 3 },
  logTopics: { fontSize: F.xs },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  pdfBtnText: { fontSize: F.xs, fontWeight: '800' },

  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1 },
  modalTitle: { fontSize: F.h3, fontWeight: '900' },

  fieldLabel: { fontSize: F.body, fontWeight: '800', marginTop: 24, marginBottom: 8 },
  fieldHint: { fontSize: F.xxs, marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 14, fontSize: F.body, minHeight: 52 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  topicList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  topicChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  topicChipText: { fontSize: F.sm },

  customRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  customInput: { borderWidth: 1.5, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 12, fontSize: F.sm },
  addBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.sm, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: F.sm },

  selectedBox: { borderRadius: R.md, borderWidth: 1.5, padding: 16, marginBottom: 16 },
  selectedTitle: { fontSize: F.sm, fontWeight: '800', marginBottom: 8 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  selectedText: { fontSize: F.sm, flex: 1 },
});
