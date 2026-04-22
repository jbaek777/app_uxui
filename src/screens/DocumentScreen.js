import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, spacing, radius, shadow } from '../theme';
import { useRole, OWNER_ONLY } from '../lib/RoleContext';
import { hygieneData, agingData, tempData, staffData, meats as mockMeats } from '../data/mockData';
import { educationStore, meatStore } from '../lib/dataStore';
import {
  genHygieneHTML, genTempHTML, genAgingHTML, genStaffHTML,
  genEducationAllHTML, genTaxReportHTML, printAndShare,
} from '../lib/pdfTemplate';
import ScreenHeader from '../components/ScreenHeader';
import SegmentTabs from '../components/SegmentTabs';
import ScanScreen from './ScanScreen';
import UploadScreen from './UploadScreen';

// ── V5 색상 상수 ──────────────────────────────────────────────
const C = {
  bg:'#F2F4F8', white:'#FFFFFF', red:'#B91C1C', red2:'#DC2626',
  redS:'rgba(185,28,28,0.08)', redS2:'rgba(185,28,28,0.14)',
  ok:'#15803D', ok2:'#16A34A', okS:'rgba(21,128,61,0.09)',
  warn:'#B45309', warn2:'#D97706', warnS:'rgba(180,83,9,0.09)',
  blue:'#1D4ED8', blue2:'#2563EB', blueS:'rgba(29,78,216,0.09)',
  pur:'#6D28D9', purS:'rgba(109,40,217,0.09)',
  t1:'#0F172A', t2:'#334155', t3:'#64748B', t4:'#94A3B8',
  border:'#E2E8F0', bg2:'#F1F5F9', bg3:'#E8ECF2',
};

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
    icon: 'shield-checkmark',
    iconColor: C.blue2,
    iconBg: C.blueS,
    desc: '일일 위생·HACCP 점검 기록',
    screen: 'Hygiene',
    getHTML: (biz) => genHygieneHTML(hygieneData, biz),
  },
  {
    id: 'temp',
    title: '온도관리 기록부',
    icon: 'thermometer',
    iconColor: C.blue2,
    iconBg: C.blueS,
    desc: '냉장·숙성실 온도·습도 기록',
    screen: 'Temp',
    getHTML: (biz) => genTempHTML(tempData, biz),
  },
  {
    id: 'aging',
    title: '숙성 관리 대장',
    icon: 'nutrition',
    iconColor: C.warn2,
    iconBg: C.warnS,
    desc: '드라이에이징 이력 및 수율 기록',
    screen: 'Aging',
    getHTML: (biz) => genAgingHTML(agingData, biz),
  },
  {
    id: 'education',
    title: '교육 일지',
    icon: 'book',
    iconColor: C.ok2,
    iconBg: C.okS,
    desc: '위생 교육 이수 기록',
    screen: 'Education',
    plan: 'basic',
    getHTML: async (biz) => {
      const logs = await educationStore.load();
      return genEducationAllHTML(logs, biz);
    },
  },
  {
    id: 'tax',
    title: '세무 리포트',
    icon: 'bar-chart',
    iconColor: C.pur,
    iconBg: C.purS,
    desc: '월별 매출·원가·마진 분석',
    screen: 'TaxReport',
    plan: 'pro',
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
  const html = await doc.getHTML(biz);
  if (!html || html.trim().length === 0) {
    Alert.alert('오류', 'PDF 내용을 생성할 수 없습니다.');
    return;
  }
  await printAndShare(html, doc.title);
}

