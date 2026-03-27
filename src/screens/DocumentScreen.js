import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { colors, spacing, typography, radius } from '../theme';

const TABS = ['직원', '서류'];

const INITIAL_EMPLOYEES = [
  { id: '1', name: '김철수', role: '정육사', phone: '010-1234-5678', hireDate: '2022-03-01', status: 'active', cert: '식육처리기능사' },
  { id: '2', name: '이영희', role: '부점장', phone: '010-9876-5432', hireDate: '2020-07-15', status: 'active', cert: '위생사' },
  { id: '3', name: '박민준', role: '아르바이트', phone: '010-5555-4444', hireDate: '2024-01-10', status: 'inactive', cert: '' },
];

const INITIAL_DOCS = [
  { id: '1', title: '영업허가증', category: '허가', issueDate: '2020-01-01', expireDate: '2025-01-01', status: 'valid' },
  { id: '2', title: '식품위생교육 이수증', category: '교육', issueDate: '2024-01-15', expireDate: '2025-01-15', status: 'expiring' },
  { id: '3', title: 'HACCP 인증서', category: '인증', issueDate: '2023-06-01', expireDate: '2024-06-01', status: 'expired' },
];

function docStatus(doc) {
  const today = new Date();
  const expire = new Date(doc.expireDate);
  const days = Math.floor((expire - today) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: '만료', type: 'danger' };
  if (days < 30) return { label: `D-${days}`, type: 'warning' };
  return { label: '유효', type: 'success' };
}

