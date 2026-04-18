import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, spacing, radius, shadow } from '../theme';
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
import { useAuth } from '../lib/AuthContext';
import { C, F, R, SH } from '../lib/v5';

const NOTIF_KEY = '@meatbig_notifications';

export default function SettingsScreen({ route, navigation }) {
  const { isDark, toggleTheme } = useTheme();
  const { role, staffName, switchToStaff, requestOwnerMode, changePin, ownerPin } = useRole();
  const { sub, plan: currentPlan, isPremium, isTrial, daysLeft, cancelSubscription } = useSubscription();
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      '로그아웃',
      '로그아웃하면 이 기기에서 데이터가 삭제됩니다.\n(클라우드에 저장된 데이터는 유지됩니다)',
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: async () => {
          await signOut();
        }},
      ]
    );
  };
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
    <View style={[styles.container, { backgroundColor: '#F2F4F8' }]}>
    {/* ── V5 헤더 ── */}
    <View style={[styles.v5Header, { borderBottomColor: '#E2E8F0' }]}>
      <View style={styles.v5HeaderAccent} />
      <View style={styles.v5HeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={{ width: 33, height: 33, borderRadius: 10, backgroundColor: '#B91C1C', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="settings" size={17} color="#fff" />
          </View>
          <Text style={styles.v5PageTitle}>설정</Text>
        </View>
      </View>
    </View>
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F2F4F8' }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
    >

      {/* ── 계정 프로필 카드 ── */}
      <View style={[styles.profileCard, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <View style={[styles.profileAvatar, { backgroundColor: '#B91C1C' }]}>
          <Text style={[styles.profileAvatarText, { color: '#FFFFFF' }]}>
            {(biz.bizName || 'M').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.profileName, { color: '#0F172A' }]}>{biz.bizName || 'MeatBig 매장'}</Text>
          <Text style={[styles.profileEmail, { color: '#64748B' }]}>{user?.email || '이메일 없음'}</Text>
        </View>
        <View style={[styles.profileBadge, {
          backgroundColor: isPremium ? '#16A34A' + '20' : '#B91C1C' + '20',
        }]}>
          <Text style={[styles.profileBadgeText, { color: isPremium ? '#16A34A' : '#B91C1C' }]}>
            {isTrial ? '체험 중' : isPremium ? (currentPlan.emoji + ' ' + currentPlan.name) : '무료 플랜'}
          </Text>
        </View>
      </View>

      {/* 권한 관리 */}
      <SectionTitle icon="🔐" label="권한 관리" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: role === 'owner' ? '#B91C1C' + '40' : '#DC2626' + '60' }]}>
        {/* 현재 모드 배너 */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: spacing.md, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
          backgroundColor: role === 'owner' ? '#B91C1C' + '10' : '#DC2626' + '12',
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: role === 'owner' ? '#B91C1C' + '25' : '#DC2626' + '25',
          }}>
            <Text style={{ fontSize: 22 }}>{role === 'owner' ? '👑' : '👤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '900', color: role === 'owner' ? '#B91C1C' : '#DC2626' }}>
              {role === 'owner' ? '사장 모드' : `직원 모드${staffName ? ` — ${staffName}` : ''}`}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: '#64748B', marginTop: 2 }}>
              {role === 'owner' ? '모든 기능에 접근 가능합니다' : '위생·온도·이력 조회만 허용됩니다'}
            </Text>
          </View>
        </View>
        {/* 직원 모드 전환 (사장 모드에서) */}
        {role === 'owner' && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}
            onPress={switchToStaff}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: '#0F172A' }}>직원 모드로 전환</Text>
              <Text style={{ fontSize: fontSize.xs, color: '#64748B', marginTop: 2 }}>직원 선택 → PIN 입력 → 제한 모드 진입</Text>
            </View>
            <Text style={{ color: '#DC2626', fontSize: fontSize.md }}>›</Text>
          </TouchableOpacity>
        )}
        {/* 사장 모드 복귀 (직원 모드에서) */}
        {role === 'staff' && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}
            onPress={requestOwnerMode}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>🔐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: '#B91C1C' }}>사장 모드로 복귀</Text>
              <Text style={{ fontSize: fontSize.xs, color: '#64748B', marginTop: 2 }}>사장 PIN 입력 필요</Text>
            </View>
            <Text style={{ color: '#B91C1C', fontSize: fontSize.md }}>›</Text>
          </TouchableOpacity>
        )}
        {/* PIN 변경 (사장 모드에서만) */}
        {role === 'owner' && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 15 }}
            onPress={() => { setNewPin(''); setNewPinConfirm(''); setPinChangeModal(true); }}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>🔑</Text>
            <Text style={{ flex: 1, fontSize: fontSize.sm, color: '#0F172A' }}>사장 PIN 변경</Text>
            <Text style={{ color: '#64748B', fontSize: fontSize.xs }}>{ownerPin.replace(/./g, '●')}&nbsp;&nbsp;›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 사업장 정보 */}
      <SectionTitle icon="🏪" label="사업장 정보" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <InfoRow label="상호명" value={biz.bizName} />
        <InfoRow label="대표자" value={biz.owner} />
        <InfoRow label="사업자번호" value={biz.bizNo} />
        <InfoRow label="취급 축종" value={(biz.species || []).join(', ')} last />
      </View>

      {/* 화면 설정 */}
      <SectionTitle icon="🎨" label="화면 설정" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <View style={[styles.notifRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.notifLabel, { color: '#0F172A' }]}>
              {isDark ? '🌙 다크 모드' : '☀️ 라이트 모드'}
            </Text>
            <Text style={[styles.notifSubLabel, { color: '#64748B' }]}>
              {isDark ? '어두운 배경 사용 중' : '밝은 배경 사용 중'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#E2E8F0', true: '#B91C1C' + '99' }}
            thumbColor={isDark ? '#B91C1C' : '#64748B'}
          />
        </View>
      </View>

      {/* 직원 관리 */}
      <SectionTitle icon="👥" label="직원 관리" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        {staff.map((s, idx) => (
          <TouchableOpacity
            key={s.id}
            activeOpacity={0.7}
            onPress={() => openEditStaff(s)}
            style={[
              styles.staffRow,
              { borderBottomColor: '#E2E8F0' + '50' },
              idx === staff.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: s.color + '30' }]}>
              <Text style={[styles.avatarText, { color: s.color }]}>{s.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.staffName, { color: '#0F172A' }]}>{s.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: s.role === '사장' ? '#B91C1C' + '25' : '#DC2626' + '20' }]}>
                  <Text style={[styles.roleBadgeText, { color: s.role === '사장' ? '#B91C1C' : '#DC2626' }]}>{s.role}</Text>
                </View>
              </View>
              <Text style={[styles.staffMeta, { color: '#64748B' }]}>보건증: {s.health}  ·  위생교육: {s.edu}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.statusDot, { backgroundColor: s.status === 'ok' ? '#16A34A' : '#B91C1C' }]} />
              <Text style={{ fontSize: fontSize.xxs, color: '#64748B', marginTop: 4 }}>수정 ›</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addStaffRow} onPress={() => setStaffModal(true)}>
          <Text style={[styles.addStaffText, { color: '#DC2626' }]}>+ 직원 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 알림 설정 */}
      <SectionTitle icon="🔔" label="알림 설정" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <NotifRow label="위생점검 매일 09시 알림" value={notifications.hygiene} onChange={() => toggleNotif('hygiene')} last={false} />
        <NotifRow label="소비기한 임박 알림 (D-2)" value={notifications.expiry} onChange={() => toggleNotif('expiry')} last={false} />
        <NotifRow label="온도 이상 알림" value={notifications.temp} onChange={() => toggleNotif('temp')} last />
      </View>

      {/* 구독 관리 */}
      <SectionTitle icon="💎" label="구독 관리" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: isPremium ? '#16A34A' + '60' : '#E2E8F0', overflow: 'hidden' }]}>
        <View style={styles.planRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.planTitle, { color: '#0F172A' }]}>
              {currentPlan.emoji} {currentPlan.name}
            </Text>
            <Text style={[styles.planDesc, { color: '#64748B' }]}>
              {isTrial && daysLeft !== null
                ? `무료 체험 중 — ${daysLeft}일 남음`
                : isPremium
                  ? `${sub.billingCycle === 'annual' ? '연간' : '월간'} 구독 · ${sub.periodEndsAt ? new Date(sub.periodEndsAt).toLocaleDateString('ko-KR') + ' 만료' : ''}`
                  : '기본 위생 점검, 이력 50건 저장'}
            </Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: isPremium ? '#16A34A' + '20' : '#64748B' + '20' }]}>
            <Text style={[styles.planBadgeText, { color: isPremium ? '#16A34A' : '#64748B' }]}>
              {isTrial ? '체험 중' : isPremium ? '구독 중' : '무료'}
            </Text>
          </View>
        </View>
        {isPremium && (
          <TouchableOpacity
            style={{ paddingHorizontal: spacing.md, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' + '50' }}
            onPress={() => navigation.navigate('Paywall')}
          >
            <Text style={{ fontSize: fontSize.sm, color: '#DC2626', fontWeight: '700' }}>구독 관리 · 요금제 변경 →</Text>
          </TouchableOpacity>
        )}
        {!isPremium && (
          <PrimaryBtn
            label="14일 무료 체험 시작 →"
            color={'#B91C1C'}
            style={{ margin: spacing.md, marginTop: 0 }}
            onPress={() => navigation.navigate('Paywall')}
          />
        )}
      </View>

      {/* 라벨 프린터 */}
      <SectionTitle icon="🖨️" label="라벨 프린터" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <TouchableOpacity
          style={styles.printerRow}
          onPress={() => Alert.alert('프린터 연결', 'Bluetooth 프린터를 검색합니다.')}
        >
          <Text style={{ fontSize: 28 }}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.printerLabel, { color: '#0F172A' }]}>프린터 검색</Text>
            <Text style={[styles.printerDesc, { color: '#64748B' }]}>Bluetooth 라벨 프린터 연결</Text>
          </View>
          <Text style={{ color: '#64748B', fontSize: fontSize.lg }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 앱 정보 */}
      <SectionTitle icon="ℹ️" label="앱 정보" />
      <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <InfoRow label="앱 이름" value="MeatBig (미트빅)" />
        <InfoRow label="버전" value="v1.0.0" />
        <InfoRow label="계정" value={user?.email || '—'} last />
      </View>

      {/* 로그아웃 */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: '#B91C1C' }]}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={[styles.logoutText, { color: '#B91C1C' }]}>🚪 로그아웃</Text>
      </TouchableOpacity>

      {/* PIN 변경 모달 */}
      <Modal visible={pinChangeModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#F2F4F8' }}>
          <View style={[styles.modalHeader, { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
            <Text style={[styles.modalTitle, { color: '#0F172A' }]}>🔐 PIN 변경</Text>
            <TouchableOpacity onPress={() => setPinChangeModal(false)}>
              <Text style={[styles.closeBtn, { color: '#334155' }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg }}>
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>새 PIN (4자리 이상)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }]}
              placeholder="새 PIN 입력" placeholderTextColor={'#64748B'}
              keyboardType="number-pad" secureTextEntry maxLength={6}
              value={newPin} onChangeText={setNewPin}
            />
            <Text style={[styles.fieldLabel, { color: '#334155', marginTop: spacing.md }]}>PIN 확인</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }]}
              placeholder="PIN 재입력" placeholderTextColor={'#64748B'}
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
        <View style={{ flex: 1, backgroundColor: '#F2F4F8' }}>
          <View style={[styles.modalHeader, { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
            <Text style={[styles.modalTitle, { color: '#0F172A' }]}>👤 직원 추가</Text>
            <TouchableOpacity onPress={() => setStaffModal(false)}>
              <Text style={[styles.closeBtn, { color: '#334155' }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {/* 이름 */}
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>이름 *</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }]}
              placeholder="예: 홍길동"
              placeholderTextColor={'#64748B'}
              value={newStaff.name}
              onChangeText={t => setNewStaff({ ...newStaff, name: t })}
            />
            {/* 역할 */}
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>역할</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {['직원', '사장', '파트타임'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, { borderColor: newStaff.role === r ? '#B91C1C' : '#E2E8F0', backgroundColor: newStaff.role === r ? '#B91C1C' + '20' : '#FFFFFF' }]}
                  onPress={() => setNewStaff({ ...newStaff, role: r })}
                >
                  <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: newStaff.role === r ? '#B91C1C' : '#334155' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* 아바타 색상 */}
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>아바타 색상</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
              {COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setSelectedColor(c)}
                  style={[styles.colorDot, { backgroundColor: c, borderColor: selectedColor === c ? '#0F172A' : 'transparent' }]} />
              ))}
            </View>
            {/* PIN */}
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>PIN (4자리)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }]}
              placeholder="예: 5678"
              placeholderTextColor={'#64748B'}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={newStaff.pin}
              onChangeText={t => setNewStaff({ ...newStaff, pin: t })}
            />
            {/* 보건증 만료일 */}
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>보건증 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }]}
              placeholder="예: 2027.03.01"
              placeholderTextColor={'#64748B'}
              value={newStaff.health}
              onChangeText={t => setNewStaff({ ...newStaff, health: t })}
            />
            {/* 위생교육 만료일 */}
            <Text style={[styles.fieldLabel, { color: '#334155' }]}>위생교육 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }]}
              placeholder="예: 2027.06.01"
              placeholderTextColor={'#64748B'}
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
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', padding: spacing.lg }]}>
            <Text style={[styles.modalTitle, { color: '#0F172A', marginBottom: spacing.md }]}>
              ✏️ {editTarget?.name} 정보 수정
            </Text>

            <Text style={[styles.fieldLabel, { color: '#334155' }]}>🏥 보건증 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#F2F4F8', borderColor: '#E2E8F0', color: '#0F172A' }]}
              value={editForm.health}
              onChangeText={t => setEditForm({ ...editForm, health: t })}
              placeholder="예: 2027.06.01"
              placeholderTextColor={'#64748B'}
            />

            <Text style={[styles.fieldLabel, { color: '#334155' }]}>📚 위생교육 만료일</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: '#F2F4F8', borderColor: '#E2E8F0', color: '#0F172A' }]}
              value={editForm.edu}
              onChangeText={t => setEditForm({ ...editForm, edu: t })}
              placeholder="예: 2027.09.01"
              placeholderTextColor={'#64748B'}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <OutlineBtn label="취소" onPress={() => setEditModal(false)} style={{ flex: 1 }} />
              <PrimaryBtn label="저장" onPress={handleEditStaff} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