// ── 바로가기 버튼 컴포넌트 ────────────────────────────────────
const ScBtn = ({ icon, label, iconColor, iconBg, onPress, plan }) => (
  <TouchableOpacity style={S.scBtn} onPress={onPress} activeOpacity={0.8}>
    {plan === 'basic' && (
      <View style={S.planBdgBasic}><Text style={S.planBdgBasicTxt}>베이직</Text></View>
    )}
    {plan === 'pro' && (
      <View style={S.planBdgPro}><Text style={S.planBdgProTxt}>프로</Text></View>
    )}
    <View style={[S.scIc, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={S.scLb}>{label}</Text>
  </TouchableOpacity>
);

// ── 상단 세그먼트: 서류관리 / 이력조회 / 서류OCR ─────────────
const SEGMENTS = [
  { key: 'docs', label: '서류관리', icon: 'folder-outline' },
  { key: 'scan', label: '이력조회', icon: 'scan-outline' },
  { key: 'ocr',  label: '서류OCR', icon: 'camera-outline' },
];

export default function DocumentScreen({ navigation }) {
  const { role, canAccess } = useRole();
  const isStaff = role === 'staff';

  const [segment, setSegment] = useState('docs'); // 'docs' | 'scan' | 'ocr'
  const [printModal, setPrintModal] = useState(false);
  const [printing, setPrinting] = useState(false);

  const navigateSafe = (screen) => {
    if (OWNER_ONLY.includes(screen) && isStaff) {
      Alert.alert('사장 전용', '이 기능은 사장 모드에서만 사용할 수 있습니다.');
      return;
    }
    navigation.navigate(screen);
  };

  const handlePrint = async (doc) => {
    setPrintModal(false);
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
    <View style={S.container}>

      {/* ── 공통 ScreenHeader (뒤로가기 + 일체감) ── */}
      <ScreenHeader
        title="서류·조회"
        iconName="document-text-outline"
        onBackPressOverride={() => {
          // 탭 루트에서는 홈탭으로 이동
          try { navigation.getParent?.()?.navigate?.('HomeTab'); } catch (_) {}
        }}
      />

      {/* ── 상단 세그먼트 탭 ── */}
      <SegmentTabs
        tabs={SEGMENTS}
        activeKey={segment}
        onChange={setSegment}
      />

      {/* ── 세그먼트별 콘텐츠 ── */}
      {segment === 'scan' && (
        <ScanScreen embedded initialMode="trace" navigation={navigation} />
      )}

      {segment === 'ocr' && (
        <UploadScreen embedded navigation={navigation} />
      )}

      {segment === 'docs' && (
        <ScrollView contentContainerStyle={S.scroll}>

          {/* ── 바로가기 그리드 (3x2) ── */}
          <View style={S.scGrid}>
            <ScBtn icon="shield-checkmark" label="위생 일지"  iconColor={C.blue2} iconBg={C.blueS} onPress={() => navigateSafe('Hygiene')} />
            <ScBtn icon="thermometer"      label="온도 기록"  iconColor={C.blue2} iconBg={C.blueS} onPress={() => navigateSafe('Temp')} />
            <ScBtn icon="calculator"       label="마감 정산"  iconColor={C.red}   iconBg={C.redS}  onPress={() => navigateSafe('Closing')} />
            <ScBtn icon="nutrition"        label="숙성 관리"  iconColor={C.warn2} iconBg={C.warnS} onPress={() => navigateSafe('Aging')} />
            <ScBtn icon="book"             label="교육 일지"  iconColor={C.ok2}   iconBg={C.okS}   onPress={() => navigateSafe('Education')} plan="basic" />
            <ScBtn icon="bar-chart"        label="세무 리포트" iconColor={C.pur}  iconBg={C.purS}  onPress={() => navigateSafe('TaxReport')} plan="pro" />
          </View>

          {/* ── 서류 출력 섹션 ── */}
          <View style={S.sec}><Text style={S.secT}>서류 출력</Text></View>
          <View style={S.docList}>
            {DOCS.map(doc => {
              const locked = isStaff && OWNER_ONLY.includes(doc.screen);
              const pillLocked = doc.plan === 'basic' ? '베이직↑' : doc.plan === 'pro' ? '프로↑' : null;
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[S.docItem, locked && { opacity: 0.5 }]}
                  onPress={() => navigateSafe(doc.screen)}
                  activeOpacity={0.8}
                >
                  <View style={[S.docIc, { backgroundColor: doc.iconBg }]}>
                    <Ionicons name={doc.icon} size={20} color={doc.iconColor} />
                  </View>
                  <View style={S.docTx}>
                    <Text style={S.docNm}>{doc.title}</Text>
                    <Text style={S.docSb}>{doc.desc}</Text>
                  </View>
                  {pillLocked ? (
                    <View style={S.pillGray}><Text style={S.pillGrayTxt}>{pillLocked}</Text></View>
                  ) : (
                    <View style={S.pillBlue}><Text style={S.pillBlueTxt}>출력 가능</Text></View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── PDF 일괄 출력 버튼 ── */}
          <TouchableOpacity style={S.bulkBtn} onPress={() => setPrintModal(true)} activeOpacity={0.85}>
            <View style={S.bulkIc}>
              <Ionicons name="print" size={22} color="#fff" />
            </View>
            <View style={S.bulkTx}>
              <Text style={S.bulkTtl}>PDF 일괄 출력</Text>
              <Text style={S.bulkSb}>위생·온도·숙성·교육·세무 PDF 생성 및 공유</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* ── 플랜 안내 ── */}
          <View style={S.planNotice}>
            <Text style={S.planNoticeTxt}>
              교육일지는 베이직, 세무리포트는 프로 플랜에서 출력 가능합니다.
            </Text>
          </View>

        </ScrollView>
      )}

      {/* ── 출력 로딩 오버레이 ── */}
      {printing && (
        <View style={S.loadingOverlay}>
          <View style={S.loadingBox}>
            <ActivityIndicator size="large" color={C.red} />
            <Text style={S.loadingTxt}>PDF 생성 중...</Text>
          </View>
        </View>
      )}

      {/* ── 출력 선택 모달 ── */}
      <Modal visible={printModal} animationType="slide" presentationStyle="pageSheet">
        <View style={S.modalContainer}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>어떤 서류를 출력할까요?</Text>
            <TouchableOpacity onPress={() => setPrintModal(false)} style={S.modalClose}>
              <Ionicons name="close" size={22} color={C.t2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            <Text style={S.modalSubtxt}>
              선택한 서류를 PDF로 생성하여 공유하거나 저장합니다{'\n'}
              <Text style={{ fontSize: 12, color: C.t4 }}>교육일지·세무리포트는 현재 저장된 전체 데이터 기준</Text>
            </Text>
            {DOCS.map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={[S.printCard, { borderColor: doc.iconColor + '40' }]}
                onPress={() => handlePrint(doc)}
                activeOpacity={0.85}
              >
                <View style={[S.printCardIc, { backgroundColor: doc.iconBg }]}>
                  <Ionicons name={doc.icon} size={30} color={doc.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.printCardTitle}>{doc.title}</Text>
                  <Text style={S.printCardDesc}>{doc.desc}</Text>
                </View>
                <View style={[S.printBtn, { backgroundColor: doc.iconColor }]}>
                  <Text style={S.printBtnTxt}>출력</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // 헤더
  header:       { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, overflow: 'hidden' },
  headerAccent: { height: 3, backgroundColor: C.red, position: 'absolute', top: 0, left: 0, right: 0 },
  headerTop:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 13, flexDirection: 'row', alignItems: 'center' },
  brand:        { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIc:      { width: 33, height: 33, borderRadius: 10, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  brandNm:      { fontSize: 22, fontWeight: '900', color: C.t1, letterSpacing: -0.6 },

  scroll: { padding: 16, paddingBottom: 100 },

  // 바로가기 그리드
  scGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  scBtn:        { width: '31%', backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', gap: 8, position: 'relative', overflow: 'visible' },
  scIc:         { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scLb:         { fontSize: 13, fontWeight: '700', color: C.t1, textAlign: 'center' },
  planBdgBasic: { position: 'absolute', top: -7, right: -4, backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  planBdgBasicTxt: { fontSize: 10, fontWeight: '800', color: '#065F46' },
  planBdgPro:   { position: 'absolute', top: -7, right: -4, backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  planBdgProTxt: { fontSize: 10, fontWeight: '800', color: '#991B1B' },

  // 섹션 라벨
  sec:  { marginTop: 4, marginBottom: 10 },
  secT: { fontSize: 14, fontWeight: '800', color: C.t2, letterSpacing: 0.3 },

  // 서류 목록
  docList:  { gap: 0, marginBottom: 16 },
  docItem:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 14, paddingHorizontal: 4 },
  docIc:    { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docTx:    { flex: 1 },
  docNm:    { fontSize: 15, fontWeight: '700', color: C.t1, marginBottom: 2 },
  docSb:    { fontSize: 12, color: C.t3 },
  pillBlue: { backgroundColor: C.blueS, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  pillBlueTxt: { fontSize: 12, fontWeight: '700', color: C.blue },
  pillGray: { backgroundColor: C.bg3, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  pillGrayTxt: { fontSize: 12, fontWeight: '700', color: C.t3 },

  // 일괄 출력 버튼
  bulkBtn:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.t1, borderRadius: 16, padding: 20, marginBottom: 14 },
  bulkIc:   { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  bulkTx:   { flex: 1 },
  bulkTtl:  { fontSize: 16, fontWeight: '900', color: '#fff', marginBottom: 3 },
  bulkSb:   { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  // 플랜 안내
  planNotice:    { backgroundColor: C.warnS, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(180,83,9,0.15)', padding: 14 },
  planNoticeTxt: { fontSize: 13, color: C.warn, lineHeight: 20, textAlign: 'center' },

  // 로딩 오버레이
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  loadingBox:     { backgroundColor: C.white, borderRadius: 16, padding: 28, alignItems: 'center', gap: 14 },
  loadingTxt:     { color: C.t1, fontSize: 15, fontWeight: '700' },

  // 모달
  modalContainer: { flex: 1, backgroundColor: C.bg },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  modalTitle:     { fontSize: 17, fontWeight: '900', color: C.t1 },
  modalClose:     { padding: 4 },
  modalSubtxt:    { fontSize: 14, color: C.t3, marginBottom: 20, lineHeight: 22 },
  printCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, padding: 16, marginBottom: 12 },
  printCardIc:    { width: 58, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  printCardTitle: { fontSize: 16, fontWeight: '800', color: C.t1, marginBottom: 4 },
  printCardDesc:  { fontSize: 13, color: C.t3 },
  printBtn:       { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 10, alignItems: 'center', minWidth: 56 },
  printBtnTxt:    { color: '#fff', fontSize: 14, fontWeight: '900' },
});
