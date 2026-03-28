import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput, Alert,
} from 'react-native';
import { colors, darkColors, lightColors, radius, shadow, fontSize, spacing } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { StatusBadge, AlertBox, PrimaryBtn, OutlineBtn, ProgressBar, AddBtn } from '../components/UI';
import { hygieneData as initHyg, tempData as initTemp, staffData, inventoryData } from '../data/mockData';
import { hygieneApi, sensorApi, employeeApi, inventoryApi } from '../lib/supabase';
import { genHygieneHTML, genTempHTML, printAndShare } from '../lib/pdfTemplate';

// ═══ 위생 일지 ═══════════════════════════════════════════
export function HygieneScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [logs, setLogs] = useState(initHyg);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ inspector: '', tempWork: '', tempFridge: '' });
  const [checks, setChecks] = useState({ board: false, knife: false, hands: false, clothes: false, pest: false });

  useEffect(() => {
    hygieneApi.getAll().then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        setLogs(data.map(r => ({
          id: r.id, date: r.log_date, time: r.log_time,
          inspector: r.inspector, items: r.items || [], status: r.status,
        })));
      }
    }).catch(() => {});
  }, []);

  const CHECKS = [
    { key: 'board', label: '🪵 도마 소독 완료' },
    { key: 'knife', label: '🔪 칼·기구 소독 완료' },
    { key: 'hands', label: '🙌 종사자 손 세척 확인' },
    { key: 'clothes', label: '👕 작업복 세탁 확인' },
    { key: 'pest', label: '🐛 해충·방제 이상 없음' },
  ];

  const handleSave = async () => {
    const items = [];
    if (form.tempWork) items.push(`작업장 온도: ${form.tempWork}°C`);
    if (form.tempFridge) items.push(`냉장고 온도: ${form.tempFridge}°C`);
    CHECKS.forEach(c => { if (checks[c.key]) items.push(c.label); });
    const now = new Date();
    const newLog = {
      id: Date.now().toString(),
      date: now.toLocaleDateString('ko-KR'),
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      items, status: 'pass',
      inspector: form.inspector || '미입력',
    };
    setLogs([newLog, ...logs]);
    setModal(false);
    setForm({ inspector: '', tempWork: '', tempFridge: '' });
    setChecks({ board: false, knife: false, hands: false, clothes: false, pest: false });
    try {
      await hygieneApi.create({
        log_date: newLog.date, log_time: newLog.time,
        inspector: newLog.inspector, items: newLog.items, status: 'pass',
      });
    } catch (_) {}
  };

  const pass = logs.filter(l => l.status === 'pass').length;

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[styles.statBar, { backgroundColor: pal.bg }]}>
        <StatMini label="이번 달 작성" value={`${logs.length}건`} color={pal.gn} pal={pal} />
        <StatMini label="적합 판정" value={`${pass}건`} color={pal.a2} pal={pal} />
        <StatMini label="위생 점수" value="94점" color={pal.ac} pal={pal} />
      </View>
      <View style={[styles.toolbar, { }]}>
        <Text style={[styles.toolTitle, { color: pal.tx }]}>📋 위생 일지 목록</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.pdfBtn, { borderColor: pal.a2 }]} onPress={async () => {
            try {
              await printAndShare(genHygieneHTML(logs), '위생관리점검표');
            } catch (e) {
              Alert.alert('오류', 'PDF 생성 중 오류가 발생했습니다.');
            }
          }}>
            <Text style={[styles.pdfBtnText, { color: pal.a2 }]}>📄 PDF</Text>
          </TouchableOpacity>
          <AddBtn label="📋 오늘 작성" onPress={() => setModal(true)} color={pal.gn} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {logs.map(log => {
          const isOpen = expanded === log.id;
          return (
            <TouchableOpacity key={log.id}
              style={[styles.logCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}
              onPress={() => setExpanded(isOpen ? null : log.id)} activeOpacity={0.88}>
              <View style={styles.logTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logDate, { color: pal.tx }]}>{log.date} {log.time}</Text>
                  <Text style={[styles.logInspector, { color: pal.t3 }]}>담당: {log.inspector}</Text>
                </View>
                <StatusBadge status={log.status} />
              </View>
              {isOpen && (
                <View style={[styles.logExpand, { borderTopColor: pal.bd }]}>
                  {log.items.map((item, i) => (
                    <View key={i} style={[styles.logItem, { borderBottomColor: pal.bd + '40' }]}>
                      <Text style={{ color: pal.gn, fontWeight: '700', fontSize: fontSize.sm }}>✓</Text>
                      <Text style={[styles.logItemText, { color: pal.t2 }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: pal.s1 }]}>
          <ModalHeader title="📋 오늘 위생 일지 작성" onClose={() => setModal(false)} pal={pal} />
          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            <FormField label="담당자 이름" placeholder="예: 홍길동" value={form.inspector}
              onChangeText={t => setForm({ ...form, inspector: t })} pal={pal} />
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <FormField label="작업장 온도 (°C)" placeholder="예: 4" value={form.tempWork}
                  onChangeText={t => setForm({ ...form, tempWork: t })} keyboardType="numeric" pal={pal} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="냉장고 온도 (°C)" placeholder="예: -2" value={form.tempFridge}
                  onChangeText={t => setForm({ ...form, tempFridge: t })} keyboardType="numeric" pal={pal} />
              </View>
            </View>
            <Text style={[styles.formLabel, { color: pal.t2 }]}>✅ 체크리스트</Text>
            {CHECKS.map(c => (
              <TouchableOpacity key={c.key}
                style={[styles.checkRow, { borderBottomColor: pal.bd }]}
                onPress={() => setChecks({ ...checks, [c.key]: !checks[c.key] })}>
                <View style={[styles.checkBox, { borderColor: pal.bd2, backgroundColor: pal.s1 }, checks[c.key] && styles.checkBoxOn]}>
                  {checks[c.key] && <Text style={{ color: '#fff', fontSize: fontSize.xs, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, { color: pal.tx }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
            <PrimaryBtn label="✓ 위생 일지 저장" onPress={handleSave} color={pal.gn} style={{ marginTop: spacing.md }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ═══ 온도·습도 기록 ════════════════════════════════════════
export function TempScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [records, setRecords] = useState(initTemp);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ temp: '', humidity: '', person: '홍길동', note: '' });

  const handleSave = () => {
    const t = parseFloat(form.temp) || 0;
    const now = new Date();
    setRecords([{
      id: Date.now().toString(),
      date: now.toLocaleDateString('ko-KR'),
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      temp: t, humidity: parseInt(form.humidity) || 82,
      person: form.person, note: form.note || '—',
      status: t > 4 ? 'warn' : 'ok',
    }, ...records]);
    setModal(false);
    setForm({ temp: '', humidity: '', person: '홍길동', note: '' });
  };

  const latest = records[0];
  const warnCount = records.filter(r => r.status === 'warn').length;
  const isTempOk = !latest || latest.temp <= 4;

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[styles.statBar, { backgroundColor: pal.bg }]}>
        <StatMini label="현재 온도" value={latest ? `${latest.temp}°C` : '—'} color={isTempOk ? pal.gn : pal.yw} pal={pal} />
        <StatMini label="현재 습도" value={latest ? `${latest.humidity}%` : '—'} color={pal.gn} pal={pal} />
        <StatMini label="이달 이상" value={`${warnCount}회`} color={warnCount > 0 ? pal.yw : pal.gn} pal={pal} />
      </View>
      <View style={styles.toolbar}>
        <Text style={[styles.toolTitle, { color: pal.tx }]}>🌡️ 온도·습도 기록</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.pdfBtn, { borderColor: pal.a2 }]} onPress={async () => {
            try {
              await printAndShare(genTempHTML(records), '온도관리기록부');
            } catch (e) {
              Alert.alert('오류', 'PDF 생성 중 오류가 발생했습니다.');
            }
          }}>
            <Text style={[styles.pdfBtnText, { color: pal.a2 }]}>📄 PDF</Text>
          </TouchableOpacity>
          <AddBtn label="+ 기록 추가" onPress={() => setModal(true)} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {records.map(r => (
          <View key={r.id} style={[styles.tempCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <View style={styles.tempRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tempDate, { color: pal.tx }]}>{r.date} {r.time}</Text>
                <Text style={[styles.tempPerson, { color: pal.t3 }]}>측정자: {r.person}</Text>
              </View>
              <View style={styles.tempVals}>
                <Text style={[styles.tempVal, { color: r.temp > 4 ? pal.yw : pal.gn }]}>{r.temp}°C</Text>
                <Text style={[styles.tempHumid, { color: pal.t2 }]}>{r.humidity}% 습도</Text>
              </View>
              <View style={[styles.tempBadge, { backgroundColor: r.status === 'warn' ? '#fef9c3' : '#dcfce7' }]}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: r.status === 'warn' ? pal.yw : pal.gn }}>
                  {r.status === 'warn' ? '⚠ 주의' : '✓ 정상'}
                </Text>
              </View>
            </View>
            {r.note !== '—' && <Text style={[styles.tempNote, { color: pal.t2, borderTopColor: pal.bd }]}>💬 {r.note}</Text>}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: pal.s1 }]}>
          <ModalHeader title="🌡️ 온도·습도 기록 추가" onClose={() => setModal(false)} pal={pal} />
          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <FormField label="온도 (°C)" placeholder="0.0" value={form.temp}
                  onChangeText={t => setForm({ ...form, temp: t })} keyboardType="numeric" pal={pal} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="습도 (%)" placeholder="82" value={form.humidity}
                  onChangeText={t => setForm({ ...form, humidity: t })} keyboardType="numeric" pal={pal} />
              </View>
            </View>
            <FormField label="측정자" value={form.person} onChangeText={t => setForm({ ...form, person: t })} pal={pal} />
            <FormField label="비고" placeholder="이상 발생 시 원인 기록" value={form.note}
              onChangeText={t => setForm({ ...form, note: t })} pal={pal} />
            <PrimaryBtn label="저장" onPress={handleSave} style={{ marginTop: 8 }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ═══ 서류 체크리스트 ════════════════════════════════════════
export function DocsScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const commonDocs = [
    { key: 'd1', label: '영업신고증 / 허가증', sub: '식육판매업 신고증', date: '2025.06.01', status: 'ok' },
    { key: 'd2', label: '건강진단결과서 — 홍길동', sub: '만료 2027.01.15', date: '2026.01.15', status: 'ok' },
    { key: 'd3', label: '건강진단결과서 — 김○○', sub: '갱신 필요', date: '⚠ 만료', status: 'expired' },
    { key: 'd4', label: '위생교육 이수증', sub: '만료 2027.02.20', date: '2026.02.20', status: 'ok' },
    { key: 'd5', label: '원료육 거래명세서', sub: '이력번호 포함', date: '2026.03.24', status: 'ok' },
    { key: 'd6', label: '온도관리 기록지', sub: '시스템 자동', date: '2026.03.26', status: 'ok' },
  ];
  const agingDocs = [
    { key: 'a1', label: '숙성 일지 (전체)', sub: '시스템 자동', date: '2026.03.26', status: 'ok' },
    { key: 'a2', label: '숙성실 온도·습도 기록지', sub: '시스템 자동', date: '2026.03.26', status: 'ok' },
    { key: 'a3', label: '소비기한 설정 근거 문서', sub: '즉시 등록 필요', date: '미등록', status: 'missing' },
    { key: 'a4', label: '도축 검사증명서', sub: 'AI 등록', date: '2026.03.20', status: 'ok' },
    { key: 'a5', label: '미생물 검사 성적서 (권장)', sub: '권장 사항', date: '미등록', status: 'optional' },
  ];
  const [checked, setChecked] = useState({ d1: true, d2: true, d4: true, d5: true, d6: true, a1: true, a2: true, a4: true });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: pal.bg }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      <AlertBox type="warn" icon="⚠️" title="미비 서류 2건" message="소비기한 설정 근거 문서 · 건강진단결과서(김○○)" />
      <DocSection title="📋 공통 필수 서류" docs={commonDocs} checked={checked} onToggle={k => setChecked({ ...checked, [k]: !checked[k] })} />
      <DocSection title="🥩 건조숙성육 특화 서류" docs={agingDocs} checked={checked} onToggle={k => setChecked({ ...checked, [k]: !checked[k] })} />
    </ScrollView>
  );
}

function DocSection({ title, docs, checked, onToggle }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  return (
    <View style={[styles.docSection, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
      <Text style={[styles.docSectionTitle, { color: pal.t2, backgroundColor: pal.s2, borderBottomColor: pal.bd }]}>{title}</Text>
      {docs.map(doc => {
        const isChecked = checked[doc.key];
        const isMissing = doc.status === 'missing';
        return (
          <View key={doc.key} style={[styles.docRow, { borderBottomColor: pal.bd + '50' }]}>
            <TouchableOpacity
              style={[styles.checkBox, { borderColor: pal.bd2, backgroundColor: pal.s1 }, isChecked && styles.checkBoxOn, isMissing && styles.checkBoxWarn]}
              onPress={() => onToggle(doc.key)}>
              {isChecked && <Text style={{ color: '#fff', fontSize: fontSize.xxs, fontWeight: '800' }}>✓</Text>}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.docLabel, { color: pal.tx }, isMissing && { color: pal.rd }]}>{doc.label}</Text>
              <Text style={[styles.docSub, { color: pal.t3 }]}>{doc.sub}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.docDate, { color: pal.t3 }, isMissing && { color: pal.rd, fontWeight: '800' }]}>{doc.date}</Text>
              {doc.status === 'ok' && <Text style={styles.docOk}>✓ 유효</Text>}
              {isMissing && <Text style={styles.docMissing}>❌ 미등록</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ═══ 직원 서류 ════════════════════════════════════════════
export function StaffScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [staff] = useState(staffData);
  const expiredStaff = staff.filter(s => s.status === 'expired');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: pal.bg }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {expiredStaff.length > 0 && (
        <AlertBox type="error" icon="🚨" title="보건증 만료"
          message={expiredStaff.map(s => `${s.name} — ${s.health} 만료`).join('\n')} />
      )}
      {staff.map(s => {
        const expired = s.status === 'expired';
        return (
          <View key={s.id} style={{
            backgroundColor: pal.s1, borderRadius: radius.md, borderWidth: 1,
            borderColor: pal.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
          }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: fontSize.lg, fontWeight: '900' }}>{s.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '800', color: pal.tx }}>{s.name}</Text>
                  <StatusBadge status={expired ? 'expired' : 'ok'} />
                </View>
                <Text style={{ fontSize: fontSize.xs, color: pal.t3, marginBottom: 6 }}>{s.role} · 입사일 {s.hire}</Text>
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
                    expired ? { backgroundColor: '#fee2e2', borderColor: '#fecaca' } : { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                    <Text style={{ fontSize: fontSize.xs }}>🏥</Text>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: expired ? colors.rd : colors.gn }}>보건증 ~{s.health}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1, backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }}>
                    <Text style={{ fontSize: fontSize.xs }}>📚</Text>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: colors.gn }}>위생교육 ~{s.edu}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginBottom: 4, fontWeight: '600' }}>보건증 유효기간 ~{s.health}</Text>
                <ProgressBar pct={expired ? 0 : 85} color={expired ? colors.rd : colors.gn} height={6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginBottom: 4, fontWeight: '600' }}>위생교육 ~{s.edu}</Text>
                <ProgressBar pct={92} color={colors.gn} height={6} />
              </View>
            </View>
            {expired && <AlertBox type="warn" icon="⚠️" message={`보건증이 ${s.health} 만료. 즉시 갱신 바랍니다.`} />}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ═══ 재고 관리 ════════════════════════════════════════════
export function InventoryScreen() {
  const [items, setItems] = useState(inventoryData);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', unit: '', qty: '', minQty: '', price: '', cat: '소모품' });

  const criticals = items.filter(i => i.status === 'critical');
  const lows = items.filter(i => i.status === 'low');
  const totalVal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  const CONF = {
    ok:       { label: '정상', color: colors.gn, bg: '#dcfce7' },
    low:      { label: '부족', color: colors.yw, bg: '#fef9c3' },
    critical: { label: '긴급', color: colors.rd, bg: '#fee2e2' },
  };

  const handleSave = () => {
    const qty = parseFloat(form.qty) || 0;
    const minQty = parseFloat(form.minQty) || 0;
    const status = qty <= 0 ? 'critical' : qty < minQty ? 'low' : 'ok';
    setItems([...items, {
      id: Date.now().toString(), name: form.name, unit: form.unit || 'ea',
      qty, minQty, price: parseInt(form.price) || 0, cat: form.cat,
      lastOrder: new Date().toLocaleDateString('ko-KR'), status,
    }]);
    setModal(false);
    setForm({ name: '', unit: '', qty: '', minQty: '', price: '', cat: '소모품' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.statBar}>
        <StatMini label="전체 품목" value={`${items.length}종`} color={colors.a2} pal={colors} />
        <StatMini label="발주 필요" value={`${criticals.length + lows.length}건`} color={criticals.length ? colors.rd : colors.yw} pal={colors} />
        <StatMini label="재고 가치" value={`${Math.round(totalVal / 10000)}만원`} color={colors.gn} pal={colors} />
      </View>
      {criticals.length > 0 && (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <AlertBox type="error" icon="🚨" title="긴급 발주 필요" message={criticals.map(i => i.name).join(', ')} />
        </View>
      )}

      <View style={styles.filterRow}>
        {[{ k: 'all', l: '전체' }, { k: 'critical', l: '🔴 긴급' }, { k: 'low', l: '🟡 부족' }, { k: 'ok', l: '🟢 정상' }].map(f => (
          <TouchableOpacity key={f.k}
            style={[styles.filterBtn, filter === f.k && styles.filterBtnActive]}
            onPress={() => setFilter(f.k)}>
            <Text style={[styles.filterBtnText, filter === f.k && styles.filterBtnTextActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toolbar}>
        <Text style={[styles.toolTitle, { color: colors.tx }]}>📦 재고 현황</Text>
        <AddBtn label="+ 품목 추가" onPress={() => setModal(true)} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {filtered.map(item => {
          const conf = CONF[item.status] || CONF.ok;
          const pct = item.minQty > 0 ? Math.min(100, Math.round((item.qty / item.minQty) * 100)) : 100;
          return (
            <View key={item.id} style={styles.invCard}>
              <View style={styles.invTop}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={styles.invName}>{item.name}</Text>
                    <View style={styles.catBadge}><Text style={styles.catText}>{item.cat}</Text></View>
                  </View>
                  <Text style={styles.invMeta}>최근 발주: {item.lastOrder} · {item.price.toLocaleString()}원/{item.unit}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.invQty, { color: conf.color }]}>{item.qty}</Text>
                  <Text style={styles.invUnit}>{item.unit} / 최소 {item.minQty}</Text>
                </View>
              </View>
              <View style={styles.invBarRow}>
                <View style={{ flex: 1 }}>
                  <ProgressBar pct={pct} color={conf.color} height={7} />
                </View>
                <View style={[styles.invStatusBadge, { backgroundColor: conf.bg }]}>
                  <Text style={[styles.invStatusText, { color: conf.color }]}>{conf.label}</Text>
                </View>
                {item.status !== 'ok' && (
                  <TouchableOpacity style={styles.orderBtn}>
                    <Text style={styles.orderBtnText}>발주</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrap}>
          <ModalHeader title="📦 품목 추가" onClose={() => setModal(false)} pal={colors} />
          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            <FormField label="품목명 *" placeholder="예: 진공포장지 (대)" value={form.name}
              onChangeText={t => setForm({ ...form, name: t })} pal={colors} />
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <FormField label="단위" placeholder="roll, kg, ea" value={form.unit}
                  onChangeText={t => setForm({ ...form, unit: t })} pal={colors} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>카테고리</Text>
                <View style={styles.chipRow}>
                  {['소모품', '원재료', '장비'].map(c => (
                    <TouchableOpacity key={c} style={[styles.chip, form.cat === c && styles.chipActive]}
                      onPress={() => setForm({ ...form, cat: c })}>
                      <Text style={[styles.chipText, form.cat === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <FormField label="현재 수량" placeholder="0" value={form.qty}
                  onChangeText={t => setForm({ ...form, qty: t })} keyboardType="numeric" pal={colors} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="최소 수량" placeholder="0" value={form.minQty}
                  onChangeText={t => setForm({ ...form, minQty: t })} keyboardType="numeric" pal={colors} />
              </View>
            </View>
            <FormField label="단가 (원)" placeholder="예: 42000" value={form.price}
              onChangeText={t => setForm({ ...form, price: t })} keyboardType="numeric" pal={colors} />
            <PrimaryBtn label="📦 등록 완료" onPress={handleSave} style={{ marginTop: 8 }} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ═══ 공통 헬퍼 ════════════════════════════════════════════
const ModalHeader = ({ title, onClose, pal }) => (
  <View style={[styles.modalHeader, { borderBottomColor: pal.bd }]}>
    <Text style={[styles.modalTitle, { color: pal.tx }]}>{title}</Text>
    <TouchableOpacity onPress={onClose}>
      <Text style={[styles.modalClose, { color: pal.t2 }]}>✕</Text>
    </TouchableOpacity>
  </View>
);

const FormField = ({ label, pal, ...props }) => (
  <View style={{ marginBottom: spacing.md }}>
    {label && <Text style={[styles.formLabel, { color: pal.t2 }]}>{label}</Text>}
    <TextInput
      style={[styles.input, { backgroundColor: pal.bg, borderColor: pal.bd, color: pal.tx }]}
      placeholderTextColor={pal.t3}
      {...props}
    />
  </View>
);

const StatMini = ({ label, value, color, pal }) => (
  <View style={[styles.statMini, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
    <Text style={[styles.statVal, { color }]}>{value}</Text>
    <Text style={[styles.statLbl, { color: pal.t3 }]}>{label}</Text>
  </View>
);

// ═══ 공통 스타일 ══════════════════════════════════════════
const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  statMini: {
    flex: 1, borderRadius: radius.md,
    borderWidth: 1, padding: spacing.sm + 2,
    alignItems: 'center', ...shadow.sm,
  },
  statVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 3 },
  statLbl: { fontSize: fontSize.xxs, fontWeight: '600', textAlign: 'center' },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toolTitle: { fontSize: fontSize.md, fontWeight: '800' },
  pdfBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1.5, backgroundColor: '#eff6ff' },
  pdfBtnText: { fontSize: fontSize.sm, fontWeight: '800' },

  // 위생일지
  logCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logDate: { fontSize: fontSize.md, fontWeight: '700', marginBottom: 3 },
  logInspector: { fontSize: fontSize.xs },
  logExpand: { borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm },
  logItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1 },
  logItemText: { fontSize: fontSize.sm },

  // 온도
  tempCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  tempRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tempDate: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 3 },
  tempPerson: { fontSize: fontSize.xxs },
  tempVals: { flex: 1, alignItems: 'center' },
  tempVal: { fontSize: fontSize.xl, fontWeight: '900' },
  tempHumid: { fontSize: fontSize.xs },
  tempBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  tempNote: { fontSize: fontSize.xs, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1 },

  // 서류
  docSection: { borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, overflow: 'hidden', ...shadow.sm },
  docSectionTitle: { fontSize: fontSize.md, fontWeight: '800', padding: spacing.md, borderBottomWidth: 1 },
  docRow: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, borderBottomWidth: 1, gap: 12 },
  docLabel: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: 3 },
  docSub: { fontSize: fontSize.xxs },
  docDate: { fontSize: fontSize.xxs },
  docOk: { fontSize: fontSize.xxs, color: colors.gn, fontWeight: '700' },
  docMissing: { fontSize: fontSize.xxs, color: colors.rd, fontWeight: '800' },

  // 직원
  staffCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  staffTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  staffAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  staffAvatarText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '900' },
  staffNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  staffName: { fontSize: fontSize.md, fontWeight: '800' },
  staffRole: { fontSize: fontSize.xs, marginBottom: 6 },
  docBadgeRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  docBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
  docBadgeGreen: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  docBadgeRed: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  barRow: { flexDirection: 'row', gap: spacing.sm },
  barLabel: { fontSize: fontSize.xxs, marginBottom: 4, fontWeight: '600' },

  // 재고
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.bd, backgroundColor: colors.s1, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: colors.ac, borderColor: colors.ac },
  filterBtnText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },
  filterBtnTextActive: { color: '#fff', fontWeight: '800' },
  invCard: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  invTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  invName: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  invMeta: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 2 },
  invQty: { fontSize: fontSize.xl, fontWeight: '900' },
  invUnit: { fontSize: fontSize.xxs, color: colors.t3 },
  invBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  invStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  invStatusText: { fontSize: fontSize.xs, fontWeight: '800' },
  catBadge: { backgroundColor: colors.s2, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  catText: { fontSize: fontSize.xxs, color: colors.t2, fontWeight: '700' },
  orderBtn: { backgroundColor: colors.ac, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 },
  orderBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },

  // 공통 모달
  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800' },
  modalClose: { fontSize: 20, padding: 4 },

  formLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1.5, borderRadius: radius.sm, padding: 13, fontSize: fontSize.sm },
  rowInputs: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.bd, backgroundColor: colors.s1 },
  chipActive: { backgroundColor: colors.ac, borderColor: colors.ac },
  chipText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '800' },

  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, gap: 12 },
  checkBox: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: colors.gn, borderColor: colors.gn },
  checkBoxWarn: { borderColor: colors.yw },
  checkLabel: { fontSize: fontSize.sm },
});
