import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { staffData } from '../data/mockData';
import { staffStore } from '../lib/dataStore';
import {
  scheduleDailyHygieneReminder, cancelHygieneReminder,
  scheduleDailyExpiryReminder, cancelExpiryReminder,
} from '../utils/notifications';
import { useRole } from '../lib/RoleContext';
import { useSubscription, PLANS } from '../lib/SubscriptionContext';

const NOTIF_KEY = '@meatbig_notifications';

export default function SettingsScreen({ route, navigation }) {
  const { isDark, toggleTheme } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { role, staffName, switchToStaff, requestOwnerMode, changePin, ownerPin } = useRole();
  const { sub, plan: currentPlan, isPremium, isTrial, daysLeft, cancelSubscription } = useSubscription();
  const [pinChangeModal, setPinChangeModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const biz = route?.params?.biz || { bizName: 'MeatBig 매장', owner: '사장님', bizNo: '000-00-00000', species: ['한우'] };
  const [notifications, setNotifications] = useState({ hygiene: true, expiry: true, temp: false });
  const [staff, setStaff] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isFirst = useRef(true);
  const [staffModal, setStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: '직원', pin: '', health: '', edu: '' });
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ health: '', edu: '' });

  // ── 데이터 로드 ──
  useEffect(() => {
    staffStore.load(staffData).then(data => {
      setStaff(data);
      setLoaded(true);
    });
    // 알림 설정 로드
    AsyncStorage.getItem(NOTIF_KEY).then(raw => {
      if (raw) setNotifications(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  // ── 데이터 자동 저장 ──
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (loaded && staff.length >= 0) { staffStore.save(staff); }
  }, [staff]);

  const COLORS = ['#3d7ef5', '#27AE60', '#8E44AD', '#E74C3C', '#00ACC1', '#E8950A'];
  const [selectedColor, setSelectedColor] = useState('#3d7ef5');

  const openEditStaff = (s) => {
    setEditTarget(s);
    setEditForm({ health: s.health || '', edu: s.edu || '' });
    setEditModal(true);
  };

  const handleEditStaff = () => {
    if (!editTarget) return;
    setStaff(prev => prev.map(s =>
      s.id !== editTarget.id ? s : {
        ...s,
        health: editForm.health || s.health,
        edu: editForm.edu || s.edu,
        status: editForm.health && new Date(editForm.health.replace(/\./g, '-')) < new Date() ? 'expired' : 'ok',
      }
    ));
    setEditModal(false);
  };

  const handleAddStaff = () => {
    if (!newStaff.name.trim()) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return;
    }
    const id = Date.now().toString();
    setStaff([...staff, {
      id, name: newStaff.name.trim(), role: newStaff.role,
      pin: newStaff.pin || '0000',
      hire: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, ''),
      health: newStaff.health || '미등록',
      edu: newStaff.edu || '미등록',
      status: 'ok', color: selectedColor,
    }]);
    setNewStaff({ name: '', role: '직원', pin: '', health: '', edu: '' });
    setSelectedColor('#3d7ef5');
    setStaffModal(false);
  };

  const toggleNotif = async (key) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next)).catch(() => {});
    // 실제 알림 등록/취소
    if (key === 'hygiene') {
      next.hygiene ? scheduleDailyHygieneReminder().catch(() => {}) : cancelHygieneReminder().catch(() => {});
    } else if (key === 'expiry') {
      next.expiry ? scheduleDailyExpiryReminder().catch(() => {}) : cancelExpiryReminder().catch(() => {});
    }
  };

  const handlePinChange = async () => {
    if (newPin.length < 4) {
      Alert.alert('오류', 'PIN은 4자리 이상이어야 합니다.');
      return;
    }
    if (newPin !== newPinConfirm) {
      Alert.alert('오류', 'PIN이 일치하지 않습니다.');
      return;
    }
    await changePin(newPin);
    setNewPin('');
    setNewPinConfirm('');
    setPinChangeModal(false);
    Alert.alert('완료', '사장 PIN이 변경되었습니다.');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: pal.bg }]}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
    >

      {/* 권한 관리 */}
      <SectionTitle icon="🔐" label="권한 관리" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: role === 'owner' ? pal.ac + '40' : pal.a2 + '60' }]}>
        {/* 현재 모드 배너 */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: spacing.md, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: pal.bd,
          backgroundColor: role === 'owner' ? pal.ac + '10' : pal.a2 + '12',
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: role === 'owner' ? pal.ac + '25' : pal.a2 + '25',
          }}>
            <Text style={{ fontSize: 22 }}>{role === 'owner' ? '👑' : '👤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '900', color: role === 'owner' ? pal.ac : pal.a2 }}>
              {role === 'owner' ? '사장 모드' : `직원 모드${staffName ? ` — ${staffName}` : ''}`}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: pal.t3, marginTop: 2 }}>
              {role === 'owner' ? '모든 기능에 접근 가능합니다' : '위생·온도·이력 조회만 허용됩니다'}
            </Text>
          </View>
        </View>
        {/* 직원 모드 전환 (사장 모드에서) */}
        {role === 'owner' && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: pal.bd }}
            onPress={switchToStaff}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.tx }}>직원 모드로 전환</Text>
              <Text style={{ fontSize: fontSize.xs, color: pal.t3, marginTop: 2 }}>직원 선택 → PIN 입력 → 제한 모드 진입</Text>
            </View>
            <Text style={{ color: pal.a2, fontSize: fontSize.md }}>›</Text>
          </TouchableOpacity>
        )}
        {/* 사장 모드 복귀 (직원 모드에서) */}
        {role === 'staff' && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: pal.bd }}
            onPress={requestOwnerMode}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>🔐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.ac }}>사장 모드로 복귀</Text>
              <Text style={{ fontSize: fontSize.xs, color: pal.t3, marginTop: 2 }}>사장 PIN 입력 필요</Text>
            </View>
            <Text style={{ color: pal.ac, fontSize: fontSize.md }}>›</Text>
          </TouchableOpacity>
        )}
        {/* PIN 변경 (사장 모드에서만) */}
        {role === 'owner' && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 15 }}
            onPress={() => { setNewPin(''); setNewPinConfirm(''); setPinChangeModal(true); }}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>🔑</Text>
            <Text style={{ flex: 1, fontSize: fontSize.sm, color: pal.tx }}>사장 PIN 변경</Text>
            <Text style={{ color: pal.t3, fontSize: fontSize.xs }}>{ownerPin.replace(/./g, '●')}&nbsp;&nbsp;›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 사업장 정보 */}
      <SectionTitle icon="🏪" label="사업장 정보" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <InfoRow label="상호명" value={biz.bizName} pal={pal} />
        <InfoRow label="대표자" value={biz.owner} pal={pal} />
        <InfoRow label="사업자번호" value={biz.bizNo} pal={pal} />
        <InfoRow label="취급 축종" value={(biz.species || []).join(', ')} last pal={pal} />
      </View>

      {/* 화면 설정 */}
      <SectionTitle icon="🎨" label="화면 설정" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <View style={[styles.notifRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.notifLabel, { color: pal.tx }]}>
              {isDark ? '🌙 다크 모드' : '☀️ 라이트 모드'}
            </Text>
            <Text style={[styles.notifSubLabel, { color: pal.t3 }]}>
              {isDark ? '어두운 배경 사용 중' : '밝은 배경 사용 중'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: pal.bd2, true: pal.ac + '99' }}
            thumbColor={isDark ? pal.ac : pal.t3}
          />
        </View>
      </View>

      {/* 직원 관리 */}
      <SectionTitle icon="👥" label="직원 관리" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        {staff.map((s, idx) => (
          <TouchableOpacity
            key={s.id}
            activeOpacity={0.7}
            onPress={() => openEditStaff(s)}
            style={[
              styles.staffRow,
              { borderBottomColor: pal.bd + '50' },
              idx === staff.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: s.color + '30' }]}>
              <Text style={[styles.avatarText, { color: s.color }]}>{s.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.staffName, { color: pal.tx }]}>{s.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: s.role === '사장' ? pal.ac + '25' : pal.a2 + '20' }]}>
                  <Text style={[styles.roleBadgeText, { color: s.role === '사장' ? pal.ac : pal.a2 }]}>{s.role}</Text>
                </View>
              </View>
              <Text style={[styles.staffMeta, { color: pal.t3 }]}>보건증: {s.health}  ·  위생교육: {s.edu}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.statusDot, { backgroundColor: s.status === 'ok' ? pal.gn : pal.rd }]} />
              <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 4 }}>수정 ›</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addStaffRow} onPress={() => setStaffModal(true)}>
          <Text style={[styles.addStaffText, { color: pal.a2 }]}>+ 직원 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 알림 설정 */}
      <SectionTitle icon="🔔" label="알림 설정" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <NotifRow label="위생점검 매일 09시 알림" value={notifications.hygiene} onChange={() => toggleNotif('hygiene')} last={false} pal={pal} />
        <NotifRow label="소비기한 임박 알림 (D-2)" value={notifications.expiry} onChange={() => toggleNotif('expiry')} last={false} pal={pal} />
        <NotifRow label="온도 이상 알림" value={notifications.temp} onChange={() => toggleNotif('temp')} last pal={pal} />
      </View>

      {/* 구독 관리 */}
      <SectionTitle icon="💎" label="구독 관리" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: isPremium ? pal.gn + '60' : pal.bd, overflow: 'hidden' }]}>
        <View style={styles.planRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.planTitle, { color: pal.tx }]}>
              {currentPlan.emoji} {currentPlan.name}
            </Text>
            <Text style={[styles.planDesc, { color: pal.t3 }]}>
              {isTrial && daysLeft !== null
                ? `무료 체험 중 — ${daysLeft}일 남음`
                : isPremium
                  ? `${sub.billingCycle === 'annual' ? '연간' : '월간'} 구독 · ${sub.periodEndsAt ? new Date(sub.periodEndsAt).toLocaleDateString('ko-KR') + ' 만료' : ''}`
                  : '기본 위생 점검, 이력 50건 저장'}
            </Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: isPremium ? pal.gn + '20' : pal.t3 + '20' }]}>
            <Text style={[styles.planBadgeText, { color: isPremium ? pal.gn : pal.t3 }]}>
              {isTrial ? '체험 중' : isPremium ? '구독 중' : '무료'}
            </Text>
          </View>
        </View>
        {isPremium && (
          <TouchableOpacity
            style={{ paddingHorizontal: spacing.md, paddingVertical: 12, borderTopWidth: 1, borderTopColor: pal.bd + '50' }}
            onPress={() => navigation.navigate('Paywall')}
          >
            <Text style={{ fontSize: fontSize.sm, color: pal.a2, fontWeight: '700' }}>구독 관리 · 요금제 변경 →</Text>
          </TouchableOpacity>
        )}
        {!isPremium && (
          <PrimaryBtn
            label="14일 무료 체험 시작 →"
            color={pal.ac}
            style={{ margin: spacing.md, marginTop: 0 }}
            onPress={() => navigation.navigate('Paywall')}
          />
        )}
      </View>

      {/* 라벨 프린터 */}
      <SectionTitle icon="🖨️" label="라벨 프린터" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <TouchableOpacity
          style={styles.printerRow}
          onPress={() => Alert.alert('프린터 연결', 'Bluetooth 프린터를 검색합니다.')}
        >
          <Text style={{ fontSize: 28 }}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.printerLabel, { color: pal.tx }]}>프린터 검색</Text>
            <Text style={[styles.printerDesc, { color: pal.t3 }]}>Bluetooth 라벨 프린터 연결</Text>
          </View>
          <Text style={{ color: pal.t3, fontSize: fontSize.lg }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 앱 정보 */}
      <SectionTitle icon="ℹ️" label="앱 정보" pal={pal} />
      <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <InfoRow label="앱 이름" value="MeatBig (미트빅)" pal={pal} />
        <InfoRow label="버전" value="v1.0.0" last pal={pal} />
      </View>

      {/* PIN 변경 모달 */}
      <Modal visible={pinChangeModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>🔐 PIN 변경</Text>
            <TouchableOpacity onPress={() => setPinChangeModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg }}>
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>새 PIN (4자리 이상)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              placeholder="새 PIN 입력" placeholderTextColor={pal.t3}
              keyboardType="number-pad" secureTextEntry maxLength={6}
              value={newPin} onChangeText={setNewPin}
            />
            <Text style={[styles.fieldLabel, { color: pal.t2, marginTop: spacing.md }]}>PIN 확인</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              placeholder="PIN 재입력" placeholderTextColor={pal.t3}
              keyboardType="number-pad" secureTextEntry maxLength={6}
              value={newPinConfirm} onChangeText={setNewPinConfirm}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: spacing.lg }]}
              onPress={handlePinChange}>
              <Text style={styles.saveBtnText}>변경 완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 직원 추가 모달 */}
      <Modal visible={staffModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>👤 직원 추가</Text>
            <TouchableOpacity onPress={() => setStaffModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {/* 이름 */}
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>이름 *</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              placeholder="예: 홍길동"
              placeholderTextColor={pal.t3}
              value={newStaff.name}
              onChangeText={t => setNewStaff({ ...newStaff, name: t })}
            />
            {/* 역할 */}
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>역할</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {['직원', '사장', '파트타임'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, { borderColor: newStaff.role === r ? pal.ac : pal.bd, backgroundColor: newStaff.role === r ? pal.ac + '20' : pal.s1 }]}
                  onPress={() => setNewStaff({ ...newStaff, role: r })}
                >
                  <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: newStaff.role === r ? pal.ac : pal.t2 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* 아바타 색상 */}
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>아바타 색상</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
              {COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setSelectedColor(c)}
                  style={[styles.colorDot, { backgroundColor: c, borderColor: selectedColor === c ? pal.tx : 'transparent' }]} />
              ))}
            </View>
            {/* PIN */}
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>PIN (4자리)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              placeholder="예: 5678"
              placeholderTextColor={pal.t3}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={newStaff.pin}
              onChangeText={t => setNewStaff({ ...newStaff, pin: t })}
            />
            {/* 보건증 만료일 */}
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>보건증 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              placeholder="예: 2027.03.01"
              placeholderTextColor={pal.t3}
              value={newStaff.health}
              onChangeText={t => setNewStaff({ ...newStaff, health: t })}
            />
            {/* 위생교육 만료일 */}
            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>위생교육 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
              placeholder="예: 2027.06.01"
              placeholderTextColor={pal.t3}
              value={newStaff.edu}
              onChangeText={t => setNewStaff({ ...newStaff, edu: t })}
            />
            <PrimaryBtn label="✓ 직원 등록" onPress={handleAddStaff} style={{ marginTop: spacing.md }} />
            <OutlineBtn label="취소" onPress={() => setStaffModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>

      {/* 직원 수정 모달 */}
      <Modal visible={editModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg }}>
          <View style={[styles.card, { backgroundColor: pal.s1, borderColor: pal.bd, padding: spacing.lg }]}>
            <Text style={[styles.modalTitle, { color: pal.tx, marginBottom: spacing.md }]}>
              ✏️ {editTarget?.name} 정보 수정
            </Text>

            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>🏥 보건증 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.bg, borderColor: pal.bd, color: pal.tx }]}
              value={editForm.health}
              onChangeText={t => setEditForm({ ...editForm, health: t })}
              placeholder="예: 2027.06.01"
              placeholderTextColor={pal.t3}
            />

            <Text style={[styles.fieldLabel, { color: pal.t2 }]}>📚 위생교육 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: pal.bg, borderColor: pal.bd, color: pal.tx }]}
              value={editForm.edu}
              onChangeText={t => setEditForm({ ...editForm, edu: t })}
              placeholder="예: 2027.09.01"
              placeholderTextColor={pal.t3}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <OutlineBtn label="취소" onPress={() => setEditModal(false)} style={{ flex: 1 }} />
              <PrimaryBtn label="저장" onPress={handleEditStaff} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

