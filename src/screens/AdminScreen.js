/**
 * AdminScreen — 관리자 기능 잠금/해제 대시보드
 *
 * 구조:
 *   · 클라이언트는 supabase.functions.invoke('admin-toggle-feature') 만 호출
 *   · service_role 키는 Edge Function 에만 존재 (번들 노출 금지)
 *   · 관리자 PIN 은 서버 Secret (ADMIN_MASTER_PIN) 과 비교
 *
 * 진입:
 *   · 기본 PIN '777777' — Supabase Secrets 에서 ADMIN_MASTER_PIN 으로 변경 가능
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { useFeatureFlags } from '../lib/FeatureFlagsContext';
import { useAuth } from '../lib/AuthContext';

// PIN 은 더 이상 클라이언트에 저장하지 않음 — 서버 Secret(ADMIN_MASTER_PIN) 과 비교
// Secret 미설정 시 서버가 '777777' 을 폴백 기본값으로 사용 (backward compat)

const FEATURE_LIST = [
  { key: 'inventory', label: '재고 관리',     icon: '📦', desc: '재고 현황, 판매내역, 수율 계산' },
  { key: 'hygiene',   label: '위생 점검',     icon: '🧼', desc: '자체위생관리점검표' },
  { key: 'aging',     label: '숙성 관리',     icon: '🥩', desc: '드라이에이징 이력' },
  { key: 'ocr',       label: 'AI 서류 스캔', icon: '📷', desc: 'OCR 자동 인식 및 재고 등록' },
  { key: 'closing',   label: '마감 정산',     icon: '💰', desc: '일일 매출/폐기 정산' },
  { key: 'education', label: '교육일지',      icon: '📚', desc: '영업자 자체위생교육 실시' },
  { key: 'margin',    label: '마진 대시보드', icon: '📊', desc: 'TOP 마진 분석, 수익 요약' },
  { key: 'supplier',  label: '거래처 관리',  icon: '🏢', desc: '업체 연락처 및 매입 현황' },
  { key: 'temp',      label: '온도 기록',    icon: '🌡️', desc: '냉장·숙성실 온도·습도 기록' },
];

export default function AdminScreen({ navigation }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { flags, reload } = useFeatureFlags();
  const { user } = useAuth();

  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [verifiedPin, setVerifiedPin] = useState(''); // 서버 요청에 실어보낼 PIN
  const [saving, setSaving] = useState(null);         // 저장 중인 feature_key
  const [checkingRole, setCheckingRole] = useState(true);
  const [adminProfile, setAdminProfile] = useState(null); // { role, display_name } — 관리자 계정인 경우

  // 로그인된 계정의 role 확인 — admin 이면 PIN 스킵, 일반 계정이면 PIN 방식 유지
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) setCheckingRole(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('role, display_name')
          .eq('auth_uid', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.role === 'admin') {
          setAdminProfile(data);
          setAuthed(true); // 관리자 자동 통과
        }
      } catch (e) {
        // user_profiles 테이블 미배포 상태에서도 PIN 방식으로 동작하도록 무시
        console.log('user_profiles 조회 실패(무시):', e?.message);
      } finally {
        if (!cancelled) setCheckingRole(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // PIN 검증 — 더미 toggle 요청으로 서버와 대조 (잘못된 PIN 이면 403)
  const handlePinSubmit = async () => {
    if (!pin) {
      Alert.alert('오류', 'PIN 을 입력해주세요.');
      return;
    }
    setSaving('pin');
    try {
      // 현재 첫 기능의 상태를 그대로 유지하는 요청(멱등) → PIN 검증용
      const firstKey = FEATURE_LIST[0].key;
      const currentVal = flags[firstKey] !== false;
      const { data, error } = await supabase.functions.invoke('admin-toggle-feature', {
        body: {
          action: 'toggle',
          feature_key: firstKey,
          is_free: currentVal,     // 그대로 유지 → 실제 변화 없음
          master_pin: pin,
        },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || '';
        if (msg.includes('Invalid master PIN') || error?.context?.status === 403) {
          Alert.alert('오류', '관리자 PIN 이 올바르지 않습니다.');
        } else if (error?.context?.status === 404) {
          Alert.alert('오류', 'admin-toggle-feature 함수가 아직 배포되지 않았습니다.');
        } else {
          Alert.alert('오류', `PIN 검증 실패: ${msg || '네트워크 오류'}`);
        }
        setPin('');
        return;
      }
      setVerifiedPin(pin);
      setAuthed(true);
      setPin('');
    } catch (e) {
      Alert.alert('오류', e.message || 'PIN 검증 중 오류 발생');
    } finally {
      setSaving(null);
    }
  };

  const toggleFeature = async (key, currentValue) => {
    setSaving(key);
    try {
      const { data, error } = await supabase.functions.invoke('admin-toggle-feature', {
        body: {
          action: 'toggle',
          feature_key: key,
          is_free: !currentValue,
          master_pin: verifiedPin,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await reload();
    } catch (e) {
      Alert.alert('오류', `변경 실패: ${e.message}`);
    }
    setSaving(null);
  };

  const setAllFree = async (isFree) => {
    setSaving('all');
    try {
      const { data, error } = await supabase.functions.invoke('admin-toggle-feature', {
        body: {
          action: 'bulk',
          flags: FEATURE_LIST.map(f => ({ feature_key: f.key, is_free: isFree })),
          master_pin: verifiedPin,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await reload();
    } catch (e) {
      Alert.alert('오류', e.message);
    }
    setSaving(null);
  };

  // role 조회 중 로딩 화면
  if (checkingRole) {
    return (
      <View style={[styles.pinWrap, { backgroundColor: pal.bg }]}>
        <ActivityIndicator size="large" color={pal.ac} />
        <Text style={[styles.pinSub, { color: pal.t3, marginTop: spacing.md }]}>
          권한 확인 중...
        </Text>
      </View>
    );
  }

  // PIN 입력 화면 — 관리자 계정이 아닌 경우 PIN 방식으로 폴백
  if (!authed) {
    return (
      <View style={[styles.pinWrap, { backgroundColor: pal.bg }]}>
        <Text style={{ fontSize: 52, marginBottom: spacing.lg }}>🔐</Text>
        <Text style={[styles.pinTitle, { color: pal.tx }]}>관리자 PIN 입력</Text>
        <Text style={[styles.pinSub, { color: pal.t3 }]}>
          {user ? '관리자 계정으로 로그인하면 PIN 없이 진입 가능합니다.' : '기능 잠금/해제 관리자 전용'}
        </Text>
        <TextInput
          style={[styles.pinInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
          value={pin}
          onChangeText={setPin}
          placeholder="PIN 6자리"
          placeholderTextColor={pal.t3}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          onSubmitEditing={handlePinSubmit}
        />
        <TouchableOpacity
          style={[styles.pinBtn, { backgroundColor: pal.ac, opacity: saving === 'pin' ? 0.6 : 1 }]}
          onPress={handlePinSubmit}
          disabled={saving === 'pin'}
        >
          {saving === 'pin'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.pinBtnText}>확인</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  const freeCount = FEATURE_LIST.filter(f => flags[f.key] !== false).length;

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
      {/* 관리자 계정 배지 — admin role 로 진입한 경우만 표시 */}
      {adminProfile && (
        <View style={[styles.adminBadge, { backgroundColor: pal.gn + '15', borderColor: pal.gn }]}>
          <Text style={[styles.adminBadgeText, { color: pal.gn }]}>
            👤 {adminProfile.display_name || user?.email} · 관리자 계정 로그인
          </Text>
        </View>
      )}

      {/* 상단 요약 */}
      <View style={[styles.summary, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: pal.gn }]}>{freeCount}</Text>
          <Text style={[styles.summaryLbl, { color: pal.t3 }]}>무료 기능</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: pal.yw }]}>{FEATURE_LIST.length - freeCount}</Text>
          <Text style={[styles.summaryLbl, { color: pal.t3 }]}>구독 기능</Text>
        </View>
        <View style={styles.summaryBtns}>
          <TouchableOpacity
            style={[styles.bulkBtn, { backgroundColor: pal.gn + '20', borderColor: pal.gn }]}
            onPress={() => setAllFree(true)}
            disabled={saving === 'all'}
          >
            <Text style={[styles.bulkBtnText, { color: pal.gn }]}>전체 무료</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bulkBtn, { backgroundColor: pal.yw + '20', borderColor: pal.yw }]}
            onPress={() => setAllFree(false)}
            disabled={saving === 'all'}
          >
            <Text style={[styles.bulkBtnText, { color: pal.yw }]}>전체 구독</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
        <Text style={[styles.sectionLabel, { color: pal.t2 }]}>
          기능별 접근 설정 — 토글 ON: 무료 / OFF: 구독 필요
        </Text>

        {FEATURE_LIST.map(f => {
          const isFree = flags[f.key] !== false;
          const isSaving = saving === f.key || saving === 'all';
          return (
            <View key={f.key} style={[styles.featureCard, { backgroundColor: pal.s1, borderColor: isFree ? pal.gn + '40' : pal.yw + '40' }]}>
              <Text style={{ fontSize: 28 }}>{f.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureLabel, { color: pal.tx }]}>{f.label}</Text>
                <Text style={[styles.featureDesc, { color: pal.t3 }]}>{f.desc}</Text>
              </View>
              <View style={styles.toggleWrap}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={pal.ac} />
                ) : (
                  <>
                    <Text style={[styles.toggleLabel, { color: isFree ? pal.gn : pal.yw }]}>
                      {isFree ? '무료' : '구독'}
                    </Text>
                    <Switch
                      value={isFree}
                      onValueChange={() => toggleFeature(f.key, isFree)}
                      trackColor={{ false: pal.yw + '60', true: pal.gn + '60' }}
                      thumbColor={isFree ? pal.gn : pal.yw}
                    />
                  </>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 관리자 계정 로그인 배지 (상단)
  adminBadge: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1.5, alignItems: 'center',
  },
  adminBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },

  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  pinTitle: { fontSize: fontSize.xl, fontWeight: '900', marginBottom: 8 },
  pinSub: { fontSize: fontSize.sm, marginBottom: spacing.xl },
  pinInput: {
    borderWidth: 1.5, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 16,
    fontSize: 28, fontWeight: '900', textAlign: 'center',
    letterSpacing: 12, width: 220, marginBottom: spacing.lg,
  },
  pinBtn: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: radius.md },
  pinBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },

  summary: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, gap: spacing.md },
  summaryItem: { alignItems: 'center', minWidth: 52 },
  summaryVal: { fontSize: fontSize.xl, fontWeight: '900' },
  summaryLbl: { fontSize: 11, fontWeight: '600' },
  summaryBtns: { flex: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  bulkBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1 },
  bulkBtnText: { fontSize: 12, fontWeight: '800' },

  sectionLabel: { fontSize: fontSize.xs, fontWeight: '700', marginBottom: spacing.md },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.md, borderWidth: 1.5,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  featureLabel: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 2 },
  featureDesc: { fontSize: fontSize.xs },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 12, fontWeight: '800' },
});
