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
  RefreshControl, ActivityIndicator,
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

      {/* 필터 바 */}
      <View style={S.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterRow}>
          <Text style={S.filterLbl}>등급</Text>
          {GRADE_FILTERS.map(g => {
            const active = gradeFilter === g;
            const info   = g ? GRADES.find(x => x.letter === g) : null;
            return (
              <TouchableOpacity
                key={g || 'all'}
                style={[
                  S.filterChip,
                  active && { backgroundColor: info?.color || C.t1, borderColor: info?.color || C.t1 },
                ]}
                onPress={() => setGradeFilter(g)}
                activeOpacity={0.8}
              >
                <Text style={[S.filterChipTxt, active && { color: '#fff' }]}>
                  {g ? `${g}급` : '전체'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={S.filterDivider} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterRow}>
          <Text style={S.filterLbl}>지역</Text>
          {REGION_FILTERS.map(r => {
            const active = regionFilter === r;
            return (
              <TouchableOpacity
                key={r || 'all'}
                style={[S.filterChip, active && { backgroundColor: C.blue2, borderColor: C.blue2 }]}
                onPress={() => setRegionFilter(r)}
                activeOpacity={0.8}
              >
                <Text style={[S.filterChipTxt, active && { color: '#fff' }]}>
                  {r || '전체'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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

  // 필터
  filterBar: {
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingVertical: 6,
  },
  filterRow: {
    paddingHorizontal: 12, gap: 6,
    alignItems: 'center', flexDirection: 'row',
  },
  filterDivider: { height: 1, backgroundColor: C.bg2, marginVertical: 4 },
  filterLbl: {
    fontSize: 11, fontWeight: '800', color: C.t3,
    marginRight: 6,
  },
  filterChip: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
  },
  filterChipTxt: { fontSize: 11, fontWeight: '700', color: C.t2 },

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
