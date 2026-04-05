/**
 * AdminScreen — 관리자 기능 잠금/해제 대시보드
 * 마스터 PIN으로 진입, feature_flags 테이블을 직접 수정
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { supabaseAdmin } from '../lib/supabase';
import { useFeatureFlags } from '../lib/FeatureFlagsContext';

const MASTER_PIN = '777777'; // 관리자 전용 PIN — 나중에 변경 가능하게 확장

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

  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(null); // 저장 중인 feature_key

  const handlePinSubmit = () => {
    if (pin === MASTER_PIN) {
      setAuthed(true);
      setPin('');
    } else {
      Alert.alert('오류', '관리자 PIN이 올바르지 않습니다.');
      setPin('');
    }
  };

  const toggleFeature = async (key, currentValue) => {
    if (!supabaseAdmin) {
      Alert.alert('오류', '관리자 키가 설정되지 않았습니다.');
      return;
    }
    setSaving(key);
    try {
      const { error } = await supabaseAdmin
        .from('feature_flags')
        .upsert({ feature_key: key, is_free: !currentValue, updated_at: new Date().toISOString() }, { onConflict: 'feature_key' });
      if (error) throw new Error(error.message);
      await reload();
    } catch (e) {
      Alert.alert('오류', `변경 실패: ${e.message}`);
    }
    setSaving(null);
  };

  const setAllFree = async (isFree) => {
    if (!supabaseAdmin) return;
    setSaving('all');
    try {
      const rows = FEATURE_LIST.map(f => ({
        feature_key: f.key, is_free: isFree, updated_at: new Date().toISOString(),
      }));
      await supabaseAdmin.from('feature_flags').upsert(rows, { onConflict: 'feature_key' });
      await reload();
    } catch (e) {
      Alert.alert('오류', e.message);
    }
    setSaving(null);
  };

  // PIN 입력 화면
  if (!authed) {
    return (
      <View style={[styles.pinWrap, { backgroundColor: pal.bg }]}>
        <Text style={{ fontSize: 52, marginBottom: spacing.lg }}>🔐</Text>
        <Text style={[styles.pinTitle, { color: pal.tx }]}>관리자 PIN 입력</Text>
        <Text style={[styles.pinSub, { color: pal.t3 }]}>기능 잠금/해제 관리자 전용</Text>
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
        <TouchableOpacity style={[styles.pinBtn, { backgroundColor: pal.ac }]} onPress={handlePinSubmit}>
          <Text style={styles.pinBtnText}>확인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const freeCount = FEATURE_LIST.filter(f => flags[f.key] !== false).length;

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
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
