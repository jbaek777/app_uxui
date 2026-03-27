import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, radius, shadow, fontSize, spacing } from '../theme';
import { Badge, StatusBadge, ProgressBar, PrimaryBtn, OutlineBtn, AddBtn } from '../components/UI';
import { agingData as initialData } from '../data/mockData';
import { agingApi } from '../lib/supabase';

const PDF_STYLE = `
  body { font-family: sans-serif; padding: 32px; color: #1a1f36; }
  h1 { font-size: 22px; border-bottom: 3px solid #C0392B; padding-bottom: 10px; margin-bottom: 6px; }
  .meta { font-size: 12px; color: #9099b8; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f5f6fa; padding: 10px 12px; text-align: left; font-size: 12px; color: #5a6480; border: 1px solid #dde1ef; }
  td { padding: 10px 12px; font-size: 13px; border: 1px solid #dde1ef; }
  .ok { color: #27AE60; font-weight: bold; }
  .aging { color: #1d4ed8; font-weight: bold; }
  .prog-bar { height: 8px; background: #e8eaf2; border-radius: 4px; overflow: hidden; margin-top: 4px; }
  .prog-fill { height: 8px; background: #C0392B; border-radius: 4px; }
  .footer { margin-top: 40px; font-size: 11px; color: #9099b8; text-align: right; }
`;

async function exportAgingPDF(items) {
  const rows = items.map(i => {
    const pct = Math.min(100, Math.round((i.day / i.targetDay) * 100));
    const yld = (i.weight / i.initWeight * 100).toFixed(1);
    const statusLabel = i.status === 'done' ? '✓ 완성' : i.status === 'aging' ? '숙성 중' : '초기';
    return `<tr>
      <td style="font-family:monospace;font-size:11px">${i.trace}</td>
      <td><strong>${i.cut}</strong></td>
      <td>${i.grade}등급</td>
      <td>${i.origin}</td>
      <td>${i.day}일 / ${i.targetDay}일
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      </td>
      <td>${yld}%</td>
      <td>${i.temp}°C / ${i.humidity}%</td>
      <td class="${i.status === 'done' ? 'ok' : 'aging'}">${statusLabel}</td>
    </tr>`;
  }).join('');
  const html = `<html><head><style>${PDF_STYLE}</style></head><body>
    <h1>🥩 숙성 관리 대장</h1>
    <div class="meta">출력일: ${new Date().toLocaleDateString('ko-KR')} | 총 ${items.length}건</div>
    <table><thead><tr>
      <th>이력번호</th><th>부위</th><th>등급</th><th>원산지</th>
      <th>숙성 진행</th><th>수율</th><th>온도/습도</th><th>상태</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">MeatBig — 자동 생성 문서 | ${new Date().toLocaleString('ko-KR')}</div>
  </body></html>`;
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: '숙성대장.pdf' });
    else Alert.alert('저장 완료', 'PDF가 저장되었습니다.');
  } catch (e) {
    Alert.alert('오류', 'PDF 생성 중 오류가 발생했습니다.');
  }
}

const GRADES = ['1++', '1+', '1', '2', '3'];
const ORIGINS = ['국내산(한우)', '국내산(육우)', '미국산', '호주산'];
const TARGET_DAYS = ['14', '21', '28', '35', '45', '60'];

