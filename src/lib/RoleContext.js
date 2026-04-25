/**
 * RoleContext.js — 사장/직원/구직자/관리자 모드 전역 관리 (강화)
 *
 * role: 'owner' | 'staff' | 'jobseeker' | 'admin'
 * - owner:     모든 탭 + 모든 기능
 * - staff:     홈·서류·채용 탭 / 위생·온도 입력만 허용
 * - jobseeker: 채용·설정 탭만 (사업장 없음, 헤드헌팅 받기 + 프로필 편집)
 * - admin:     관리자 대시보드·설정 탭만 (사업장 없음, user_profiles.role='admin')
 *
 * 직원 전환 플로우:
 *   1. "직원 모드로 전환" 탭
 *   2. 직원 목록에서 선택 (이름 + 역할)
 *   3. 직원 PIN 입력 (staffData에 등록된 PIN)
 *   4. staff 모드로 진입, staffName 표시
 *
 * 사장 복귀 플로우:
 *   1. 탭바 잠금 아이콘 또는 설정 탭
 *   2. 사장 PIN 입력
 *   3. owner 모드 복귀
 *
 * 구직자 플로우:
 *   · 온보딩에서 '구직자로 가입' 선택 → initRole('jobseeker', name)
 *   · 모드 전환 불가 (사업장이 없음). 로그아웃 후 재가입 시에만 owner/staff 선택 가능.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY       = '@meatbig_owner_pin';
const STAFF_KEY     = '@meatbig_staff';
const ROLE_KEY      = '@meatbig_role';          // 앱 재기동 시 role 복원
const CUR_STAFF_KEY = '@meatbig_current_staff'; // 앱 재기동 시 직원명/ID 복원
const DEFAULT_PIN   = '0000';

// ── timing-safe 문자열 비교 ─────────────────────────────────
// PIN 비교 시 `===` 사용 시 짧은 길이/조기 mismatch 로 인해 비교 시간이
// 달라지면, 이론상 timing 측정으로 PIN 의 자릿수가 유출될 수 있음.
// 길이 무관 항상 동일한 횟수만큼 XOR 누적해 mismatch 비트를 모은 뒤 1회 비교.
function safeEqual(a, b) {
  const sa = String(a == null ? '' : a);
  const sb = String(b == null ? '' : b);
  const len = Math.max(sa.length, sb.length);
  let diff = sa.length ^ sb.length;
  for (let i = 0; i < len; i++) {
    diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// 직원 모드 허용 탭 (Option D: 조회 탭 제거, 채용 탭 추가)
export const STAFF_ALLOWED_TABS = ['HomeTab', 'DocsTab', 'JobTab'];
// 구직자(무소속) 허용 탭 — 채용 + 설정만
export const JOBSEEKER_ALLOWED_TABS = ['JobTab', 'SettingsTab'];
// 직원 모드 허용 서류 화면
export const STAFF_ALLOWED_DOCS = ['Hygiene', 'Temp', 'Staff'];
// 사장 전용 기능 키
export const OWNER_ONLY = ['Closing', 'TaxReport', 'Upload', 'Aging', 'Education', 'inventory_edit', 'closing', 'ocr'];

const RoleContext = createContext({
  role: 'owner',
  staffName: null,
  staffId: null,
  roleReady: false,
  switchToStaff: () => {},
  requestOwnerMode: () => {},
  initRole: async () => {},
  changePin: async () => {},
  ownerPin: DEFAULT_PIN,
  canAccess: () => true,
});

export function RoleProvider({ children }) {
  const [role, setRole]           = useState('owner');
  const [ownerPin, setOwnerPin]   = useState(DEFAULT_PIN);
  const [staffName, setStaffName] = useState(null);
  const [staffId, setStaffId]     = useState(null);
  const [roleReady, setRoleReady] = useState(false); // AsyncStorage 복원 완료 여부

  // 모달 상태
  const [ownerPinModal, setOwnerPinModal]   = useState(false);
  const [staffPickModal, setStaffPickModal] = useState(false);
  const [staffPinModal, setStaffPinModal]   = useState(false);

  const [pinInput, setPinInput]       = useState('');
  const [pinError, setPinError]       = useState('');
  const [staffList, setStaffList]     = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // ── 앱 시작 시 저장된 role 복원 ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [savedPin, savedRole, savedStaff] = await Promise.all([
          AsyncStorage.getItem(PIN_KEY),
          AsyncStorage.getItem(ROLE_KEY),
          AsyncStorage.getItem(CUR_STAFF_KEY),
        ]);
        if (savedPin) setOwnerPin(savedPin);
        if (savedRole === 'staff') {
          setRole('staff');
          if (savedStaff) {
            const { name, id } = JSON.parse(savedStaff);
            setStaffName(name || '직원');
            setStaffId(id || null);
          }
        } else if (savedRole === 'jobseeker') {
          setRole('jobseeker');
          // 구직자는 본인 이름만 표시용으로 유지 (staffName 재활용)
          try {
            const jsName = await AsyncStorage.getItem('@meatbig_jobseeker_name');
            if (jsName) setStaffName(jsName);
          } catch {}
        } else if (savedRole === 'admin') {
          setRole('admin');
          // 관리자는 display_name 을 staffName 에 임시 저장 (UI 표시용)
          try {
            const adminName = await AsyncStorage.getItem('@meatbig_admin_name');
            if (adminName) setStaffName(adminName);
          } catch {}
        }
      } catch {}
      setRoleReady(true);
    })();
  }, []);

  // ── role 변경 시 AsyncStorage 저장 ─────────────────────
  const applyRole = useCallback(async (newRole, name = null, id = null) => {
    setRole(newRole);
    setStaffName(name);
    setStaffId(id);
    await AsyncStorage.setItem(ROLE_KEY, newRole).catch(() => {});
    if (newRole === 'staff' && name) {
      await AsyncStorage.setItem(CUR_STAFF_KEY, JSON.stringify({ name, id })).catch(() => {});
    } else {
      await AsyncStorage.removeItem(CUR_STAFF_KEY).catch(() => {});
    }
    // 관리자 표시명 저장 (앱 재기동 시 복원용)
    if (newRole === 'admin' && name) {
      await AsyncStorage.setItem('@meatbig_admin_name', name).catch(() => {});
    } else {
      await AsyncStorage.removeItem('@meatbig_admin_name').catch(() => {});
    }
  }, []);

  // ── 외부에서 role 초기화 (온보딩 완료 시 호출) ─────────
  const initRole = useCallback(async (newRole, name = null, id = null) => {
    await applyRole(newRole, name, id);
  }, [applyRole]);

  // 직원 목록 최신 로드
  const loadStaffList = async () => {
    try {
      const raw = await AsyncStorage.getItem(STAFF_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        setStaffList(list);
        return list;
      }
    } catch {}
    return [];
  };

  // ── 직원 모드 전환 ─────────────────────────────────────
  const switchToStaff = useCallback(async () => {
    const list = await loadStaffList();
    if (list.length === 0) {
      // 직원 없으면 PIN 없이 직원 모드 (익명)
      Alert.alert(
        '직원 없음',
        '등록된 직원이 없습니다. 직원을 먼저 등록하거나, 익명 직원 모드로 전환하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '익명으로 전환',
            onPress: () => applyRole('staff', '직원', null),
          },
        ]
      );
      return;
    }
    setPinInput('');
    setPinError('');
    setSelectedStaff(null);
    setStaffPickModal(true);
  }, []);

  // 직원 선택 후 PIN 입력으로 이동
  const onSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setStaffPickModal(false);
    // PIN이 없거나 '0000'인 경우 바로 진입
    if (!staff.pin || staff.pin === '0000') {
      applyRole('staff', staff.name, staff.id);
      return;
    }
    setPinInput('');
    setPinError('');
    setStaffPinModal(true);
  };

  // 직원 PIN 확인 (timing-safe 비교)
  const confirmStaffPin = () => {
    if (!selectedStaff) return;
    if (safeEqual(pinInput, selectedStaff.pin)) {
      applyRole('staff', selectedStaff.name, selectedStaff.id);
      setStaffPinModal(false);
      setPinError('');
    } else {
      setPinError('PIN이 틀렸습니다.');
      setPinInput('');
    }
  };

  // ── 사장 모드 복귀 ─────────────────────────────────────
  const requestOwnerMode = useCallback(() => {
    setPinInput('');
    setPinError('');
    setOwnerPinModal(true);
  }, []);

  const confirmOwnerPin = () => {
    if (safeEqual(pinInput, ownerPin)) {
      applyRole('owner', null, null);
      setOwnerPinModal(false);
      setPinError('');
    } else {
      setPinError('PIN이 틀렸습니다. 다시 시도해주세요.');
      setPinInput('');
    }
  };

  // ── PIN 변경 ───────────────────────────────────────────
  const changePin = async (newPin) => {
    setOwnerPin(newPin);
    await AsyncStorage.setItem(PIN_KEY, newPin).catch(() => {});
  };

  // ── 기능 접근 권한 체크 ────────────────────────────────
  const canAccess = useCallback((key) => {
    if (role === 'owner') return true;
    // 관리자는 AdminScreen 에서만 데이터 조회 — 일반 기능은 모두 차단
    if (role === 'admin') return false;
    // 구직자는 사장 전용 기능뿐 아니라 재고·위생·서류 작성도 접근 불가
    if (role === 'jobseeker') return false;
    return !OWNER_ONLY.includes(key);
  }, [role]);

  return (
    <RoleContext.Provider value={{
      role, staffName, staffId, ownerPin, roleReady,
      switchToStaff, requestOwnerMode, initRole, changePin, canAccess,
    }}>
      {children}

      {/* ── 직원 선택 모달 ── */}
      <Modal visible={staffPickModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStaffPickModal(false)}>
        <View style={m.sheet}>
          <View style={m.sheetHeader}>
            <Text style={m.sheetTitle}>👤 직원 선택</Text>
            <TouchableOpacity onPress={() => setStaffPickModal(false)}>
              <Text style={m.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={m.sheetSub}>본인을 선택하세요</Text>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {staffList.map(staff => (
              <TouchableOpacity
                key={staff.id}
                style={m.staffRow}
                onPress={() => onSelectStaff(staff)}
                activeOpacity={0.75}
              >
                <View style={[m.avatar, { backgroundColor: (staff.color || '#3d7ef5') + '30' }]}>
                  <Text style={[m.avatarText, { color: staff.color || '#3d7ef5' }]}>
                    {(staff.name || '?')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.staffName}>{staff.name}</Text>
                  <Text style={m.staffRole}>{staff.role || '직원'}</Text>
                </View>
                <Text style={m.staffArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── 직원 PIN 모달 ── */}
      <Modal visible={staffPinModal} transparent animationType="fade" onRequestClose={() => setStaffPinModal(false)}>
        <View style={m.overlay}>
          <View style={m.pinBox}>
            {selectedStaff && (
              <View style={[m.pinAvatar, { backgroundColor: (selectedStaff.color || '#3d7ef5') + '30' }]}>
                <Text style={[m.pinAvatarText, { color: selectedStaff.color || '#3d7ef5' }]}>
                  {(selectedStaff.name || '?')[0]}
                </Text>
              </View>
            )}
            <Text style={m.pinTitle}>{selectedStaff?.name || ''}</Text>
            <Text style={m.pinSub}>직원 PIN을 입력하세요</Text>
            <TextInput
              style={[m.pinInput, pinError ? m.pinInputError : null]}
              placeholder="PIN"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pinInput}
              onChangeText={v => { setPinInput(v); setPinError(''); }}
              autoFocus
            />
            {!!pinError && <Text style={m.errorText}>{pinError}</Text>}
            <TouchableOpacity style={[m.confirmBtn, { backgroundColor: selectedStaff?.color || '#3d7ef5' }]} onPress={confirmStaffPin}>
              <Text style={m.confirmBtnText}>확인</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => { setStaffPinModal(false); setStaffPickModal(true); }}>
              <Text style={m.cancelBtnText}>← 직원 선택으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 사장 PIN 복귀 모달 ── */}
      <Modal visible={ownerPinModal} transparent animationType="fade" onRequestClose={() => setOwnerPinModal(false)}>
        <View style={m.overlay}>
          <View style={m.pinBox}>
            <Text style={m.pinTitle}>🔐 사장 모드</Text>
            <Text style={m.pinSub}>사장 PIN을 입력하세요</Text>
            <TextInput
              style={[m.pinInput, pinError ? m.pinInputError : null]}
              placeholder="PIN"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pinInput}
              onChangeText={v => { setPinInput(v); setPinError(''); }}
              autoFocus
            />
            {!!pinError && <Text style={m.errorText}>{pinError}</Text>}
            <TouchableOpacity style={m.confirmBtn} onPress={confirmOwnerPin}>
              <Text style={m.confirmBtnText}>확인</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => setOwnerPinModal(false)}>
              <Text style={m.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

// ── 스타일 ──────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  pinBox: {
    backgroundColor: '#1e293b', borderRadius: 20,
    padding: 28, width: '100%', maxWidth: 320, alignItems: 'center',
  },
  pinAvatar: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  pinAvatarText: { fontSize: 28, fontWeight: '900' },
  pinTitle: { fontSize: 20, fontWeight: '900', color: '#f8fafc', marginBottom: 4 },
  pinSub:   { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
  pinInput: {
    width: '100%', backgroundColor: '#0f172a',
    borderWidth: 1.5, borderColor: '#334155',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 22, color: '#f8fafc', textAlign: 'center',
    letterSpacing: 10, marginBottom: 8,
  },
  pinInputError: { borderColor: '#ef4444' },
  errorText: { fontSize: 12, color: '#ef4444', marginBottom: 12, textAlign: 'center' },
  confirmBtn: {
    width: '100%', backgroundColor: '#C0392B',
    paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 8,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  cancelBtn: { marginTop: 14, paddingVertical: 8 },
  cancelBtnText: { color: '#64748b', fontSize: 14 },

  // 직원 선택 sheet
  sheet: { flex: 1, backgroundColor: '#1e293b' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc' },
  closeBtn: { fontSize: 18, color: '#94a3b8', padding: 4 },
  sheetSub: { fontSize: 13, color: '#64748b', paddingHorizontal: 20, paddingTop: 12 },

  staffRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5f30',
  },
  avatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '900' },
  staffName: { fontSize: 15, fontWeight: '800', color: '#f8fafc', marginBottom: 2 },
  staffRole: { fontSize: 12, color: '#64748b' },
  staffArrow: { fontSize: 20, color: '#475569' },
});