export default function DocumentScreen() {
  const [tab, setTab] = useState(0);
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [documents, setDocuments] = useState(INITIAL_DOCS);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [empForm, setEmpForm] = useState({ name: '', role: '', phone: '', hireDate: '', cert: '' });
  const [docForm, setDocForm] = useState({ title: '', category: '', issueDate: '', expireDate: '' });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const openAdd = () => {
    setSelectedItem(null);
    if (tab === 0) setEmpForm({ name: '', role: '', phone: '', hireDate: '', cert: '' });
    else setDocForm({ title: '', category: '', issueDate: '', expireDate: '' });
    setModalVisible(true);
  };

  const handleSaveEmployee = () => {
    if (!empForm.name.trim()) { Alert.alert('오류', '이름을 입력해주세요.'); return; }
    setEmployees((p) => [{ id: Date.now().toString(), ...empForm, status: 'active' }, ...p]);
    setModalVisible(false);
  };

  const handleSaveDocument = () => {
    if (!docForm.title.trim()) { Alert.alert('오류', '서류명을 입력해주세요.'); return; }
    setDocuments((p) => [{ id: Date.now().toString(), ...docForm, status: 'valid' }, ...p]);
    setModalVisible(false);
  };

  const handleDelete = (type, id) => {
    Alert.alert('삭제', '삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        if (type === 'emp') setEmployees((p) => p.filter((e) => e.id !== id));
        else setDocuments((p) => p.filter((d) => d.id !== id));
        setModalVisible(false);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>서류·직원관리</Text>
          <Text style={styles.subtitle}>직원 및 인허가 서류 관리</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>추가</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === i && styles.tabActive]} onPress={() => setTab(i)}>
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {tab === 0 ? (
          employees.length === 0 ? (
            <EmptyState icon="people-outline" title="직원 없음" message="직원을 추가해주세요." />
          ) : (
            employees.map((emp) => (
              <TouchableOpacity key={emp.id} onPress={() => { setSelectedItem({ type: 'emp', data: emp }); setModalVisible(true); }}>
                <Card style={styles.empCard}>
                  <View style={styles.empAvatar}>
                    <Text style={styles.empAvatarText}>{emp.name[0]}</Text>
                  </View>
                  <View style={styles.empInfo}>
                    <View style={styles.empNameRow}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      <Badge label={emp.status === 'active' ? '재직중' : '퇴직'} type={emp.status === 'active' ? 'success' : 'default'} />
                    </View>
                    <Text style={styles.empRole}>{emp.role}</Text>
                    <View style={styles.empMeta}>
                      <Ionicons name="call-outline" size={12} color={colors.text.tertiary} />
                      <Text style={styles.empMetaText}>{emp.phone}</Text>
                      <Ionicons name="calendar-outline" size={12} color={colors.text.tertiary} style={{ marginLeft: spacing.sm }} />
                      <Text style={styles.empMetaText}>{emp.hireDate} 입사</Text>
                    </View>
                    {emp.cert ? (
                      <View style={styles.certRow}>
                        <Ionicons name="ribbon-outline" size={12} color={colors.primary} />
                        <Text style={styles.certText}>{emp.cert}</Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )
        ) : (
          documents.length === 0 ? (
            <EmptyState icon="document-text-outline" title="서류 없음" message="서류를 추가해주세요." />
          ) : (
            documents.map((doc) => {
              const st = docStatus(doc);
              return (
                <TouchableOpacity key={doc.id} onPress={() => { setSelectedItem({ type: 'doc', data: doc }); setModalVisible(true); }}>
                  <Card style={styles.docCard}>
                    <View style={styles.docIcon}>
                      <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.docInfo}>
                      <View style={styles.docTitleRow}>
                        <Text style={styles.docTitle}>{doc.title}</Text>
                        <Badge label={st.label} type={st.type} />
                      </View>
                      <Badge label={doc.category} type="primary" style={{ marginTop: 4 }} />
                      <View style={styles.docDates}>
                        <Text style={styles.docDateText}>발급: {doc.issueDate}</Text>
                        <Text style={styles.docDateText}>만료: {doc.expireDate}</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedItem
                ? selectedItem.type === 'emp' ? '직원 상세' : '서류 상세'
                : tab === 0 ? '직원 추가' : '서류 추가'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
            {selectedItem ? (
              selectedItem.type === 'emp' ? (
                <View>
                  <Card style={{ marginBottom: spacing.md }}>
                    <View style={[styles.empAvatar, { width: 64, height: 64, borderRadius: 32, marginBottom: spacing.md }]}>
                      <Text style={[styles.empAvatarText, { fontSize: 24 }]}>{selectedItem.data.name[0]}</Text>
                    </View>
                    {[
                      { label: '이름', value: selectedItem.data.name },
                      { label: '역할', value: selectedItem.data.role },
                      { label: '연락처', value: selectedItem.data.phone },
                      { label: '입사일', value: selectedItem.data.hireDate },
                      { label: '자격증', value: selectedItem.data.cert || '없음' },
                      { label: '상태', value: selectedItem.data.status === 'active' ? '재직중' : '퇴직' },
                    ].map((r) => (
                      <View key={r.label} style={styles.detailRow}>
                        <Text style={styles.formLabel}>{r.label}</Text>
                        <Text style={styles.detailValue}>{r.value}</Text>
                      </View>
                    ))}
                  </Card>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete('emp', selectedItem.data.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.status.danger} />
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Card style={{ marginBottom: spacing.md }}>
                    {[
                      { label: '서류명', value: selectedItem.data.title },
                      { label: '분류', value: selectedItem.data.category },
                      { label: '발급일', value: selectedItem.data.issueDate },
                      { label: '만료일', value: selectedItem.data.expireDate },
                      { label: '상태', value: docStatus(selectedItem.data).label },
                    ].map((r) => (
                      <View key={r.label} style={styles.detailRow}>
                        <Text style={styles.formLabel}>{r.label}</Text>
                        <Text style={styles.detailValue}>{r.value}</Text>
                      </View>
                    ))}
                  </Card>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete('doc', selectedItem.data.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.status.danger} />
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : tab === 0 ? (
              <View style={{ gap: spacing.md }}>
                {[
                  { label: '이름 *', key: 'name', placeholder: '홍길동' },
                  { label: '역할', key: 'role', placeholder: '정육사 / 부점장' },
                  { label: '연락처', key: 'phone', placeholder: '010-0000-0000' },
                  { label: '입사일', key: 'hireDate', placeholder: '2024-01-01' },
                  { label: '자격증', key: 'cert', placeholder: '식육처리기능사 등' },
                ].map((f) => (
                  <View key={f.key} style={styles.formGroup}>
                    <Text style={styles.formLabel}>{f.label}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={f.placeholder}
                      value={empForm[f.key]}
                      onChangeText={(v) => setEmpForm((p) => ({ ...p, [f.key]: v }))}
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEmployee}>
                  <Text style={styles.saveBtnText}>저장</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                {[
                  { label: '서류명 *', key: 'title', placeholder: '영업허가증' },
                  { label: '분류', key: 'category', placeholder: '허가 / 인증 / 교육' },
                  { label: '발급일', key: 'issueDate', placeholder: '2024-01-01' },
                  { label: '만료일', key: 'expireDate', placeholder: '2025-01-01' },
                ].map((f) => (
                  <View key={f.key} style={styles.formGroup}>
                    <Text style={styles.formLabel}>{f.label}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={f.placeholder}
                      value={docForm[f.key]}
                      onChangeText={(v) => setDocForm((p) => ({ ...p, [f.key]: v }))}
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDocument}>
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
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.border, borderRadius: radius.lg, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.md },
  tabActive: { backgroundColor: colors.card },
  tabText: { fontSize: 14, fontWeight: '500', color: colors.text.secondary },
  tabTextActive: { color: colors.text.primary, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  empCard: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.md },
  empAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  empAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  empInfo: { flex: 1 },
  empNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  empName: { ...typography.h4 },
  empRole: { ...typography.bodySmall, marginBottom: spacing.xs },
  empMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  empMetaText: { ...typography.caption },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  certText: { fontSize: 11, color: colors.primary, fontWeight: '500' },
  docCard: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.md },
  docIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1 },
  docTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docTitle: { ...typography.h4, flex: 1, marginRight: spacing.sm },
  docDates: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  docDateText: { ...typography.caption },
  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.h3 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  formLabel: { ...typography.bodySmall, fontWeight: '600' },
  detailValue: { ...typography.body, fontWeight: '600' },
  formGroup: { gap: spacing.xs },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 15, color: colors.text.primary },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.status.danger + '40', backgroundColor: colors.status.danger + '08' },
  deleteBtnText: { color: colors.status.danger, fontWeight: '600', fontSize: 15 },
});
