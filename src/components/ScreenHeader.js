/**
 * ScreenHeader — 전체 화면 공통 상단 헤더
 *
 * 디자인 일체감 원칙:
 *  - 모든 랜딩/상세 페이지가 동일한 헤더 패턴 사용
 *  - 좌측: 뒤로가기 (chevron-back-outline)
 *     · navigation.canGoBack() === true  → navigation.goBack()
 *     · canGoBack === false (탭 루트)    → onBackPressOverride 우선 호출 (없으면 홈으로 이동)
 *  - 중앙: 아이콘 + 제목
 *  - 우측: (선택) action slot — 버튼/아이콘 배치
 *  - 하단: 빨간 엑센트 라인 (기존 DocumentScreen 스타일 유지)
 *  - Safe Area top inset 반영 (노치 회피)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

// V5 팔레트 (타 화면과 동일 기준)
const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
};

/**
 * @param {string} title            제목 텍스트
 * @param {string} iconName         Ionicons 아이콘 이름 (outline 권장)
 * @param {string} iconColor        아이콘 색 (기본 흰색)
 * @param {string} iconBg           아이콘 배경 (기본 C.red)
 * @param {boolean} showBack        뒤로가기 버튼 표시 (기본 true)
 * @param {function} onBackPressOverride  뒤로가기 커스텀 동작 (탭 루트에서 홈 이동 등)
 * @param {React.ReactNode} rightAction   우측 액션 슬롯
 * @param {string} subtitle         (선택) 제목 아래 보조 텍스트
 * @param {boolean} noAccent        하단 빨간 라인 숨김
 */
export default function ScreenHeader({
  title,
  iconName = 'document-text-outline',
  iconColor = '#fff',
  iconBg,
  showBack = true,
  onBackPressOverride,
  rightAction,
  subtitle,
  noAccent = false,
}) {
  const insets = useSafeAreaInsets();
  let navigation = null;
  try { navigation = useNavigation(); } catch (_) { /* 루트 외 컨텍스트 대비 */ }

  const handleBack = () => {
    if (onBackPressOverride) { onBackPressOverride(); return; }
    if (!navigation) return;
    if (navigation.canGoBack?.()) { navigation.goBack(); return; }
    // 탭 루트에서 홈으로 이동
    try {
      navigation.getParent?.()?.navigate?.('HomeTab');
    } catch (_) {}
  };

  return (
    <View style={[S.root, { paddingTop: insets.top || (Platform.OS === 'ios' ? 12 : 8) }]}>
      <View style={S.row}>
        <TouchableOpacity
          style={S.backBtn}
          onPress={handleBack}
          activeOpacity={0.7}
          disabled={!showBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {showBack && (
            <Ionicons name="chevron-back-outline" size={24} color={C.t2} />
          )}
        </TouchableOpacity>

        <View style={S.center}>
          <View style={[S.iconBox, { backgroundColor: iconBg || C.red }]}>
            <Ionicons name={iconName} size={16} color={iconColor} />
          </View>
          <View>
            <Text style={S.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={S.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={S.right}>
          {rightAction || <View style={{ width: 40 }} />}
        </View>
      </View>

      {!noAccent && <View style={S.accent} />}
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    backgroundColor: C.white,
    paddingBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconBox: {
    width: 28, height: 28,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: C.t1,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 11,
    color: C.t3,
    marginTop: 1,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  accent: {
    height: 3,
    backgroundColor: C.red,
  },
});

// 팔레트 재노출 (다른 화면에서 동일 색 쓸 때)
export const HEADER_COLORS = C;
