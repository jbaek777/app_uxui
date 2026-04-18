import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { lightColors, darkColors, fontSize, spacing, radius } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { meatInventory, hygieneData } from '../data/mockData';
import { meatStore, hygieneStore } from '../lib/dataStore';

const getBuyPrice  = m => m.buyPrice  || m.buy_price  || 0;
const getSellPrice = m => m.sellPrice || m.sell_price || 0;
const getDday      = m => m.dday != null ? m.dday : 99;
const getMarginPct = m => {
  const buy = getBuyPrice(m), sell = getSellPrice(m);
  if (!buy || !sell) return null;
  return Math.round((sell - buy) / buy * 100);
};

// ── 색상 상수 (V5 디자인 시스템) ──────────────────────────
const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  red2:   '#DC2626',
  redS:   'rgba(185,28,28,0.08)',
  redS2:  'rgba(185,28,28,0.14)',
  ok:     '#15803D',
  ok2:    '#16A34A',
  okS:    'rgba(21,128,61,0.09)',
  warn:   '#B45309',
  warn2:  '#D97706',
  warnS:  'rgba(180,83,9,0.09)',
  blue:   '#1D4ED8',
  blue2:  '#2563EB',
  blueS:  'rgba(29,78,216,0.09)',
  pur:    '#6D28D9',
  purS:   'rgba(109,40,217,0.09)',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
  bg3:    '#E8ECF2',
};

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [bizName, setBizName]     = useState('');
  const [meat, setMeat]           = useState([]);
  const [hygieneLogs, setHygiene] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [marginTab, setMarginTab] = useState('top'); // 'top' | 'low'
  const [activeChip, setChip]     = useState('전체');
  const [searchQ, setSearchQ]     = useState('');

  const today    = new Date();
  const dateStr  = today.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
  const todayStr = today.toLocaleDateString('ko-KR');
  const todayISO = today.toISOString().slice(0, 10);

  useEffect(() => {
    AsyncStorage.getItem('@meatbig_biz').then(raw => {
      if (raw) { try { setBizName(JSON.parse(raw).bizName || ''); } catch (_) {} }
    });
  }, []);

  useEffect(() => {
    Promise.all([meatStore.load(meatInventory), hygieneStore.load(hygieneData)])
      .then(([m, h]) => { setMeat(m); setHygiene(h); setLoading(false); });
  }, []);

  const activeMeat   = meat.filter(m => !m.sold);
  const urgent       = activeMeat.filter(m => getDday(m) <= 1);
  const nearExpiry3  = activeMeat.filter(m => getDday(m) <= 3);
  const potentialLoss = nearExpiry3.reduce((s, m) => s + (m.qty || 0) * getBuyPrice(m), 0);

  const marginItems = activeMeat
    .filter(m => getBuyPrice(m) > 0 && getSellPrice(m) > 0)
    .map(m => ({ ...m, marginPct: getMarginPct(m) }))
    .filter(m => m.marginPct !== null)
    .sort((a, b) => b.marginPct - a.marginPct);
  const topMargin    = marginItems.slice(0, 3);
  const lowMargin    = [...marginItems].sort((a, b) => a.marginPct - b.marginPct).slice(0, 3);
  const maxMarginPct = marginItems.length > 0 ? marginItems[0].marginPct : 100;

  const todayHygiene  = hygieneLogs.filter(h => {
    const d = h.log_date || h.date || '';
    return d === todayStr || d === todayISO || (d && d.startsWith(todayISO));
  });
  const hygieneNeeded = todayHygiene.length === 0;
  const checkDoneCount = [!hygieneNeeded, true, true].filter(Boolean).length;

  const QUICK_ACTIONS = [
    { ionicon:'scan-outline', label:'이력\n스캔', tab:'TraceTab', screen:'Scan', main:true },
    { ionicon:'shield-checkmark-outline', label:'위생\n일지', tab:'DocsTab', screen:'Hygiene', main:false },
    { ionicon:'nutrition-outline', label:'숙성\n관리', tab:'DocsTab', screen:'Aging', main:false },
    { ionicon:'document-text-outline', label:'서류\n출력', tab:'DocsTab', screen:'Documents', main:false },
    { ionicon:'calculator-outline', label:'마감\n정산', tab:'DocsTab', screen:'Closing', main:false },
    { ionicon:'cube-outline', label:'재고\n확인', tab:'InventoryTab', screen:null, main:false },
  ];

  const PHOTO_COLORS = ['#6B1515', '#7A2010', '#6B3010', '#4A2800'];

  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator size="large" color={C.red} />
        <Text style={{ color:C.t3, marginTop:12, fontSize:fontSize.sm }}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* ── 헤더 ──────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 2 }]}>
        <View style={styles.headerAccent} />
        <View style={styles.headerTop}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}><Ionicons name="nutrition" size={17} color="#fff" /></View>
            <Text style={styles.brandName}>MeatBig</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => {}}>
            <Ionicons name="notifications-outline" size={18} color={C.t2} />
            {urgent.length > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <Text style={styles.headerStore}>
            {bizName || '한우직판장'}{' '}
            <Text style={{ color:C.red }}>사장님</Text>
          </Text>
        </View>
      </View>

      {/* ── 검색 ──────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.searchRow}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('InventoryTab')}
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={C.t4} />
          <TextInput
            style={styles.searchInput}
            placeholder="재고명, 등급으로 검색..."
            placeholderTextColor={C.t4}
            value={searchQ}
            onChangeText={setSearchQ}
            onSubmitEditing={() => navigation.navigate('InventoryTab')}
            returnKeyType="search"
          />
          {searchQ.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQ('')}>
              <Ionicons name="close-circle" size={18} color={C.t4} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* ── 카테고리 칩 ───────────────────────────────────── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.chipsWrap}
        contentContainerStyle={styles.chipsContent}
      >
        {['전체','한우','수입육', nearExpiry3.length > 0 ? `⚠ 임박 ${nearExpiry3.length}건` : null, '숙성중']
          .filter(Boolean)
          .map(chip => {
            const isWarn = chip.includes('임박');
            const isActive = activeChip === chip;
            return (
              <TouchableOpacity
                key={chip}
                style={[
                  styles.chip,
                  isActive && styles.chipActive,
                  isWarn && !isActive && styles.chipWarn,
                ]}
                onPress={() => setChip(chip)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.chipTxt,
                  isActive && styles.chipTxtActive,
                  isWarn && !isActive && { color: C.warn },
                ]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* ── 스크롤 본문 ───────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >

        {/* 손실 배너 */}
        {nearExpiry3.length > 0 && (
          <TouchableOpacity
            style={styles.lossBanner}
            onPress={() => navigation.navigate('InventoryTab')}
            activeOpacity={0.85}
          >
            <View style={styles.lossStripe} />
            <View style={styles.lossInner}>
              <View style={styles.lossIconBox}>
                <Ionicons name="alert-circle" size={22} color={C.red} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={styles.lossTtl}>3일 내 손실 위험 {nearExpiry3.length}건</Text>
                <Text style={styles.lossSub} numberOfLines={1}>
                  {nearExpiry3.slice(0,3).map(m => `${m.cut} D-${getDday(m)}`).join(' · ')}
                </Text>
              </View>
              <View style={styles.lossRight}>
                <Text style={styles.lossAmt}>₩{potentialLoss.toLocaleString()}</Text>
                <Text style={styles.lossLbl}>손실 예상액</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* 3 stat 카드 */}
        <View style={styles.statsRow}>
          <StatCard
            color={C.red} iconBg={C.redS}
            ionicon="cube-outline" value={activeMeat.length}
            label={'재고\n종류'}
            onPress={() => navigation.navigate('InventoryTab')}
          />
          <StatCard
            color={nearExpiry3.length > 0 ? C.warn2 : C.ok2}
            iconBg={nearExpiry3.length > 0 ? C.warnS : C.okS}
            ionicon="alarm-outline" value={nearExpiry3.length}
            label={'소비기한\n임박'}
            onPress={() => navigation.navigate('InventoryTab')}
          />
          <StatCard
            color={C.ok2} iconBg={C.okS}
            ionicon="checkmark-circle-outline" value={`${checkDoneCount}/3`}
            label={'오늘\n점검'}
            onPress={() => navigation.navigate('DocsTab')}
          />
        </View>

        {/* 오늘의 점검 */}
        <SecHeader
          label="오늘의 점검" linkLabel="전체 보기"
          onLink={() => navigation.navigate('DocsTab')}
        />
        <View style={styles.checksWrap}>
          <CheckItem
            label="이력번호 조회" sub="바코드 스캔으로 확인"
            stripe={C.red} iconBg={C.redS} iconName="pricetag-outline"
            badgeColor={C.red} badgeTxt="2건"
            onPress={() => navigation.navigate('TraceTab', { screen:'Scan' })}
          />
          <CheckItem
            label="위생점검" sub="오전 위생일지 작성"
            stripe={hygieneNeeded ? C.warn2 : C.ok2}
            iconBg={hygieneNeeded ? C.warnS : C.okS}
            iconName="shield-checkmark-outline"
            badgeColor={hygieneNeeded ? C.warn2 : C.ok2}
            badgeTxt={hygieneNeeded ? '미완료' : '완료'}
            onPress={() => navigation.navigate('DocsTab', { screen:'Hygiene' })}
          />
          <CheckItem
            label="냉장고 온도" sub="온도 기록 및 확인"
            stripe={C.blue2} iconBg={C.blueS} iconName="thermometer-outline"
            badgeColor={C.blue2} badgeTxt="기록 필요"
            onPress={() => {}}
          />
        </View>

        {/* 재고 현황 2열 그리드 */}
        <SecHeader
          label="재고 현황" linkLabel="재고 보기"
          onLink={() => navigation.navigate('InventoryTab')}
        />
        {activeMeat.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={32} color={C.t4} style={{ marginBottom:8 }} />
            <Text style={{ fontSize:fontSize.sm, fontWeight:'700', color:C.t2, marginBottom:4 }}>재고가 없습니다</Text>
            <Text style={{ fontSize:fontSize.xs, color:C.t3 }}>재고 탭에서 첫 재고를 등록해보세요</Text>
          </View>
        ) : (
          <View style={styles.invGrid}>
            {activeMeat.slice(0, 4).map((item, idx) => {
              const dday = getDday(item);
              const ddColor = dday <= 1 ? C.red : dday <= 3 ? C.warn2 : null;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.invCard}
                  onPress={() => navigation.navigate('InventoryTab')}
                  activeOpacity={0.85}
                >
                  {/* 사진 영역 */}
                  <View style={[styles.invPhoto, { backgroundColor: PHOTO_COLORS[idx % 4] }]}>
                    <View style={styles.invPhotoOverlay} />
                    <Text style={styles.invPhotoIcon}>🥩</Text>
                    <View style={styles.invBadges}>
                      <View style={styles.invGrade}>
                        <Text style={styles.invGradeTxt}>{item.grade || '1+'}</Text>
                      </View>
                      {ddColor && (
                        <View style={[styles.invDday, { backgroundColor: C.white }]}>
                          <Text style={[styles.invDdayTxt, { color: ddColor }]}>
                            {dday === 0 ? 'D-0' : `D-${dday}`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {/* 정보 영역 */}
                  <View style={styles.invBody}>
                    <Text style={styles.invName} numberOfLines={1}>{item.cut}</Text>
                    <Text style={styles.invSub}>{item.qty}kg · {item.origin}</Text>
                    <Text style={styles.invPrice}>
                      {getSellPrice(item) > 0 ? `₩${getSellPrice(item).toLocaleString()}/kg` : '—'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 마진 분석 */}
        {marginItems.length > 0 && (
          <>
            <SecHeader label="마진 분석" />
            <View style={styles.mgWrap}>
              {/* 탭 */}
              <View style={styles.mgTabs}>
                <TouchableOpacity
                  style={[styles.mgTab, marginTab === 'top' && styles.mgTabOn]}
                  onPress={() => setMarginTab('top')}
                >
                  <Text style={[styles.mgTabTxt, marginTab === 'top' && styles.mgTabTxtOn]}>
                    고마진 TOP 3
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mgTab, marginTab === 'low' && styles.mgTabOn]}
                  onPress={() => setMarginTab('low')}
                >
                  <Text style={[styles.mgTabTxt, marginTab === 'low' && styles.mgTabTxtOn]}>
                    손실 주의
                  </Text>
                </TouchableOpacity>
              </View>
              {/* 마진 바 */}
              <View style={{ gap:7 }}>
                {(marginTab === 'top' ? topMargin : lowMargin).map((item, idx) => {
                  const isGood = marginTab === 'top';
                  const pct = Math.max(4, Math.round((item.marginPct / (maxMarginPct || 1)) * 100));
                  return (
                    <View key={item.id} style={styles.mgRow}>
                      <View style={[styles.mgRank, { backgroundColor: isGood ? C.okS : C.warnS }]}>
                        <Text style={[styles.mgRankTxt, { color: isGood ? C.ok2 : C.warn2 }]}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.mgName} numberOfLines={1}>{item.cut}</Text>
                      <View style={styles.mgBarWrap}>
                        <View style={styles.mgBarBg}>
                          <View style={[styles.mgBarFill, {
                            width: `${pct}%`,
                            backgroundColor: isGood ? C.ok2 : C.warn2,
                          }]} />
                        </View>
                      </View>
                      <Text style={[styles.mgPct, { color: isGood ? C.ok2 : C.warn2 }]}>
                        {item.marginPct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* 빠른 실행 */}
        <SecHeader label="빠른 실행" />
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.quickBtn, q.main && styles.quickBtnMain]}
              onPress={() => {
                if (q.screen) navigation.navigate(q.tab, { screen:q.screen, initial:true });
                else navigation.navigate(q.tab);
              }}
              activeOpacity={0.8}
            >
              {urgent.length > 0 && q.screen === 'Scan' && (
                <View style={styles.quickBadge}><Text style={{ fontSize:8, color:'#fff', fontWeight:'800' }}>{urgent.length}</Text></View>
              )}
              <View style={[styles.quickIcon, q.main && styles.quickIconMain]}>
                <Ionicons name={q.ionicon} size={22} color={q.main ? '#fff' : C.t2} />
              </View>
              <Text style={[styles.quickLabel, q.main && styles.quickLabelMain]}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function SecHeader({ label, linkLabel, onLink }) {
  return (
    <View style={styles.secHeader}>
      <Text style={styles.secTitle}>{label}</Text>
      {linkLabel && onLink && (
        <TouchableOpacity onPress={onLink} style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
          <Text style={styles.secLink}>{linkLabel}</Text>
          <Text style={[styles.secLink, { fontSize:12 }]}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatCard({ color, iconBg, ionicon, value, label, onPress }) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={ionicon} size={16} color={color} />
      </View>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </TouchableOpacity>
  );
}

function CheckItem({ label, sub, stripe, iconBg, iconName, badgeColor, badgeTxt, onPress }) {
  return (
    <TouchableOpacity style={styles.ckItem} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.ckStripe, { backgroundColor: stripe }]} />
      <View style={[styles.ckIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={stripe} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={styles.ckName}>{label}</Text>
        <Text style={styles.ckSub}>{sub}</Text>
      </View>
      <View style={[styles.ckBadge, { backgroundColor: badgeColor + '18' }]}>
        <Text style={[styles.ckBadgeTxt, { color: badgeColor }]}>{badgeTxt}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── StyleSheet ────────────────────────────────────────────
const styles = StyleSheet.create({
  // 헤더
  header:       { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, overflow:'hidden' },
  headerAccent: { height:3, backgroundColor:C.red, position:'absolute', top:0, left:0, right:0 },
  headerTop:    { paddingHorizontal:20, paddingTop:10, paddingBottom:2, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  brand:        { flexDirection:'row', alignItems:'center', gap:9 },
  brandIcon:    { width:33, height:33, borderRadius:10, backgroundColor:C.red, alignItems:'center', justifyContent:'center' },
  brandName:    { fontSize:18, fontWeight:'800', color:C.t1, letterSpacing:-0.5 },
  notifBtn:     { width:34, height:34, borderRadius:17, backgroundColor:C.bg2, alignItems:'center', justifyContent:'center' },
  notifDot:     { position:'absolute', top:6, right:6, width:7, height:7, borderRadius:4, backgroundColor:C.red, borderWidth:1.5, borderColor:C.white },
  headerInfo:   { paddingHorizontal:20, paddingBottom:14, paddingTop:4 },
  headerDate:   { fontSize:14, color:C.t3, fontWeight:'500', marginBottom:4 },
  headerStore:  { fontSize:28, fontWeight:'900', color:C.t1, letterSpacing:-0.8 },

  // 검색
  searchRow:    { backgroundColor:C.white, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border },
  searchBox:    { backgroundColor:C.bg2, borderRadius:14, paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', gap:10, minHeight:48 },
  searchInput:  { flex:1, fontSize:16, color:C.t1, fontWeight:'500', paddingVertical:0 },

  // 칩
  chipsWrap:    { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border, minHeight:60 },
  chipsContent: { paddingHorizontal:16, paddingVertical:12, flexDirection:'row', gap:10, alignItems:'center' },
  chip:         { height:42, paddingHorizontal:22, borderRadius:21, backgroundColor:'#E8ECF2', alignItems:'center', justifyContent:'center' },
  chipActive:   { backgroundColor:'#0F172A' },
  chipWarn:     { backgroundColor:'#FEF3C7', borderWidth:1.5, borderColor:'#D97706' },
  chipTxt:      { fontSize:17, fontWeight:'800', color:'#0F172A', includeFontPadding:false, textAlignVertical:'center' },
  chipTxtActive:{ color:'#FFFFFF' },

  // 손실 배너
  lossBanner:   { marginHorizontal:16, marginTop:14, backgroundColor:C.white, borderRadius:20, overflow:'hidden', borderWidth:1, borderColor:C.border, flexDirection:'row' },
  lossStripe:   { width:4, backgroundColor:C.red },
  lossInner:    { flex:1, padding:14, flexDirection:'row', alignItems:'center', gap:12 },
  lossIconBox:  { width:44, height:44, borderRadius:14, backgroundColor:C.redS, alignItems:'center', justifyContent:'center' },
  lossTtl:      { fontSize:16, fontWeight:'700', color:C.t1, marginBottom:3 },
  lossSub:      { fontSize:14, color:C.t3, lineHeight:18 },
  lossRight:    { alignItems:'flex-end', flexShrink:0 },
  lossAmt:      { fontSize:20, fontWeight:'900', color:C.red, letterSpacing:-0.8, marginBottom:2 },
  lossLbl:      { fontSize:11, color:C.t4 },

  // stat 카드
  statsRow:     { flexDirection:'row', gap:9, paddingHorizontal:16, paddingTop:14 },
  statCard:     { flex:1, backgroundColor:C.white, borderRadius:16, padding:14, overflow:'hidden' },
  statAccent:   { position:'absolute', top:0, left:0, right:0, height:3 },
  statIcon:     { width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:10 },
  statVal:      { fontSize:36, fontWeight:'900', letterSpacing:-1.5, lineHeight:40, marginBottom:6 },
  statLbl:      { fontSize:13, color:C.t3, fontWeight:'600', lineHeight:17 },

  // 섹션 헤더
  secHeader:    { paddingHorizontal:20, paddingTop:22, paddingBottom:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  secTitle:     { fontSize:20, fontWeight:'800', color:C.t1, letterSpacing:-0.4 },
  secLink:      { fontSize:14, fontWeight:'600', color:C.red },

  // 점검 아이템
  checksWrap:   { paddingHorizontal:16, gap:9 },
  ckItem:       { backgroundColor:C.white, borderRadius:16, padding:16, paddingLeft:20, flexDirection:'row', alignItems:'center', gap:13, overflow:'hidden' },
  ckStripe:     { position:'absolute', left:0, top:0, bottom:0, width:3 },
  ckIcon:       { width:42, height:42, borderRadius:12, alignItems:'center', justifyContent:'center' },
  ckName:       { fontSize:17, fontWeight:'700', color:C.t1, marginBottom:3 },
  ckSub:        { fontSize:14, color:C.t3 },
  ckBadge:      { paddingHorizontal:12, paddingVertical:5, borderRadius:20 },
  ckBadgeTxt:   { fontSize:14, fontWeight:'700' },

  // 재고 그리드
  invGrid:      { paddingHorizontal:16, flexDirection:'row', flexWrap:'wrap', gap:11 },
  invCard:      { width:'47.5%', backgroundColor:C.white, borderRadius:20, overflow:'hidden' },
  invPhoto:     { height:95, alignItems:'center', justifyContent:'center', position:'relative' },
  invPhotoOverlay:{ position:'absolute', bottom:0, left:0, right:0, height:40, backgroundColor:'rgba(0,0,0,0.25)' },
  invPhotoIcon: { fontSize:34, opacity:0.35, zIndex:2 },
  invBadges:    { position:'absolute', top:8, left:8, right:8, flexDirection:'row', justifyContent:'space-between', zIndex:4 },
  invGrade:     { backgroundColor:'rgba(255,255,255,0.2)', borderRadius:6, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:'rgba(255,255,255,0.25)' },
  invGradeTxt:  { fontSize:11, fontWeight:'800', color:'#fff' },
  invDday:      { borderRadius:6, paddingHorizontal:9, paddingVertical:4 },
  invDdayTxt:   { fontSize:12, fontWeight:'800' },
  invBody:      { padding:12 },
  invName:      { fontSize:17, fontWeight:'800', color:C.t1, marginBottom:3, letterSpacing:-0.3 },
  invSub:       { fontSize:14, color:C.t3, marginBottom:8 },
  invPrice:     { fontSize:18, fontWeight:'900', color:C.t1, letterSpacing:-0.5 },

  // 마진
  mgWrap:       { marginHorizontal:16, backgroundColor:C.white, borderRadius:16, padding:16 },
  mgTabs:       { flexDirection:'row', backgroundColor:C.bg2, borderRadius:12, padding:3, gap:3, marginBottom:14 },
  mgTab:        { flex:1, paddingVertical:10, alignItems:'center', borderRadius:10 },
  mgTabOn:      { backgroundColor:C.white },
  mgTabTxt:     { fontSize:15, fontWeight:'700', color:C.t3 },
  mgTabTxtOn:   { color:C.t1 },
  mgRow:        { flexDirection:'row', alignItems:'center', gap:11 },
  mgRank:       { width:30, height:30, borderRadius:9, alignItems:'center', justifyContent:'center' },
  mgRankTxt:    { fontSize:13, fontWeight:'800' },
  mgName:       { fontSize:15, fontWeight:'600', color:C.t1, width:75 },
  mgBarWrap:    { flex:1 },
  mgBarBg:      { height:5, backgroundColor:C.bg3, borderRadius:10, overflow:'hidden' },
  mgBarFill:    { height:5, borderRadius:10 },
  mgPct:        { fontSize:20, fontWeight:'900', minWidth:42, textAlign:'right', letterSpacing:-0.5 },

  // 빠른 실행
  quickGrid:    { paddingHorizontal:16, paddingBottom:10, flexDirection:'row', flexWrap:'wrap', gap:10 },
  quickBtn:     { width:'30.5%', backgroundColor:C.white, borderRadius:16, paddingVertical:18, paddingHorizontal:8, alignItems:'center', gap:10, overflow:'hidden' },
  quickBtnMain: { backgroundColor:C.t1 },
  quickBadge:   { position:'absolute', top:7, right:7, backgroundColor:C.red, paddingHorizontal:7, paddingVertical:3, borderRadius:6 },
  quickIcon:    { width:46, height:46, borderRadius:14, backgroundColor:C.bg2, alignItems:'center', justifyContent:'center' },
  quickIconMain:{ backgroundColor:'rgba(255,255,255,0.12)' },
  quickLabel:   { fontSize:14, fontWeight:'700', color:C.t2, textAlign:'center', lineHeight:18 },
  quickLabelMain:{ color:'rgba(255,255,255,0.85)' },

  // 빈 재고
  emptyBox:     { marginHorizontal:16, backgroundColor:C.white, borderRadius:16, padding:30, alignItems:'center' },
});