const SectionTitle = ({ icon, label, pal }) => (
  <Text style={[styles.sectionTitle, { color: pal.t3 }]}>{icon} {label}</Text>
);

const InfoRow = ({ label, value, last, pal }) => (
  <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: pal.bd + '50' }]}>
    <Text style={[styles.infoLabel, { color: pal.t2 }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: pal.tx }]}>{value}</Text>
  </View>
);

const NotifRow = ({ label, value, onChange, last, pal }) => (
  <View style={[styles.notifRow, !last && { borderBottomWidth: 1, borderBottomColor: pal.bd + '50' }]}>
    <Text style={[styles.notifLabel, { color: pal.tx }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: pal.bd, true: pal.ac + '80' }}
      thumbColor={value ? pal.ac : pal.t3}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadow.sm,
    overflow: 'hidden',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  infoLabel: { fontSize: fontSize.sm, fontWeight: '600' },
  infoValue: { fontSize: fontSize.sm, fontWeight: '700', flex: 1, textAlign: 'right' },

  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.md, fontWeight: '900' },
  staffName: { fontSize: fontSize.sm, fontWeight: '700' },
  staffMeta: { fontSize: fontSize.xxs, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleBadgeText: { fontSize: fontSize.xxs, fontWeight: '800' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  addStaffRow: { paddingVertical: 16, alignItems: 'center' },
  addStaffText: { fontSize: fontSize.sm, fontWeight: '700' },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  notifLabel: { fontSize: fontSize.sm, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  notifSubLabel: { fontSize: fontSize.xxs, marginTop: 2 },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  planTitle: { fontSize: fontSize.md, fontWeight: '900', marginBottom: 4 },
  planDesc: { fontSize: fontSize.xs },
  planBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  planBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },
  adminBtn: { margin: spacing.md, marginTop: 4, paddingVertical: 10, borderTopWidth: 1, alignItems: 'center' },
  adminBtnText: { fontSize: fontSize.xs, fontWeight: '700' },

  printerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  printerLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 3 },
  printerDesc: { fontSize: fontSize.xs },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900' },
  closeBtn: { fontSize: 22, padding: 4 },

  saveBtn: { backgroundColor: colors.gn, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '800' },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 7, marginTop: 4 },
  fieldInput: {
    borderWidth: 1.5, borderRadius: radius.sm,
    padding: 13, fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  roleChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5,
  },
  colorDot: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 3,
  },
});
