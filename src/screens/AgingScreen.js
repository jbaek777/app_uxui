import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { colors, darkColors, lightColors, radius, shadow, fontSize, spacing } from '../theme';
import { useTheme } from '../lib/ThemeContext';
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
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
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
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      {/* 상단 통계 */}
      <View style={[styles.statBar, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
        <StatMini label="숙성 중" value={`${activeItems.length}건`} color={pal.a2} pal={pal} />
        <StatMini label="완료됨" value={`${doneItems.length}건`} color={pal.gn} pal={pal} />
        <StatMini label="평균 수율" value="86.2%" color={pal.yw} pal={pal} />
      </View>

      {/* 활성/완료 세그먼트 */}
      <View style={[styles.segBar, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
        <TouchableOpacity
          style={[styles.segBtn, listTab === 'active' && { borderBottomColor: pal.a2, borderBottomWidth: 3 }]}
          onPress={() => setListTab('active')}
        >
          <Text style={[styles.segText, { color: listTab === 'active' ? pal.a2 : pal.t3 }]}>
            숙성 중 ({activeItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, listTab === 'done' && { borderBottomColor: pal.gn, borderBottomWidth: 3 }]}
          onPress={() => setListTab('done')}
        >
          <Text style={[styles.segText, { color: listTab === 'done' ? pal.gn : pal.t3 }]}>
            완료됨 ({doneItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 툴바 */}
      <View style={[styles.toolbar, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
        <View style={[styles.viewSwitch, { backgroundColor: pal.bg }]}>
          {['cards', 'table'].map(mode => (
            <TouchableOpacity key={mode}
              style={[styles.viewBtn, viewMode === mode && { backgroundColor: pal.s2, ...shadow.sm }]}
              onPress={() => setViewMode(mode)}>
              <Text style={[styles.viewBtnText, { color: viewMode === mode ? pal.tx : pal.t3 }, viewMode === mode && styles.viewBtnTextActive]}>
                {mode === 'cards' ? '🃏 카드' : '📋 대장'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.pdfBtn, { borderColor: pal.a2 }]} onPress={() => exportAgingPDF(items)}>
            <Text style={[styles.pdfBtnText, { color: pal.a2 }]}>📄 PDF</Text>
          </TouchableOpacity>
          {listTab === 'active' && (
            <AddBtn label="+ 등록" onPress={() => setModal(true)} color={pal.ac} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
        {displayItems.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: pal.t3 }]}>
              {listTab === 'active' ? '숙성 중인 항목이 없습니다' : '완료된 항목이 없습니다'}
            </Text>
          </View>
        )}

        {viewMode === 'cards' ? (
          displayItems.map(item => {
            const p = pct(item);
            const isOpen = expanded === item.id;
            const barColor = p >= 100 ? pal.gn : p >= 70 ? pal.ac : pal.a2;
            const isDone = item.completed;
            const accentColor = isDone ? pal.gn : p >= 100 ? pal.gn : p >= 70 ? pal.ac : pal.a2;
            return (
              <TouchableOpacity key={item.id}
                style={[
                  styles.agingCard,
                  { backgroundColor: pal.s1, borderColor: isOpen ? accentColor : pal.bd },
                  isOpen && { borderWidth: 2 },
                  isDone && { opacity: 0.85 },
                ]}
                onPress={() => setExpanded(isOpen ? null : item.id)}
                activeOpacity={0.85}>

                <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardCut, { color: pal.tx }]}>{item.cut}</Text>
                    <View style={styles.cardBadgeRow}>
                      <Badge label={`${item.grade}등급`} color={pal.yw} bg={pal.yw + '20'} />
                      <Badge label={item.origin} color={pal.t3} bg={pal.s2} />
                      {isDone
                        ? <Badge label="✓ 완료" color={pal.gn} bg={pal.gn + '20'} />
                        : <StatusBadge status={item.status} />
                      }
                    </View>
                  </View>
                  <View style={[styles.dayBlock, { backgroundColor: (p >= 100 ? pal.gn : pal.ac) + '18' }]}>
                    <Text style={[styles.dayNum, { color: p >= 100 ? pal.gn : pal.ac }]}>{item.day}</Text>
                    <Text style={[styles.dayLabel, { color: pal.t2 }]}>일째</Text>
                    <Text style={[styles.dayTarget, { color: pal.t3 }]}>/{item.targetDay}일</Text>
                  </View>
                </View>

                <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                  <ProgressBar pct={p} color={barColor} height={12} />
                  <View style={styles.progressMeta}>
                    <Text style={[styles.progressLabel, { color: pal.t3 }]}>진행률 {p}%</Text>
                    <Text style={[styles.progressLabel, { color: pal.t3 }]}>수율 {yieldPct(item)}%</Text>
                  </View>
                  <Text style={[styles.traceText, { color: pal.t3 }]}>📌 {item.trace}</Text>
                  {isDone && item.completedDate && (
                    <Text style={[styles.traceText, { color: pal.gn, marginTop: 2 }]}>✓ 완료일: {item.completedDate}</Text>
                  )}
                </View>

                {isOpen && (
                  <View style={[styles.expandArea, { borderTopColor: pal.bd }]}>
                    <View style={styles.envRow}>
                      <EnvBox label="🌡️ 온도" value={`${item.temp}°C`} color={pal.cyan} pal={pal} />
                      <EnvBox label="💧 습도" value={`${item.humidity}%`} color={pal.pu} pal={pal} />
                      <EnvBox label="📈 수율" value={`${yieldPct(item)}%`} color={pal.yw} pal={pal} />
                    </View>
                    <View style={[styles.noteArea, { backgroundColor: pal.s2 }]}>
                      <Text style={[styles.noteText, { color: pal.t2 }]}>📝 {item.notes}</Text>
                    </View>
                    <Text style={[styles.infoText, { color: pal.t3 }]}>입고일: {item.startDate}</Text>

                    {/* 완료 처리 버튼 — 목표 달성 & 아직 완료 안 된 경우 */}
                    {!isDone && p >= 100 && (
                      <TouchableOpacity
                        style={[styles.completeBtn, { backgroundColor: pal.gn }]}
                        onPress={() => handleComplete(item.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.completeBtnText}>✓ 숙성 완료 처리</Text>
                      </TouchableOpacity>
                    )}
                    {!isDone && p < 100 && (
                      <TouchableOpacity
                        style={[styles.completeBtn, { backgroundColor: pal.a2 + 'DD' }]}
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
          <View style={[styles.tableWrap, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <View style={[styles.tableHead, { backgroundColor: pal.s2, borderBottomColor: pal.bd }]}>
              {['이력번호', '부위', '등급', '숙성일', '상태'].map(h => (
                <Text key={h} style={[styles.thText, { color: pal.t3 }]}>{h}</Text>
              ))}
            </View>
            {displayItems.map(item => (
              <View key={item.id} style={[styles.tableRow, { borderBottomColor: pal.bd + '60' }]}>
                <Text style={[styles.tdText, { fontFamily: 'Courier', fontSize: fontSize.xxs, color: pal.t2 }]} numberOfLines={1}>{item.trace}</Text>
                <Text style={[styles.tdText, { color: pal.tx }]}>{item.cut.split(' ')[0]}</Text>
                <Text style={[styles.tdText, { color: pal.tx }]}>{item.grade}</Text>
                <Text style={[styles.tdText, { color: pal.ac, fontWeight: '800' }]}>{item.day}일</Text>
                {item.completed
                  ? <Badge label="완료" color={pal.gn} bg={pal.gn + '20'} />
                  : <StatusBadge status={item.status} />
                }
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 등록 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: pal.bd, backgroundColor: pal.s1 }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>🥩 숙성 신규 등록</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.modalClose, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
            <FormField label="부위명 *" placeholder="예: 등심 (Striploin)" value={form.cut}
              onChangeText={t => setForm({ ...form, cut: t })} pal={pal} />

            <Text style={[styles.formLabel, { color: pal.t2 }]}>등급 선택</Text>
            <View style={styles.chipRow}>
              {GRADES.map(g => (
                <TouchableOpacity key={g} style={[styles.chip, { borderColor: pal.bd, backgroundColor: pal.s2 }, form.grade === g && { backgroundColor: pal.ac, borderColor: pal.ac }]}
                  onPress={() => setForm({ ...form, grade: g })}>
                  <Text style={[styles.chipText, { color: pal.t2 }, form.grade === g && { color: '#fff', fontWeight: '800' }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.formLabel, { color: pal.t2 }]}>원산지</Text>
            <View style={styles.chipRow}>
              {ORIGINS.map(o => (
                <TouchableOpacity key={o} style={[styles.chip, { borderColor: pal.bd, backgroundColor: pal.s2 }, form.origin === o && { backgroundColor: pal.ac, borderColor: pal.ac }]}
                  onPress={() => setForm({ ...form, origin: o })}>
                  <Text style={[styles.chipText, { color: pal.t2 }, form.origin === o && { color: '#fff', fontWeight: '800' }]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.formLabel, { color: pal.t2 }]}>목표 숙성일수</Text>
            <View style={styles.chipRow}>
              {TARGET_DAYS.map(d => (
                <TouchableOpacity key={d} style={[styles.chip, { borderColor: pal.bd, backgroundColor: pal.s2 }, form.targetDay === d && { backgroundColor: pal.ac, borderColor: pal.ac }]}
                  onPress={() => setForm({ ...form, targetDay: d })}>
                  <Text style={[styles.chipText, { color: pal.t2 }, form.targetDay === d && { color: '#fff', fontWeight: '800' }]}>{d}일</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <FormField label="중량 (kg)" placeholder="14.5" value={form.weight}
                  onChangeText={t => setForm({ ...form, weight: t })} keyboardType="numeric" pal={pal} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="온도 (°C)" placeholder="1.0" value={form.temp}
                  onChangeText={t => setForm({ ...form, temp: t })} keyboardType="numeric" pal={pal} />
              </View>
            </View>
            <FormField label="메모" placeholder="특이사항" value={form.notes}
              onChangeText={t => setForm({ ...form, notes: t })} pal={pal} />

            <PrimaryBtn label="🥩 등록 완료" onPress={handleSave} color={pal.ac} style={{ marginTop: 8 }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const StatMini = ({ label, value, color, pal }) => (
  <View style={[styles.statMini, { backgroundColor: pal.s1, borderColor: pal.bd, overflow: 'hidden' }]}>
    <View style={[styles.statMiniAccent, { backgroundColor: color }]} />
    <Text style={[styles.statVal, { color }]}>{value}</Text>
    <Text style={[styles.statLbl, { color: pal.t3 }]}>{label}</Text>
  </View>
);

const EnvBox = ({ label, value, color, pal }) => (
  <View style={[styles.envBox, { backgroundColor: pal.s2, borderColor: pal.bd }]}>
    <Text style={[styles.envLabel, { color: pal.t3 }]}>{label}</Text>
    <Text style={[styles.envVal, { color }]}>{value}</Text>
  </View>
);

const FormField = ({ label, pal, ...props }) => (
  <View style={{ marginBottom: spacing.md }}>
    {label && <Text style={[styles.formLabel, { color: pal.t2 }]}>{label}</Text>}
    <TextInput
      style={[styles.input, { backgroundColor: pal.s2, borderColor: pal.bd, color: pal.tx }]}
      placeholderTextColor={pal.t3}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1 },
  statMini: { flex: 1, borderRadius: radius.md, borderWidth: 1, paddingTop: 16, paddingBottom: 12, paddingHorizontal: spacing.sm, alignItems: 'center' },
  statMiniAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  statVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 4 },
  statLbl: { fontSize: fontSize.xxs, fontWeight: '600', textAlign: 'center' },

  segBar: { flexDirection: 'row', borderBottomWidth: 1 },
  segBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  segText: { fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.3 },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  viewSwitch: { flexDirection: 'row', borderRadius: radius.sm, padding: 3 },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  viewBtnText: { fontSize: fontSize.sm, fontWeight: '600' },
  viewBtnTextActive: { fontWeight: '800' },

  agingCard: { borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm, overflow: 'hidden' },
  cardAccentBar: { height: 4, width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, paddingBottom: spacing.sm },
  cardCut: { fontSize: fontSize.lg, fontWeight: '800', marginBottom: 7 },
  cardBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBlock: { alignItems: 'center', marginLeft: spacing.sm, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 64 },
  dayNum: { fontSize: 38, fontWeight: '900', lineHeight: 42 },
  dayLabel: { fontSize: fontSize.xs, fontWeight: '700' },
  dayTarget: { fontSize: fontSize.xxs },

  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: fontSize.xxs },
  traceText: { fontSize: fontSize.xxs, fontFamily: 'Courier', marginTop: 4 },

  expandArea: { borderTopWidth: 1, padding: spacing.md },
  envRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  envBox: { flex: 1, borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, alignItems: 'center' },
  envLabel: { fontSize: fontSize.xxs, marginBottom: 4 },
  envVal: { fontSize: fontSize.md, fontWeight: '800' },
  noteArea: { borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs },
  noteText: { fontSize: fontSize.xs },
  infoText: { fontSize: fontSize.xxs },

  completeBtn: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  completeBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },

  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: fontSize.md, fontWeight: '600' },

  tableWrap: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', ...shadow.sm },
  tableHead: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: spacing.sm, borderBottomWidth: 1 },
  thText: { flex: 1, fontSize: fontSize.xxs, fontWeight: '700' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.sm, borderBottomWidth: 1 },
  tdText: { flex: 1, fontSize: fontSize.sm },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800' },
  modalClose: { fontSize: 20, padding: 4 },
  formLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1.5, borderRadius: radius.sm, padding: 14, fontSize: fontSize.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: fontSize.sm, fontWeight: '600' },
  pdfBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1.5 },
  pdfBtnText: { fontSize: fontSize.sm, fontWeight: '800' },
});
