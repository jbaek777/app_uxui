import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { useRole, OWNER_ONLY } from '../lib/RoleContext';
import { PrimaryBtn } from '../components/UI';
import { hygieneData, agingData, tempData, staffData, meats as mockMeats } from '../data/mockData';
import { educationStore, meatStore } from '../lib/dataStore';
import {
  genHygieneHTML, genTempHTML, genAgingHTML, genStaffHTML,
  genEducationAllHTML, genTaxReportHTML, printAndShare,
} from '../lib/pdfTemplate';

async function loadBiz() {
  try {
    const raw = await AsyncStorage.getItem('@meatbig_biz');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

// ── 세무리포트용 월별 집계 (TaxReportScreen과 동일 로직) ──────
function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(/\./g, '-'));
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function buildMonthlyReport(items) {
  const byMonth = {};
  items.forEach(item => {
    if (!item.sold) return;
    const key = monthKey(item.soldDate) || monthKey(item.expire);
    if (!key) return;
    if (!byMonth[key]) {
      byMonth[key] = { month: key, salesCount: 0, totalQty: 0, totalSales: 0, totalCost: 0, totalMargin: 0, exemptSales: 0, taxableSales: 0, items: [] };
    }
    const row = byMonth[key];
    const sales = (item.sellPrice || 0) * (item.qty || 0);
    const cost  = (item.buyPrice  || 0) * (item.qty || 0);
    row.salesCount += 1;
    row.totalQty   += item.qty || 0;
    row.totalSales += sales;
    row.totalCost  += cost;
    row.totalMargin += (sales - cost);
    row.exemptSales += sales;
    row.items.push(item);
  });
  items.forEach(item => {
    if (item.sold) return;
    const key = monthKey(item.inboundDate) || monthKey(item.expire);
    if (!key) return;
    if (!byMonth[key]) {
      byMonth[key] = { month: key, salesCount: 0, totalQty: 0, totalSales: 0, totalCost: 0, totalMargin: 0, exemptSales: 0, taxableSales: 0, items: [] };
    }
    byMonth[key].totalCost += (item.buyPrice || 0) * (item.qty || 0);
  });
  return Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
}

const DOCS = [
  {
    id: 'hygiene',
    title: '위생관리 점검표',
    icon: '🧼',
    desc: '일일 위생·HACCP 점검 기록',
    color: '#27AE60',
    screen: 'Hygiene',
    getHTML: (biz) => genHygieneHTML(hygieneData, biz),
  },
  {
    id: 'temp',
    title: '온도관리 기록부',
    icon: '🌡️',
    desc: '냉장·숙성실 온도·습도 기록',
    color: '#00ACC1',
    screen: 'Temp',
    getHTML: (biz) => genTempHTML(tempData, biz),
  },
  {
    id: 'aging',
    title: '숙성 관리 대장',
    icon: '🥩',
    desc: '드라이에이징 이력 및 수율 기록',
    color: '#E8950A',
    screen: 'Aging',
    getHTML: (biz) => genAgingHTML(agingData, biz),
  },
  {
    id: 'staff',
    title: '직원 보건증 현황',
    icon: '👥',
    desc: '보건증·위생교육 이수증 만료일',
    color: '#8E44AD',
    screen: 'Staff',
    getHTML: (biz) => genStaffHTML(staffData, biz),
  },
  {
    id: 'education',
    title: '영업자 자체위생교육 일지',
    icon: '📚',
    desc: '월 1회 직원 위생교육 실시 기록',
    color: '#7C3AED',
    screen: 'Education',
    getHTML: async (biz) => {
      const logs = await educationStore.load();
      return genEducationAllHTML(logs, biz);
    },
  },
  {
    id: 'tax',
    title: '세무 리포트',
    icon: '📊',
    desc: '연간 매출·매입·마진 요약 · 부가세 신고 참고용',
    color: '#00ACC1',
    screen: 'TaxReport',
    getHTML: async (biz) => {
      const items = await meatStore.load(mockMeats);
      const months = buildMonthlyReport(items);
      const year = new Date().getFullYear();
      const filtered = months.filter(m => m.month.startsWith(String(year)));
      return genTaxReportHTML(filtered, biz, year);
    },
  },
];

async function printDoc(doc) {
  const biz = await loadBiz();
  const html = await doc.getHTML(biz);  // async getHTML 지원 (교육일지·세무리포트)
  if (!html || html.trim().length === 0) {
    Alert.alert('오류', 'PDF 내용을 생성할 수 없습니다.');
    return;
  }
  await printAndShare(html, doc.title);
}

export default function DocumentScreen({ navigation }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { role, canAccess } = useRole();
  const isStaff = role === 'staff';

  const [printModal, setPrintModal] = useState(false);
  const [printing, setPrinting] = useState(false);

  // 직원 모드에서 사장 전용 화면 접근 차단
  const navigateSafe = (screen) => {
    if (OWNER_ONLY.includes(screen) && isStaff) {
      Alert.alert('🔒 사장 전용', '이 기능은 사장 모드에서만 사용할 수 있습니다.');
      return;
    }
    navigation.navigate(screen);
  };

  const handlePrint = async (doc) => {
    // 1. 모달 먼저 닫기
    setPrintModal(false);
    // 2. 모달 닫힘 애니메이션(300ms) 완료 대기 후 PDF 실행
    //    → 모달과 시스템 다이얼로그 동시 오픈 충돌 방지
    setTimeout(async () => {
      setPrinting(true);
      try {
        await printDoc(doc);
      } catch (e) {
        Alert.alert('출력 오류', e?.message || 'PDF 생성 중 문제가 발생했습니다.');
      } finally {
        setPrinting(false);
      }
    }, 400);
  };

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>

        {/* ── 바로가기 (3열 그리드) ── */}
        <Text style={[styles.sectionLabel, { color: pal.t2 }]}>바로가기</Text>
        <View style={styles.shortcutGrid}>
          <Shortcut pal={pal} icon="🧼" label="위생 일지"  onPress={() => navigateSafe('Hygiene')}   color="#27AE60" />
          <Shortcut pal={pal} icon="🌡️" label="온도 기록"  onPress={() => navigateSafe('Temp')}       color="#00ACC1" />
          <Shortcut pal={pal} icon="💰" label="마감 정산"  onPress={() => navigateSafe('Closing')}    color="#E8950A" locked={isStaff} />
          <Shortcut pal={pal} icon="🥩" label="숙성 관리"  onPress={() => navigateSafe('Aging')}      color="#C0392B" locked={isStaff} />
          <Shortcut pal={pal} icon="📚" label="교육일지"   onPress={() => navigateSafe('Education')}  color="#7C3AED" locked={isStaff} />
          <Shortcut pal={pal} icon="📊" label="세무리포트" onPress={() => navigateSafe('TaxReport')}  color="#00ACC1" locked={isStaff} />
        </View>

        {/* ── PDF 출력 목록 ── */}
        <Text style={[styles.sectionLabel, { color: pal.t2 }]}>PDF 출력</Text>
        {DOCS.map(doc => {
          const locked = isStaff && OWNER_ONLY.includes(doc.screen);
          const planBadge =
            doc.id === 'education' ? { label: '베이직', color: '#27AE60' } :
            doc.id === 'tax'       ? { label: '프로',   color: '#C0392B' } : null;
          return (
          <TouchableOpacity
            key={doc.id}
            style={[styles.docCard, { backgroundColor: pal.s1, borderColor: locked ? pal.bd + '50' : pal.bd, opacity: locked ? 0.55 : 1 }]}
            activeOpacity={0.8}
            onPress={() => navigateSafe(doc.screen)}
          >
            <View style={[styles.docIconBox, { backgroundColor: doc.color + '20' }]}>
              <Text style={{ fontSize: 30 }}>{doc.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.docTitle, { color: pal.tx }]}>{doc.title}</Text>
              <Text style={[styles.docDesc, { color: pal.t3 }]}>{doc.desc}</Text>
            </View>
            {planBadge && !locked ? (
              <View style={[styles.planBadge, { backgroundColor: planBadge.color + '18', borderColor: planBadge.color + '40' }]}>
                <Text style={[styles.planBadgeText, { color: planBadge.color }]}>{planBadge.label}</Text>
              </View>
            ) : (
              <View style={[styles.docBadge, { backgroundColor: locked ? pal.bd + '20' : doc.color + '20' }]}>
                <Text style={[styles.docBadgeText, { color: locked ? pal.t3 : doc.color }]}>
                  {locked ? '🔒 사장' : '›'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          );
        })}

        {/* 출력 전용 CTA 버튼 */}
        <TouchableOpacity style={[styles.printBigBtn, { marginTop: spacing.sm }]} onPress={() => setPrintModal(true)} activeOpacity={0.85}>
          <Text style={{ fontSize: 28 }}>🖨️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.printBigLabel}>PDF 일괄 출력</Text>
            <Text style={styles.printBigDesc}>위생·온도·숙성·보건증·교육·세무 PDF 생성·공유</Text>
          </View>
          <View style={styles.printBigBadge}>
            <Text style={styles.printBigBadgeText}>PDF</Text>
          </View>
        </TouchableOpacity>

        {/* 플랜 안내 */}
        <View style={[styles.planNotice, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={[styles.planNoticeText, { color: pal.t3 }]}>
            ⚠️ 교육일지는 베이직, 세무리포트는 프로 플랜에서 출력 가능합니다
          </Text>
        </View>
      </ScrollView>

      {/* ── 출력 로딩 오버레이 ── */}
      {printing && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <View style={{
            backgroundColor: pal.s1, borderRadius: radius.lg,
            padding: spacing.xl, alignItems: 'center', gap: spacing.md,
          }}>
            <ActivityIndicator size="large" color={pal.ac} />
            <Text style={{ color: pal.tx, fontSize: fontSize.sm, fontWeight: '700' }}>PDF 생성 중...</Text>
          </View>
        </View>
      )}

      {/* ── 출력 선택 모달 ── */}
      <Modal visible={printModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>🖨️ 어떤 서류를 출력할까요?</Text>
            <TouchableOpacity onPress={() => setPrintModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
            <Text style={{ fontSize: fontSize.sm, color: pal.t3, marginBottom: spacing.lg }}>
              선택한 서류를 PDF로 생성하여 공유하거나 저장합니다{'\n'}
              <Text style={{ color: pal.t3, fontSize: fontSize.xxs }}>교육일지·세무리포트는 현재 저장된 전체 데이터 기준</Text>
            </Text>
            {DOCS.filter(d => d.getHTML !== null).map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.printSelectCard, { backgroundColor: pal.s1, borderColor: doc.color + '40' }]}
                onPress={() => handlePrint(doc)}
                activeOpacity={0.85}
              >
                <View style={[styles.printSelectIcon, { backgroundColor: doc.color + '20' }]}>
                  <Text style={{ fontSize: 36 }}>{doc.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.printSelectTitle, { color: pal.tx }]}>{doc.title}</Text>
                  <Text style={[styles.printSelectDesc, { color: pal.t3 }]}>{doc.desc}</Text>
                </View>
                <View style={[styles.printBtn, { backgroundColor: doc.color }]}>
                  <Text style={styles.printBtnText}>출력</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const Shortcut = ({ icon, label, onPress, color, pal, locked }) => (
  <TouchableOpacity
    style={[styles.shortcut, { backgroundColor: pal.s1, borderColor: locked ? pal.bd : color + '40', opacity: locked ? 0.45 : 1 }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.shortcutIcon, { backgroundColor: (locked ? pal.bd : color) + '20' }]}>
      <Text style={{ fontSize: 26 }}>{locked ? '🔒' : icon}</Text>
    </View>
    <Text style={[styles.shortcutLabel, { color: locked ? pal.t3 : pal.tx }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },

  sectionLabel: {
    fontSize: fontSize.sm, fontWeight: '800',
    marginBottom: spacing.md, marginTop: spacing.sm, letterSpacing: 0.5,
  },

  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  shortcut: {
    width: '31%', borderRadius: radius.md,
    borderWidth: 1, padding: spacing.md, alignItems: 'center', gap: 6, ...shadow.sm,
  },
  shortcutIcon: { width: 52, height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: fontSize.xs, fontWeight: '800', textAlign: 'center' },

  printBigBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: '#C0392B', borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.lg, ...shadow.md,
  },
  printBigLabel: { fontSize: fontSize.lg, fontWeight: '900', color: '#fff', marginBottom: 4 },
  printBigDesc: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)' },
  printBigBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  printBigBadgeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '900' },

  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  docIconBox: { width: 54, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 3 },
  docDesc: { fontSize: fontSize.xs },
  docBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  docBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900' },
  closeBtn: { fontSize: 22, padding: 4 },

  printSelectCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.lg, borderWidth: 1.5,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.sm,
  },
  printSelectIcon: { width: 72, height: 72, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  printSelectTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 4 },
  printSelectDesc: { fontSize: fontSize.xs },
  printBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.sm, alignItems: 'center', minWidth: 60 },
  printBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '900' },

  // 플랜 뱃지 + 안내
  planBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  planBadgeText: { fontSize: fontSize.xxs, fontWeight: '900' },
  planNotice: {
    borderRadius: radius.sm, borderWidth: 1,
    padding: spacing.md, marginTop: spacing.sm,
  },
  planNoticeText: { fontSize: fontSize.xs, lineHeight: 20, textAlign: 'center' },
});
