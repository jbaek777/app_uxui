/**
 * RoleContext.js — 사장/직원 모드 전역 관리 (강화)
 *
 * role: 'owner' | 'staff'
 * - owner: 모든 탭 + 모든 기능
 * - staff: 홈·스캔·서류 탭만 / 위생·온도 입력만 허용
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
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY      = '@meatbig_owner_pin';
const STAFF_KEY    = '@meatbig_staff';
const DEFAULT_PIN  = '0000';

// 직원 모드 허용 탭
export const STAFF_ALLOWED_TABS = ['HomeTab', 'TraceTab', 'DocsTab'];
// 직원 모드 허용 서류 화면
export const STAFF_ALLOWED_DOCS = ['Hygiene', 'Temp', 'Staff'];
// 사장 전용 기능 키
export const OWNER_ONLY = ['Closing', 'TaxReport', 'Upload', 'Aging', 'Education', 'inventory_edit', 'closing', 'ocr'];

const RoleContext = createContext({
  role: 'owner',
  staffName: null,
  staffId: null,
  switchToStaff: () => {},
  requestOwnerMode: () => {},
  changePin: async () => {},
  ownerPin: DEFAULT_PIN,
  canAccess: () => true,
});

export function RoleProvider({ children }) {
  const [role, setRole]         = useState('owner');
  const [ownerPin, setOwnerPin] = useState(DEFAULT_PIN);
  const [staffName, setStaffName] = useState(null);
  const [staffId, setStaffId]   = useState(null);

  // 모달 상태
  const [ownerPinModal, setOwnerPinModal] = useState(false);  // 사장 복귀 PIN
  const [staffPickModal, setStaffPickModal] = useState(false); // 직원 선택
  const [staffPinModal, setStaffPinModal] = useState(false);  // 직원 PIN

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(PIN_KEY).then(p => { if (p) setOwnerPin(p); }).catch(() => {});
  }, []);

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
            onPress: () => {
              setRole('staff');
              setStaffName('직원');
              setStaffId(null);
            },
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
      setRole('staff');
      setStaffName(staff.name);
      setStaffId(staff.id);
      return;
    }
    setPinInput('');
    setPinError('');
    setStaffPinModal(true);
  };

  // 직원 PIN 확인
  const confirmStaffPin = () => {
    if (!selectedStaff) return;
    if (pinInput === selectedStaff.pin) {
      setRole('staff');
      setStaffName(selectedStaff.name);
      setStaffId(selectedStaff.id);
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
    if (pinInput === ownerPin) {
      setRole('owner');
      setStaffName(null);
      setStaffId(null);
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
    return !OWNER_ONLY.includes(key);
  }, [role]);

  return (
    <RoleContext.Provider value={{
      role, staffName, staffId, ownerPin,
      switchToStaff, requestOwnerMode, changePin, canAccess,
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