export default function AgingScreen() {
  const [items, setItems] = useState(initialData);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
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

  const pct = item => Math.min(100, Math.round((item.day / item.targetDay) * 100));
  const yieldPct = item => (item.weight / item.initWeight * 100).toFixed(1);

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
    };
    setItems([newItem, ...items]);
    setModal(false);
    setForm({ cut: '', grade: '1+', origin: '국내산(한우)', weight: '', targetDay: '28', temp: '', humidity: '', notes: '' });
    try {
      await agingApi.create({ cut: newItem.cut, grade: newItem.grade, origin: newItem.origin, trace: newItem.trace, start_date: newItem.startDate, day: 0, target_day: newItem.targetDay, temp: newItem.temp, humidity: newItem.humidity, weight: newItem.weight, init_weight: newItem.initWeight, status: 'early', notes: newItem.notes });
    } catch (_) {}
  };

  const done = items.filter(i => i.status === 'done').length;
  const aging = items.filter(i => i.status !== 'done').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 상단 통계 */}
      <View style={styles.statBar}>
        <StatMini label="숙성 중" value={`${aging}건`} color={colors.a2} />
        <StatMini label="완성 대기" value={`${done}건`} color={colors.gn} />
        <StatMini label="평균 수율" value="86.2%" color={colors.yw} />
      </View>

      {/* 툴바 */}
      <View style={styles.toolbar}>
        <View style={styles.viewSwitch}>
          {['cards', 'table'].map(mode => (
            <TouchableOpacity key={mode}
              style={[styles.viewBtn, viewMode === mode && styles.viewBtnActive]}
              onPress={() => setViewMode(mode)}>
              <Text style={[styles.viewBtnText, viewMode === mode && styles.viewBtnTextActive]}>
                {mode === 'cards' ? '🃏 카드' : '📋 대장'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => exportAgingPDF(items)}>
            <Text style={styles.pdfBtnText}>📄 PDF</Text>
          </TouchableOpacity>
          <AddBtn label="+ 등록" onPress={() => setModal(true)} color={colors.ac} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {viewMode === 'cards' ? (
          items.map(item => {
            const p = pct(item);
            const isOpen = expanded === item.id;
            const barColor = p >= 100 ? colors.gn : p >= 70 ? colors.ac : colors.a2;
            return (
              <TouchableOpacity key={item.id}
                style={[styles.agingCard, isOpen && { borderColor: colors.ac, borderWidth: 2 }]}
                onPress={() => setExpanded(isOpen ? null : item.id)}
                activeOpacity={0.85}>

                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCut}>{item.cut}</Text>
                    <View style={styles.cardBadgeRow}>
                      <Badge label={`${item.grade}등급`} color={colors.yw} bg={colors.yw + '20'} />
                      <Badge label={item.origin} color={colors.t3} bg={colors.s2} />
                      <StatusBadge status={item.status} />
                    </View>
                  </View>
                  <View style={[styles.dayBlock, { backgroundColor: (p >= 100 ? colors.gn : colors.ac) + '18' }]}>
                    <Text style={[styles.dayNum, { color: p >= 100 ? colors.gn : colors.ac }]}>{item.day}</Text>
                    <Text style={styles.dayLabel}>일째</Text>
                    <Text style={styles.dayTarget}>/{item.targetDay}일</Text>
                  </View>
                </View>

                <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                  <ProgressBar pct={p} color={barColor} height={12} />
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressLabel}>진행률 {p}%</Text>
                    <Text style={styles.progressLabel}>수율 {yieldPct(item)}%</Text>
                  </View>
                  <Text style={styles.traceText}>📌 {item.trace}</Text>
                </View>

                {isOpen && (
                  <View style={styles.expandArea}>
                    <View style={styles.envRow}>
                      <EnvBox label="🌡️ 온도" value={`${item.temp}°C`} color={colors.cyan} />
                      <EnvBox label="💧 습도" value={`${item.humidity}%`} color={colors.pu} />
                      <EnvBox label="📈 수율" value={`${yieldPct(item)}%`} color={colors.yw} />
                    </View>
                    <View style={styles.noteArea}>
                      <Text style={styles.noteText}>📝 {item.notes}</Text>
                    </View>
                    <Text style={styles.infoText}>입고일: {item.startDate}</Text>
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
            {items.map(item => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.tdText, { fontFamily: 'Courier', fontSize: fontSize.xxs, color: colors.t2 }]} numberOfLines={1}>{item.trace}</Text>
                <Text style={styles.tdText}>{item.cut.split(' ')[0]}</Text>
                <Text style={styles.tdText}>{item.grade}</Text>
                <Text style={[styles.tdText, { color: colors.ac, fontWeight: '800' }]}>{item.day}일</Text>
                <StatusBadge status={item.status} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 등록 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🥩 숙성 신규 등록</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
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

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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

            <PrimaryBtn label="🥩 등록 완료" onPress={handleSave} color={colors.ac} style={{ marginTop: 8 }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const StatMini = ({ label, value, color }) => (
  <View style={styles.statMini}>
    <Text style={[styles.statVal, { color }]}>{value}</Text>
    <Text style={styles.statLbl}>{label}</Text>
  </View>
);

const EnvBox = ({ label, value, color }) => (
  <View style={styles.envBox}>
    <Text style={styles.envLabel}>{label}</Text>
    <Text style={[styles.envVal, { color }]}>{value}</Text>
  </View>
);

const FormField = ({ label, ...props }) => (
  <View style={{ marginBottom: spacing.md }}>
    {label && <Text style={styles.formLabel}>{label}</Text>}
    <TextInput style={styles.input} placeholderTextColor={colors.t3} {...props} />
  </View>
);

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.s1, borderBottomWidth: 1, borderBottomColor: colors.bd },
  statMini: { flex: 1, backgroundColor: colors.s2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.sm + 2, alignItems: 'center', ...shadow.sm },
  statVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 3 },
  statLbl: { fontSize: fontSize.xxs, color: colors.t3, fontWeight: '600', textAlign: 'center' },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.s1, borderBottomWidth: 1, borderBottomColor: colors.bd },
  viewSwitch: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.sm, padding: 3 },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  viewBtnActive: { backgroundColor: colors.s2, ...shadow.sm },
  viewBtnText: { fontSize: fontSize.sm, color: colors.t3, fontWeight: '600' },
  viewBtnTextActive: { color: colors.tx, fontWeight: '800' },

  agingCard: { backgroundColor: colors.s1, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bd, marginBottom: spacing.sm, ...shadow.sm, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, paddingBottom: spacing.sm },
  cardCut: { fontSize: fontSize.lg, fontWeight: '800', color: colors.tx, marginBottom: 7 },
  cardBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBlock: { alignItems: 'center', marginLeft: spacing.sm, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 64 },
  dayNum: { fontSize: 38, fontWeight: '900', lineHeight: 42 },
  dayLabel: { fontSize: fontSize.xs, color: colors.t2, fontWeight: '700' },
  dayTarget: { fontSize: fontSize.xxs, color: colors.t3 },

  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: fontSize.xxs, color: colors.t3 },
  traceText: { fontSize: fontSize.xxs, color: colors.t3, fontFamily: 'Courier', marginTop: 4 },

  expandArea: { borderTopWidth: 1, borderTopColor: colors.bd, padding: spacing.md },
  envRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  envBox: { flex: 1, backgroundColor: colors.s2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bd, padding: spacing.sm, alignItems: 'center' },
  envLabel: { fontSize: fontSize.xxs, color: colors.t3, marginBottom: 4 },
  envVal: { fontSize: fontSize.md, fontWeight: '800' },
  noteArea: { backgroundColor: colors.s2, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs },
  noteText: { fontSize: fontSize.xs, color: colors.t2 },
  infoText: { fontSize: fontSize.xxs, color: colors.t3 },

  tableWrap: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, overflow: 'hidden', ...shadow.sm },
  tableHead: { flexDirection: 'row', backgroundColor: colors.s2, paddingVertical: 10, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.bd },
  thText: { flex: 1, fontSize: fontSize.xxs, color: colors.t3, fontWeight: '700' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.bd + '60' },
  tdText: { flex: 1, fontSize: fontSize.sm, color: colors.tx },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.bd, backgroundColor: colors.s1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.tx },
  modalClose: { fontSize: 20, color: colors.t2, padding: 4 },
  formLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: colors.s2, borderWidth: 1.5, borderColor: colors.bd, borderRadius: radius.sm, padding: 14, fontSize: fontSize.sm, color: colors.tx },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: colors.bd, backgroundColor: colors.s2 },
  chipActive: { backgroundColor: colors.ac, borderColor: colors.ac },
  chipText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '800' },
  pdfBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.a2, backgroundColor: colors.a2 + '15' },
  pdfBtnText: { fontSize: fontSize.sm, color: colors.a2, fontWeight: '800' },
});
