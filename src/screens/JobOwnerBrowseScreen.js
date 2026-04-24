/**
 * JobOwnerBrowseScreen — 사장용 인재 풀 탐색
 *
 * job_profiles_public 뷰에서 익명 프로필 목록을 가져와 표시.
 * RLS가 is_public=true만 노출하므로 추가 필터 불필요.
 *
 * 기능:
 *  - 등급 필터 (전체 / D / C / B / A / S)
 *  - 지역 필터 (전체 + region_si 선택)
 *  - 익명 카드 목록 (닉네임·등급·지역·경력·희망페이·자기소개 일부)
 *  - 카드 탭 → JobProfileDetail (익명 상세 + 헤드헌팅 요청 보내기)
 *  - Pull-to-refresh
 *  - 빈 상태 / 로딩 / 에러 상태
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import ScreenHeader from '../components/ScreenHeader';
import { publicListStore } from '../lib/jobStore';
import { GRADES } from '../data/jobAssessment';

const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  red2:   '#DC2626',
  redS:   'rgba(185,28,28,0.08)',
  ok:     '#15803D',
  ok2:    '#16A34A',
  blue:   '#1D4ED8',
  blue2:  '#2563EB',
  blueS:  'rgba(29,78,216,0.09)',
  warn:   '#B45309',
  warn2:  '#D97706',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
};

const GRADE_FILTERS = [null, 'S', 'A', 'B', 'C', 'D']; // null = 전체
const REGION_FILTERS = [
  null, '서울', '경기 북부', '경기 남부', '인천',
  '강원', '충북', '충남/세종/대전', '전북',
  '전남/광주', '경북/대구', '경남/부산/울산', '제주',
];

export default function JobOwnerBrowseScreen({ navigation }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  const [gradeFilter, setGradeFilter]   = useState(null);
  const [regionFilter, setRegionFilter] = useState(null);
  const [gradeOpen, setGradeOpen]       = useState(false);
  const [regionOpen, setRegionOpen]     = useState(false);

  const load = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    if (!silent) setLoading(true);
    const { data, error } = await publicListStore.list({
      grade: gradeFilter,
      region_si: regionFilter,
      limit: 60,
    });
    if (error) setErrMsg(error);
    else       setErrMsg(null);
    setProfiles(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [gradeFilter, regionFilter]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  const handleCardPress = (profile) => {
    navigation.navigate('JobProfileDetail', { profileId: profile.id });
  };

  return (
    <View style={S.container}>
      <ScreenHeader
        title="인재 풀 탐색"
        iconName="search-outline"
        iconBg={C.blue2}
      />

      {/* 필터 바 — 드롭다운 2개 (40-50대 가독성) */}
      <View style={S.filterBar}>
        <TouchableOpacity
          style={[S.dropBtn, gradeFilter && S.dropBtnActive]}
          onPress={() => setGradeOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={S.dropLbl}>등급</Text>
          <Text style={[S.dropVal, gradeFilter && { color: C.blue2 }]} numberOfLines={1}>
            {gradeFilter ? `${gradeFilter}급` : '전체'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={C.t2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[S.dropBtn, regionFilter && S.dropBtnActive]}
          onPress={() => setRegionOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={S.dropLbl}>지역</Text>
          <Text style={[S.dropVal, regionFilter && { color: C.blue2 }]} numberOfLines={1}>
            {regionFilter || '전체'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={C.t2} />
        </TouchableOpacity>
      </View>

      {/* 등급 선택 모달 (bottom-sheet) */}
      <Modal visible={gradeOpen} transparent animationType="fade" onRequestClose={() => setGradeOpen(false)}>
        <TouchableOpacity style={S.sheetBackdrop} activeOpacity={1} onPress={() => setGradeOpen(false)}>
          <View style={S.sheetBox}>
            <View style={S.sheetHead}>
              <Text style={S.sheetTtl}>등급 선택</Text>
              <TouchableOpacity onPress={() => setGradeOpen(false)} style={S.sheetClose}>
                <Ionicons name="close" size={24} color={C.t2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              {GRADE_FILTERS.map(g => {
                const active = gradeFilter === g;
                const info   = g ? GRADES.find(x => x.letter === g) : null;
                return (
                  <TouchableOpacity
                    key={g || 'all'}
                    style={[S.sheetItem, active && S.sheetItemActive]}
                    onPress={() => { setGradeFilter(g); setGradeOpen(false); }}
                    activeOpacity={0.8}
                  >
                    {info ? (
                      <View style={[S.sheetDot, { backgroundColor: info.color }]}>
                        <Text style={S.sheetDotTxt}>{info.letter}</Text>
                      </View>
                    ) : (
                      <View style={[S.sheetDot, { backgroundColor: C.t4 }]}>
                        <Ionicons name="apps-outline" size={16} color="#fff" />
                      </View>
                    )}
                    <Text style={[S.sheetItemTxt, active && { color: C.blue2, fontWeight: '900' }]}>
                      {g ? `${g}급` : '전체'}
                    </Text>
                    {active && <Ionicons name="checkmark" size={22} color={C.blue2} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 지역 선택 모달 (bottom-sheet) */}
      <Modal visible={regionOpen} transparent animationType="fade" onRequestClose={() => setRegionOpen(false)}>
        <TouchableOpacity style={S.sheetBackdrop} activeOpacity={1} onPress={() => setRegionOpen(false)}>
          <View style={S.sheetBox}>
            <View style={S.sheetHead}>
              <Text style={S.sheetTtl}>지역 선택</Text>
              <TouchableOpacity onPress={() => setRegionOpen(false)} style={S.sheetClose}>
                <Ionicons name="close" size={24} color={C.t2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              {REGION_FILTERS.map(r => {
                const active = regionFilter === r;
                return (
                  <TouchableOpacity
                    key={r || 'all'}
                    style={[S.sheetItem, active && S.sheetItemActive]}
                    onPress={() => { setRegionFilter(r); setRegionOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={r ? 'location-outline' : 'apps-outline'}
                      size={20}
                      color={active ? C.blue2 : C.t3}
                      style={{ width: 34, textAlign: 'center' }}
                    />
                    <Text style={[S.sheetItemTxt, active && { color: C.blue2, fontWeight: '900' }]}>
                      {r || '전체'}
                    </Text>
                    {active && <Ionicons name="checkmark" size={22} color={C.blue2} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue2} />}
      >
        {/* 요약 */}
        <View style={S.summaryRow}>
          <Text style={S.summaryTxt}>
            공개 프로필 <Text style={{ color: C.blue2, fontWeight: '900' }}>{profiles.length}</Text>명
            {gradeFilter ? ` · ${gradeFilter}급` : ''}
            {regionFilter ? ` · ${regionFilter}` : ''}
          </Text>
          {(gradeFilter || regionFilter) && (
            <TouchableOpacity onPress={() => { setGradeFilter(null); setRegionFilter(null); }}>
              <Text style={S.resetTxt}>필터 초기화</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={S.center}>
            <ActivityIndicator size="large" color={C.blue2} />
            <Text style={S.loadingTxt}>인재 풀 불러오는 중...</Text>
          </View>
        )}

        {!loading && errMsg && (
          <View style={S.errBox}>
            <Ionicons name="cloud-offline-outline" size={28} color={C.warn2} />
            <Text style={S.errTtl}>불러오지 못했습니다</Text>
            <Text style={S.errSb}>{errMsg}</Text>
            <TouchableOpacity style={S.retryBtn} onPress={() => load()}>
              <Ionicons name="refresh-outline" size={14} color={C.t2} />
              <Text style={S.retryTxt}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !errMsg && profiles.length === 0 && (
          <View style={S.center}>
            <Ionicons name="people-outline" size={40} color={C.t4} />
            <Text style={S.emptyTtl}>조건에 맞는 인재가 없습니다</Text>
            <Text style={S.emptySb}>
              필터를 조정하거나 잠시 후 다시 확인해 보세요.{'\n'}
              프로모 기간 중이라 프로필 등록이 계속 늘고 있습니다.
            </Text>
          </View>
        )}

        {!loading && profiles.map(p => (
          <ProfileCard key={p.id} profile={p} onPress={() => handleCardPress(p)} />
        ))}

        {/* 안내 */}
        {!loading && profiles.length > 0 && (
          <View style={S.notice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.blue} />
            <Text style={S.noticeTxt}>
              실명·연락처·사진 원본은 구직자가 헤드헌팅 요청을 수락한 경우에만 공개됩니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── 프로필 카드 ────────────────────────────────────────────
function ProfileCard({ profile, onPress }) {
  const grade = GRADES.find(g => g.letter === profile.assessment_grade);
  const years = profile.career_years ?? 0;

  return (
    <TouchableOpacity style={S.card} onPress={onPress} activeOpacity={0.85}>
      <View style={S.cardHead}>
        {grade ? (
          <View style={[S.gradeCircle, { backgroundColor: grade.color }]}>
            <Text style={S.gradeLetter}>{grade.letter}</Text>
          </View>
        ) : (
          <View style={[S.gradeCircle, { backgroundColor: C.t4 }]}>
            <Ionicons name="person-outline" size={18} color="#fff" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={S.cardTtl} numberOfLines={1}>
            {profile.nickname || '익명 구직자'}
            {profile.phone_verified && (
              <Text>  <Ionicons name="checkmark-circle" size={13} color={C.ok2} /></Text>
            )}
          </Text>
          <Text style={S.cardSb} numberOfLines={1}>
            {profile.region_si || '지역 미지정'}
            {profile.region_gu ? ` · ${profile.region_gu}` : ''}
            {years ? ` · 경력 ${years}년` : ''}
          </Text>
        </View>
        {grade && (
          <View style={[S.scorePill, { backgroundColor: grade.bg }]}>
            <Text style={[S.scorePillTxt, { color: grade.color }]}>
              {Math.round(profile.assessment_score || 0)}점
            </Text>
          </View>
        )}
      </View>

      <View style={S.metaRow}>
        {profile.preferred_role ? (
          <View style={S.metaChip}>
            <Ionicons name="briefcase-outline" size={11} color={C.t3} />
            <Text style={S.metaTxt}>{profile.preferred_role}</Text>
          </View>
        ) : null}
        {profile.desired_pay ? (
          <View style={S.metaChip}>
            <Ionicons name="cash-outline" size={11} color={C.t3} />
            <Text style={S.metaTxt}>{profile.desired_pay}</Text>
          </View>
        ) : null}
        {profile.work_hours_pref ? (
          <View style={S.metaChip}>
            <Ionicons name="time-outline" size={11} color={C.t3} />
            <Text style={S.metaTxt}>{profile.work_hours_pref}</Text>
          </View>
        ) : null}
      </View>

      {profile.intro_text ? (
        <Text style={S.intro} numberOfLines={2}>
          {profile.intro_text}
        </Text>
      ) : null}

      <View style={S.cardFoot}>
        {profile.review_count > 0 ? (
          <View style={S.starRow}>
            <Ionicons name="star" size={12} color={C.warn2} />
            <Text style={S.starTxt}>
              {(profile.review_avg || 0).toFixed(1)} ({profile.review_count})
            </Text>
          </View>
        ) : <View />}
        <View style={S.viewDetail}>
          <Text style={S.viewDetailTxt}>상세 보기</Text>
          <Ionicons name="chevron-forward" size={12} color={C.blue2} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 120 },

  // 필터 — 드롭다운 2개 (40-50대 가독성)
  filterBar: {
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', gap: 10,
  },
  dropBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bg2,
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 52,
  },
  dropBtnActive: {
    backgroundColor: C.blueS,
    borderColor: C.blue2,
  },
  dropLbl: {
    fontSize: 13, fontWeight: '800', color: C.t3,
    marginRight: 2,
  },
  dropVal: {
    flex: 1, fontSize: 16, fontWeight: '900', color: C.t1,
  },

  // Bottom-sheet 선택 모달
  sheetBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheetBox: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 24, maxHeight: '75%',
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.bg2,
  },
  sheetTtl: { fontSize: 17, fontWeight: '900', color: C.t1 },
  sheetClose: { padding: 4 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.bg2,
  },
  sheetItemActive: { backgroundColor: C.blueS },
  sheetItemTxt: { flex: 1, fontSize: 16, fontWeight: '700', color: C.t1 },
  sheetDot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetDotTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryTxt: { fontSize: 13, color: C.t2, fontWeight: '700' },
  resetTxt: { fontSize: 12, color: C.red, fontWeight: '800' },

  // 상태
  center: {
    paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  loadingTxt: { fontSize: 12, color: C.t3, marginTop: 4 },
  emptyTtl:   { fontSize: 14, fontWeight: '800', color: C.t2, marginTop: 4 },
  emptySb:    { fontSize: 12, color: C.t3, textAlign: 'center', lineHeight: 17 },

  errBox: {
    padding: 20, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', gap: 8,
  },
  errTtl: { fontSize: 14, fontWeight: '800', color: C.t1 },
  errSb:  { fontSize: 11, color: C.t3, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.bg2, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, marginTop: 4,
  },
  retryTxt: { fontSize: 12, fontWeight: '800', color: C.t2 },

  // 카드
  card: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 10,
  },
  gradeCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeLetter: { color: '#fff', fontSize: 18, fontWeight: '900' },
  cardTtl: { fontSize: 14, fontWeight: '900', color: C.t1 },
  cardSb:  { fontSize: 11, color: C.t3, marginTop: 2 },

  scorePill: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  scorePillTxt: { fontSize: 11, fontWeight: '900' },

  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
    marginBottom: 8,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.bg2, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaTxt: { fontSize: 11, fontWeight: '700', color: C.t3 },

  intro: {
    fontSize: 12, color: C.t2, lineHeight: 17,
    marginBottom: 10,
  },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: C.bg2,
  },
  starRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  starTxt: { fontSize: 11, fontWeight: '800', color: C.t2 },
  viewDetail: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  viewDetailTxt: { fontSize: 11, fontWeight: '800', color: C.blue2 },

  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 10, padding: 12,
    backgroundColor: C.blueS, borderRadius: 10,
  },
  noticeTxt: { flex: 1, fontSize: 11, color: C.blue, lineHeight: 16 },
});
