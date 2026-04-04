import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { useRole, OWNER_ONLY } from '../lib/RoleContext';
import { PrimaryBtn } from '../components/UI';
import { hygieneData, agingData, tempData, staffData } from '../data/mockData';
import {
  genHygieneHTML, genTempHTML, genAgingHTML, genStaffHTML, printAndShare,
} from '../lib/pdfTemplate';

async function loadBiz() {
  try {
    const raw = await AsyncStorage.getItem('@meatbig_biz');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
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
    id: 'tax',
    title: '세무 리포트',
    icon: '📊',
    desc: '월별 매출 요약 · 부가세 신고 참고 · CSV 다운로드',
    color: '#00ACC1',
    screen: 'TaxReport',
    getHTML: null,  // PDF 없음 — 화면 이동만
  },
];

async function printDoc(doc) {
  const biz = await loadBiz();
  const html = doc.getHTML(biz);
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>

        {/* ── 점검 입력 바로가기 ── */}
        <Text style={[styles.sectionLabel, { color: pal.t2 }]}>점검 입력 바로가기</Text>
        <View style={styles.shortcutGrid}>
          <Shortcut pal={pal} icon="🧼" label="위생 일지" onPress={() => navigateSafe('Hygiene')} color="#27AE60" />
          <Shortcut pal={pal} icon="🌡️" label="온도 기록" onPress={() => navigateSafe('Temp')} color="#00ACC1" />
          <Shortcut pal={pal} icon="💰" label="마감 정산" onPress={() => navigateSafe('Closing')} color="#E8950A" locked={isStaff} />
          <Shortcut pal={pal} icon="🥩" label="숙성 관리" onPress={() => navigateSafe('Aging')} color="#C0392B" locked={isStaff} />
          <Shortcut pal={pal} icon="📚" label="교육일지" onPress={() => navigateSafe('Education')} color="#7C3AED" locked={isStaff} />
          <Shortcut pal={pal} icon="📊" label="세무리포트" onPress={() => navigateSafe('TaxReport')} color="#00ACC1" locked={isStaff} />
        </View>

        {/* ── 출력하기 버튼 ── */}
        <TouchableOpacity style={styles.printBigBtn} onPress={() => setPrintModal(true)} activeOpacity={0.85}>
          <Text style={{ fontSize: 32 }}>🖨️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.printBigLabel}>출력하기</Text>
            <Text style={styles.printBigDesc}>위생·온도·숙성·보건증 서류를 PDF로 출력</Text>
          </View>
          <View style={styles.printBigBadge}>
            <Text style={styles.printBigBadgeText}>PDF</Text>
          </View>
        </TouchableOpacity>

        {/* ── 서류 목록 ── */}
        <Text style={[styles.sectionLabel, { color: pal.t2 }]}>관리 서류 현황</Text>
        {DOCS.map(doc => {
          const locked = isStaff && OWNER_ONLY.includes(doc.screen);
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
            <View style={[styles.docBadge, { backgroundColor: doc.color + '20' }]}>
              <Text style={[styles.docBadgeText, { color: doc.color }]}>
                {locked ? '🔒 사장 전용' : '보기 →'}
              </Text>
            </View>
          </TouchableOpacity>
          );
        })}
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
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
            <Text style={{ fontSize: fontSize.sm, color: pal.t3, marginBottom: spacing.lg }}>
              선택한 서류를 PDF로 생성하여 공유하거나 저장합니다
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
      <Text style={{ fontSize: 34 }}>{locked ? '🔒' : icon}</Text>
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
    width: '47%', borderRadius: radius.lg,
    borderWidth: 1.5, padding: spacing.md, alignItems: 'center', gap: spacing.sm, ...shadow.sm,
  },
  shortcutIcon: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: fontSize.md, fontWeight: '800', textAlign: 'center' },

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
});
