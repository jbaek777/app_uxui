import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Modal, TextInput,
} from 'react-native';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { staffData } from '../data/mockData';

export default function SettingsScreen({ route }) {
  const biz = route?.params?.biz || { bizName: 'MeatBig 매장', owner: '사장님', bizNo: '000-00-00000', species: ['한우'] };
  const [notifications, setNotifications] = useState({ hygiene: true, expiry: true, temp: false });
  const [staff, setStaff] = useState(staffData);
  const [staffModal, setStaffModal] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const toggleNotif = (key) => setNotifications(p => ({ ...p, [key]: !p[key] }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>

      {/* 사업장 정보 */}
      <SectionTitle icon="🏪" label="사업장 정보" />
      <View style={styles.infoCard}>
        <InfoRow label="상호명" value={biz.bizName} />
        <InfoRow label="대표자" value={biz.owner} />
        <InfoRow label="사업자번호" value={biz.bizNo} />
        <InfoRow label="취급 축종" value={(biz.species || []).join(', ')} />
      </View>

      {/* 직원 관리 */}
      <SectionTitle icon="👥" label="직원 관리" />
      <View style={styles.card}>
        {staff.map(s => (
          <View key={s.id} style={styles.staffRow}>
            <View style={[styles.avatar, { backgroundColor: s.color + '30' }]}>
              <Text style={[styles.avatarText, { color: s.color }]}>{s.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.staffName}>{s.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: s.role === '사장' ? colors.ac + '25' : colors.a2 + '20' }]}>
                  <Text style={[styles.roleBadgeText, { color: s.role === '사장' ? colors.ac : colors.a2 }]}>{s.role}</Text>
                </View>
              </View>
              <Text style={styles.staffMeta}>보건증 만료: {s.health}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: s.status === 'ok' ? colors.gn : colors.rd }]} />
          </View>
        ))}
        <TouchableOpacity style={styles.addStaffRow} onPress={() => setStaffModal(true)}>
          <Text style={styles.addStaffText}>+ 직원 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 알림 설정 */}
      <SectionTitle icon="🔔" label="알림 설정" />
      <View style={styles.card}>
        <NotifRow label="위생점검 매일 09시 알림" value={notifications.hygiene} onChange={() => toggleNotif('hygiene')} />
        <NotifRow label="소비기한 임박 알림 (D-2)" value={notifications.expiry} onChange={() => toggleNotif('expiry')} />
        <NotifRow label="온도 이상 알림" value={notifications.temp} onChange={() => toggleNotif('temp')} />
      </View>

      {/* 구독 관리 */}
      <SectionTitle icon="💎" label="구독 관리" />
      <View style={[styles.card, { overflow: 'hidden' }]}>
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planTitle}>{isPro ? '🌟 프로 플랜' : '🆓 무료 플랜'}</Text>
            <Text style={styles.planDesc}>{isPro ? '수율계산기, 마감정산, 무제한 이력 저장' : '기본 위생 점검, 이력 50건 저장'}</Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: isPro ? colors.a2 + '25' : colors.t3 + '20' }]}>
            <Text style={[styles.planBadgeText, { color: isPro ? colors.a2 : colors.t3 }]}>
              {isPro ? '이용 중' : '무료'}
            </Text>
          </View>
        </View>
        {!isPro && (
          <PrimaryBtn label="프로로 업그레이드 →" color={colors.a2} style={{ marginTop: spacing.md }}
            onPress={() => Alert.alert('프로 플랜', '구독 페이지로 이동합니다.\n(월 9,900원 / 연 79,000원)')} />
        )}
      </View>

      {/* 라벨 프린터 */}
      <SectionTitle icon="🖨️" label="라벨 프린터" />
      <View style={styles.card}>
        <TouchableOpacity style={styles.printerRow} onPress={() => Alert.alert('프린터 연결', 'Bluetooth 프린터를 검색합니다.')}>
          <Text style={{ fontSize: 28 }}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerLabel}>프린터 검색</Text>
            <Text style={styles.printerDesc}>Bluetooth 라벨 프린터 연결</Text>
          </View>
          <Text style={{ color: colors.t3, fontSize: fontSize.lg }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 앱 정보 */}
      <SectionTitle icon="ℹ️" label="앱 정보" />
      <View style={styles.card}>
        <InfoRow label="앱 이름" value="MeatBig (미트빅)" />
        <InfoRow label="슬로건" value='"사장님은 고기만 써세요"' />
        <InfoRow label="버전" value="v1.0.0" />
      </View>

      {/* 직원 추가 모달 */}
      <Modal visible={staffModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>직원 추가</Text>
            <TouchableOpacity onPress={() => setStaffModal(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg }}>
            <Text style={{ color: colors.t2, fontSize: fontSize.sm, marginBottom: spacing.md }}>직원 정보를 입력하세요</Text>
            <PrimaryBtn label="저장" onPress={() => setStaffModal(false)} />
            <OutlineBtn label="취소" onPress={() => setStaffModal(false)} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const SectionTitle = ({ icon, label }) => (
  <Text style={styles.sectionTitle}>{icon} {label}</Text>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const NotifRow = ({ label, value, onChange }) => (
  <View style={styles.notifRow}>
    <Text style={styles.notifLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.bd, true: colors.ac + '80' }}
      thumbColor={value ? colors.ac : colors.t3}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.t3, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.5 },

  card: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, marginBottom: spacing.sm, ...shadow.sm },
  infoCard: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, ...shadow.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.bd + '50' },
  infoLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },
  infoValue: { fontSize: fontSize.sm, color: colors.tx, fontWeight: '700', flex: 1, textAlign: 'right' },

  staffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.bd + '50' },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.md, fontWeight: '900' },
  staffName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx },
  staffMeta: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleBadgeText: { fontSize: fontSize.xxs, fontWeight: '800' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  addStaffRow: { paddingVertical: 16, alignItems: 'center' },
  addStaffText: { fontSize: fontSize.sm, color: colors.a2, fontWeight: '700' },

  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.bd + '50' },
  notifLabel: { fontSize: fontSize.sm, color: colors.tx, fontWeight: '600', flex: 1, marginRight: spacing.sm },

  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  planTitle: { fontSize: fontSize.md, fontWeight: '900', color: colors.tx, marginBottom: 4 },
  planDesc: { fontSize: fontSize.xs, color: colors.t3 },
  planBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  planBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },

  printerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  printerLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx, marginBottom: 3 },
  printerDesc: { fontSize: fontSize.xs, color: colors.t3 },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.bd, backgroundColor: colors.s1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900', color: colors.tx },
  closeBtn: { fontSize: 22, color: colors.t2, padding: 4 },
});
