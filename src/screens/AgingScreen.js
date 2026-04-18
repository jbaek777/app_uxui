import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { Badge, StatusBadge, ProgressBar, PrimaryBtn, OutlineBtn, AddBtn } from '../components/UI';
import { agingData as initialData } from '../data/mockData';
import { agingApi } from '../lib/supabase';
import { getStoreInfo } from '../lib/dataStore';
import { genAgingHTML, printAndShare } from '../lib/pdfTemplate';
import { scheduleAgingCompleteAlert } from '../utils/notifications';

async function exportAgingPDF(items) {
  await printAndShare(genAgingHTML(items), '숙성관리대장');
}

const GRADES = ['1++', '1+', '1', '2', '3'];
const ORIGINS = ['국내산(한우)', '국내산(육우)', '미국산', '호주산'];
const TARGET_DAYS = ['14', '21', '28', '35', '45', '60'];

export default function AgingScreen() {
  const [items, setItems] = useState(initialData);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
  const [listTab, setListTab] = useState('active'); // 'active' | 'done'
  const [form, setForm] = useState({ cut: '', grade: '1+', origin: '국내산(한우)', weight: '', targetDay: '28', temp: '', humidity: '', notes: '' });

  useEffect(() => {
    agingApi.getAll().then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        setItems(data.map(r => ({
          id: r.id, cut: r.cut, grade: r.grade, origin: r.origin,
          trace: r.trace, startDate: r.start_date, day: r.day,
          targetDay: r.target_day, temp: r.temp, humidity: r.humidity,
          weight: r.weight, initWeight: r.init_weight,
          status: r.status, notes: r.notes,
        })));
      }
    }).catch(() => {});
  }, []);

  const pct = item => (!item.targetDay ? 0 : Math.min(100, Math.round((item.day / item.targetDay) * 100)));
  const yieldPct = item => (item.initWeight > 0 ? (item.weight / item.initWeight * 100).toFixed(1) : '100.0');

  const handleSave = async () => {
    if (!form.cut) { Alert.alert('입력 오류', '부위명을 입력해주세요.'); return; }
    const w = parseFloat(form.weight) || 0;
    const newItem = {
      id: Date.now().toString(), cut: form.cut, grade: form.grade,
      trace: `HN-${Date.now().toString().slice(-8)}`, origin: form.origin,
      startDate: new Date().toLocaleDateString('ko-KR'),
      day: 0, targetDay: parseInt(form.targetDay) || 28,
      temp: parseFloat(form.temp) || 1.0, humidity: parseFloat(form.humidity) || 82,
      weight: w, initWeight: w, status: 'early', notes: form.notes || '—',
      completed: false, completedDate: null,
    };
    setItems([newItem, ...items]);
    setModal(false);
    setForm({ cut: '', grade: '1+', origin: '국내산(한우)', weight: '', targetDay: '28', temp: '', humidity: '', notes: '' });
    try {
      const info = await getStoreInfo();
      await agingApi.create({ cut: newItem.cut, grade: newItem.grade, origin: newItem.origin, trace: newItem.trace, start_date: newItem.startDate, day: 0, target_day: newItem.targetDay, temp: newItem.temp, humidity: newItem.humidity, weight: newItem.weight, init_weight: newItem.initWeight, status: 'early', notes: newItem.notes, store_id: info.store_id || '', store_name: info.store_name || '' });
    } catch (_) {}
  };

  const handleComplete = (id) => {
    Alert.alert('숙성 완료 처리', '해당 항목을 완료 목록으로 이동할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료 처리', style: 'default',
        onPress: () => {
          const target = items.find(i => i.id === id);
          setItems(prev => prev.map(i =>
            i.id === id
              ? { ...i, status: 'done', completed: true, completedDate: new Date().toLocaleDateString('ko-KR') }
              : i
          ));
          setExpanded(null);
          // 숙성 완료 알림 (즉시)
          if (target) {
            scheduleAgingCompleteAlert(target.trace || id, target.cut || '숙성육', 0).catch(() => {});
          }
        },
      },
    ]);
  };

  const activeItems = items.filter(i => !i.completed);
  const doneItems = items.filter(i => i.completed);
  const displayItems = listTab === 'active' ? activeItems : doneItems;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* V5 Header */}
      <View style={styles.v5Header}>
        <View style={styles.v5HeaderAccent} />
        <View style={styles.v5HeaderContent}>
          <View style={styles.v5BrandIcon}>
            <Ionicons name="time-outline" size={18} color={C.white} />
          </View>
          <Text style={styles.v5HeaderTitle}>숙성 관리</Text>
        </View>
      </View>

      {/* 상단 통계 */}
      <View style={styles.statBar}>
        <StatMini label="숙성 중" value={`${activeItems.length}건`} color={C.red2} icon="flame-outline" />
        <StatMini label="완료됨" value={`${doneItems.length}건`} color={C.ok} icon="checkmark-circle-outline" />
        <StatMini label="평균 수율" value="86.2%" color={C.warn} icon="trending-up-outline" />
      </View>

      {/* 활성/완료 세그먼트 */}
      <View style={styles.segBar}>
        <TouchableOpacity
          style={[styles.segBtn, listTab === 'active' && { borderBottomColor: C.red2, borderBottomWidth: 3 }]}
          onPress={() => setListTab('active')}
        >
          <Text style={[styles.segText, { color: listTab === 'active' ? C.red2 : C.t3 }]}>
            숙성 중 ({activeItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, listTab === 'done' && { borderBottomColor: C.ok, borderBottomWidth: 3 }]}
          onPress={() => setListTab('done')}
        >
          <Text style={[styles.segText, { color: listTab === 'done' ? C.ok : C.t3 }]}>
            완료됨 ({doneItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 툴바 */}
      <View style={styles.toolbar}>
        <View style={styles.viewSwitch}>
          {['cards', 'table'].map(mode => (
            <TouchableOpacity key={mode}
              style={[styles.viewBtn, viewMode === mode && { backgroundColor: C.bg2, ...SH.sm }]}
              onPress={() => setViewMode(mode)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={mode === 'cards' ? 'grid-outline' : 'list-outline'} size={14} color={viewMode === mode ? C.t1 : C.t3} />
                <Text style={[styles.viewBtnText, { color: viewMode === mode ? C.t1 : C.t3 }, viewMode === mode && styles.viewBtnTextActive]}>
                  {mode === 'cards' ? '카드' : '대장'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => exportAgingPDF(items)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="document-text-outline" size={14} color={C.red2} />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </View>
          </TouchableOpacity>
          {listTab === 'active' && (
            <AddBtn label="+ 등록" onPress={() => setModal(true)} color={C.red} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {displayItems.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name={listTab === 'active' ? 'hourglass-outline' : 'checkmark-done-outline'} size={32} color={C.t4} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>
              {listTab === 'active' ? '숙성 중인 항목이 없습니다' : '완료된 항목이 없습니다'}
            </Text>
          </View>
        )}

        {viewMode === 'cards' ? (
          displayItems.map(item => {
            const p = pct(item);
            const isOpen = expanded === item.id;
            const barColor = p >= 100 ? C.ok : p >= 70 ? C.red : C.red2;
            const isDone = item.completed;
            const accentColor = isDone ? C.ok : p >= 100 ? C.ok : p >= 70 ? C.red : C.red2;
            return (
              <TouchableOpacity key={item.id}
                style={[
                  styles.agingCard,
                  { borderColor: isOpen ? accentColor : C.border },
                  isOpen && { borderWidth: 2 },
                  isDone && { opacity: 0.85 },
                ]}
                onPress={() => setExpanded(isOpen ? null : item.id)}
                activeOpacity={0.85}>

                <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCut}>{item.cut}</Text>
                    <View style={styles.cardBadgeRow}>
                      <Badge label={`${item.grade}등급`} color={C.warn} bg={C.warnS} />
                      <Badge label={item.origin} color={C.t3} bg={C.bg2} />
                      {isDone
                        ? <Badge label="완료" color={C.ok} bg={C.okS} />
                        : <StatusBadge status={item.status} />
                      }
                    </View>
                  </View>
                  <View style={[styles.dayBlock, { backgroundColor: (p >= 100 ? C.ok : C.red) + '18' }]}>
                    <Text style={[styles.dayNum, { color: p >= 100 ? C.ok : C.red }]}>{item.day}</Text>
                    <Text style={styles.dayLabel}>일째</Text>
                    <Text style={styles.dayTarget}>/{item.targetDay}일</Text>
                  </View>
                </View>

                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <ProgressBar pct={p} color={barColor} height={12} />
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressLabel}>진행률 {p}%</Text>
                    <Text style={styles.progressLabel}>수율 {yieldPct(item)}%</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="pin-outline" size={11} color={C.t3} />
                    <Text style={styles.traceText}>{item.trace}</Text>
                  </View>
                  {isDone && item.completedDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="checkmark-circle" size={11} color={C.ok} />
                      <Text style={[styles.traceText, { color: C.ok }]}>완료일: {item.completedDate}</Text>
                    </View>
                  )}
                </View>

                {isOpen && (
                  <View style={styles.expandArea}>
                    <View style={styles.envRow}>
                      <EnvBox label="온도" value={`${item.temp}°C`} color={C.blue} icon="thermometer-outline" />
                      <EnvBox label="습도" value={`${item.humidity}%`} color={C.pur} icon="water-outline" />
                      <EnvBox label="수율" value={`${yieldPct(item)}%`} color={C.warn} icon="trending-up-outline" />
                    </View>
                    <View style={styles.noteArea}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="create-outline" size={13} color={C.t2} />
                        <Text style={styles.noteText}>{item.notes}</Text>
                      </View>
                    </View>
                    <Text style={styles.infoText}>입고일: {item.startDate}</Text>

                    {/* 완료 처리 버튼 — 목표 달성 & 아직 완료 안 된 경우 */}
                    {!isDone && p >= 100 && (
                      <TouchableOpacity
                        style={[styles.completeBtn, { backgroundColor: C.ok }]}
                        onPress={() => handleComplete(item.id)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-circle" size={18} color={C.white} />
                          <Text style={styles.completeBtnText}>숙성 완료 처리</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    {!isDone && p < 100 && (
                      <TouchableOpacity
                        style={[styles.completeBtn, { backgroundColor: C.red2 + 'DD' }]}
                        onPress={() => Alert.alert('조기 완료', '아직 목표 숙성일에 도달하지 않았습니다.\n그래도 완료 처리할까요?', [
                          { text: '취소', style: 'cancel' },
                          { text: '완료', onPress: () => handleComplete(item.id) },
                        ])}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.completeBtnText}>완료 처리 ({p}% 진행)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              {['이력번호', '부위', '등급', '숙성일', '상태'].map(h => (
                <Text key={h} style={styles.thText}>{h}</Text>
              ))}
            </View>
            {displayItems.map(item => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.tdText, { fontFamily: 'Courier', fontSize: F.xxs }]} numberOfLines={1}>{item.trace}</Text>
                <Text style={styles.tdText}>{item.cut.split(' ')[0]}</Text>
                <Text style={styles.tdText}>{item.grade}</Text>
                <Text style={[styles.tdText, { color: C.red, fontWeight: '800' }]}>{item.day}일</Text>
                {item.completed
                  ? <Badge label="완료" color={C.ok} bg={C.okS} />
                  : <StatusBadge status={item.status} />
                }
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 등록 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="nutrition-outline" size={20} color={C.red} />
              <Text style={styles.modalTitle}>숙성 신규 등록</Text>
            </View>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Ionicons name="close" size={24} color={C.t2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <FormField label="부위명 *" placeholder="예: 등심 (Striploin)" value={form.cut}
              onChangeText={t => setForm({ ...form, cut: t })} />

            <Text style={styles.formLabel}>등급 선택</Text>
            <View style={styles.chipRow}>
              {GRADES.map(g => (
                <TouchableOpacity key={g} style={[styles.chip, form.grade === g && styles.chipActive]}
                  onPress={() => setForm({ ...form, grade: g })}>
                  <Text style={[styles.chipText, form.grade === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>원산지</Text>
            <View style={styles.chipRow}>
              {ORIGINS.map(o => (
                <TouchableOpacity key={o} style={[styles.chip, form.origin === o && styles.chipActive]}
                  onPress={() => setForm({ ...form, origin: o })}>
                  <Text style={[styles.chipText, form.origin === o && styles.chipTextActive]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>목표 숙성일수</Text>
            <View style={styles.chipRow}>
              {TARGET_DAYS.map(d => (
                <TouchableOpacity key={d} style={[styles.chip, form.targetDay === d && styles.chipActive]}
                  onPress={() => setForm({ ...form, targetDay: d })}>
                  <Text style={[styles.chipText, form.targetDay === d && styles.chipTextActive]}>{d}일</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FormField label="중량 (kg)" placeholder="14.5" value={form.weight}
                  onChangeText={t => setForm({ ...form, weight: t })} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="온도 (°C)" placeholder="1.0" value={form.temp}
                  onChangeText={t => setForm({ ...form, temp: t })} keyboardType="numeric" />
              </View>
            </View>
            <FormField label="메모" placeholder="특이사항" value={form.notes}
              onChangeText={t => setForm({ ...form, notes: t })} />

            <PrimaryBtn label="등록 완료" onPress={handleSave} color={C.red} style={{ marginTop: 8 }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const StatMini = ({ label, value, color, icon }) => (
  <View style={styles.statMini}>
    <View style={[styles.statMiniAccent, { backgroundColor: color }]} />
    <Ionicons name={icon} size={16} color={color} style={{ marginBottom: 4 }} />
    <Text style={[styles.statVal, { color }]}>{value}</Text>
    <Text style={styles.statLbl}>{label}</Text>
  </View>
);

const EnvBox = ({ label, value, color, icon }) => (
  <View style={styles.envBox}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
      <Ionicons name={icon} size={12} color={C.t3} />
      <Text style={styles.envLabel}>{label}</Text>
    </View>
    <Text style={[styles.envVal, { color }]}>{value}</Text>
  </View>
);

const FormField = ({ label, ...props }) => (
  <View style={{ marginBottom: 16 }}>
    {label && <Text style={styles.formLabel}>{label}</Text>}
    <TextInput
      style={styles.input}
      placeholderTextColor={C.t4}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  /* V5 Header */
  v5Header: { backgroundColor: C.white, ...SH.sm },
  v5HeaderAccent: { height: 3, backgroundColor: C.red },
  v5HeaderContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  v5BrandIcon: { width: 33, height: 33, borderRadius: R.sm, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  v5HeaderTitle: { fontSize: 22, fontWeight: '900', color: C.t1 },

  /* Stats */
  statBar: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  statMini: { flex: 1, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 10, alignItems: 'center', overflow: 'hidden' },
  statMiniAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  statVal: { fontSize: F.h3, fontWeight: '900', marginBottom: 4 },
  statLbl: { fontSize: F.xxs, fontWeight: '600', textAlign: 'center', color: C.t3 },

  /* Segment */
  segBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  segBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  segText: { fontSize: F.sm, fontWeight: '800', letterSpacing: 0.3 },

  /* Toolbar */
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  viewSwitch: { flexDirection: 'row', borderRadius: R.sm, padding: 3, backgroundColor: C.bg },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  viewBtnText: { fontSize: F.sm, fontWeight: '600' },
  viewBtnTextActive: { fontWeight: '800' },

  /* Cards */
  agingCard: { borderRadius: R.lg, borderWidth: 1, marginBottom: 10, overflow: 'hidden', backgroundColor: C.white, ...SH.sm },
  cardAccentBar: { height: 4, width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingBottom: 10 },
  cardCut: { fontSize: F.h3, fontWeight: '800', marginBottom: 7, color: C.t1 },
  cardBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBlock: { alignItems: 'center', marginLeft: 10, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 64 },
  dayNum: { fontSize: 38, fontWeight: '900', lineHeight: 42 },
  dayLabel: { fontSize: F.xs, fontWeight: '700', color: C.t2 },
  dayTarget: { fontSize: F.xxs, color: C.t3 },

  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: F.xs, color: C.t3 },
  traceText: { fontSize: F.xxs, fontFamily: 'Courier', color: C.t3 },

  expandArea: { borderTopWidth: 1, borderTopColor: C.border, padding: 16 },
  envRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  envBox: { flex: 1, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2, padding: 10, alignItems: 'center' },
  envLabel: { fontSize: F.xxs, color: C.t3 },
  envVal: { fontSize: F.body, fontWeight: '800' },
  noteArea: { borderRadius: R.sm, padding: 10, marginBottom: 6, backgroundColor: C.bg2 },
  noteText: { fontSize: F.sm, color: C.t2 },
  infoText: { fontSize: F.xxs, color: C.t3 },

  completeBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: R.md,
    alignItems: 'center',
  },
  completeBtnText: { color: C.white, fontSize: F.body, fontWeight: '900' },

  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: F.body, fontWeight: '600', color: C.t3 },

  /* Table */
  tableWrap: { borderRadius: R.md, borderWidth: 1, borderColor: C.border, overflow: 'hidden', backgroundColor: C.white, ...SH.sm },
  tableHead: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg2 },
  thText: { flex: 1, fontSize: F.xs, fontWeight: '700', color: C.t3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  tdText: { flex: 1, fontSize: F.sm, color: C.t1 },

  /* Modal */
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  modalTitle: { fontSize: F.h3, fontWeight: '800', color: C.t1 },
  formLabel: { fontSize: F.sm, fontWeight: '700', marginBottom: 7, color: C.t2 },
  input: { borderWidth: 1.5, borderRadius: R.sm, padding: 14, fontSize: F.body, backgroundColor: C.bg2, borderColor: C.border, color: C.t1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg2 },
  chipActive: { backgroundColor: C.red, borderColor: C.red },
  chipText: { fontSize: F.sm, fontWeight: '600', color: C.t2 },
  chipTextActive: { color: C.white, fontWeight: '800' },
  pdfBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.red2 },
  pdfBtnText: { fontSize: F.sm, fontWeight: '800', color: C.red2 },
});