const SectionTitle = ({ icon, label }) => (
  <Text style={[styles.sectionTitle, { color: '#64748B' }]}>{icon} {label}</Text>
);

const InfoRow = ({ label, value, last }) => (
  <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' + '50' }]}>
    <Text style={[styles.infoLabel, { color: '#334155' }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: '#0F172A' }]}>{value}</Text>
  </View>
);

const NotifRow = ({ label, value, onChange, last }) => (
  <View style={[styles.notifRow, !last && { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' + '50' }]}>
    <Text style={[styles.notifLabel, { color: '#0F172A' }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#E2E8F0', true: '#B91C1C' + '80' }}
      thumbColor={value ? '#B91C1C' : '#64748B'}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },

  // V5 헤더
  v5Header:       { backgroundColor:'#FFFFFF', borderBottomWidth:1, borderBottomColor:'#E2E8F0', overflow:'hidden' },
  v5HeaderAccent: { height:3, backgroundColor:'#B91C1C', position:'absolute', top:0, left:0, right:0 },
  v5HeaderRow:    { paddingHorizontal:20, paddingTop:16, paddingBottom:13, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  v5PageTitle:    { fontSize:22, fontWeight:'900', color:'#0F172A', letterSpacing:-0.6 },

  // 계정 프로필 카드
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.sm,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 24, fontWeight: '900' },
  profileName:  { fontSize: 18, fontWeight: '900', marginBottom: 3 },
  profileEmail: { fontSize: 14 },
  profileBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  profileBadgeText: { fontSize: fontSize.xxs, fontWeight: '800' },

  sectionTitle: {
    fontSize: 15,
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
  logoutBtn: {
    borderWidth: 1.5, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
    marginTop: spacing.sm, marginBottom: spacing.xl,
  },
  logoutText: { fontSize: fontSize.sm, fontWeight: '800' },

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
  staffName: { fontSize: 16, fontWeight: '700' },
  staffMeta: { fontSize: 14, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
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
  notifLabel: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  notifSubLabel: { fontSize: 14, marginTop: 2 },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  planTitle: { fontSize: fontSize.md, fontWeight: '900', marginBottom: 4 },
  planDesc: { fontSize: fontSize.xs },
  planBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
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

  saveBtn: { backgroundColor: '#16A34A', paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
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
