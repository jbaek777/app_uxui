import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Modal, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { supabase } from '../lib/supabase';

const SPECIES = ['한우', '육우', '한돈', '수입우', '닭', '오리'];
const ROLES = ['사장', '직원'];

// 축종별 아웃라인 아이콘 매핑 (MaterialCommunityIcons 는 기본 라인 스타일)
const SPECIES_ICON = {
  '한우':   'cow',
  '육우':   'cow',
  '수입우': 'cow',
  '한돈':   'pig-variant',
  '닭':     'food-drumstick-outline',
  '오리':   'duck',
};

// ── 전국 시/도 → 구/군 데이터 ──────────────────────────────
const ADDR_DATA = {
  '서울특별시': ['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'],
  '부산광역시': ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'],
  '대구광역시': ['중구','동구','서구','남구','북구','수성구','달서구','달성군','군위군'],
  '인천광역시': ['중구','동구','미추홀구','연수구','남동구','부평구','계양구','서구','강화군','옹진군'],
  '광주광역시': ['동구','서구','남구','북구','광산구'],
  '대전광역시': ['동구','중구','서구','유성구','대덕구'],
  '울산광역시': ['중구','남구','동구','북구','울주군'],
  '세종특별자치시': ['세종시'],
  '경기도': ['수원시','성남시','의정부시','안양시','부천시','광명시','평택시','동두천시','안산시','고양시','과천시','구리시','남양주시','오산시','시흥시','군포시','의왕시','하남시','용인시','파주시','이천시','안성시','김포시','화성시','광주시','양주시','포천시','여주시','연천군','가평군','양평군'],
  '강원특별자치도': ['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군','평창군','정선군','철원군','화천군','양구군','인제군','고성군','양양군'],
  '충청북도': ['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'],
  '충청남도': ['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군'],
  '전북특별자치도': ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'],
  '전라남도': ['목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군','화순군','장흥군','강진군','해남군','영암군','무안군','함평군','영광군','장성군','완도군','진도군','신안군'],
  '경상북도': ['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시','의성군','청송군','영양군','영덕군','청도군','고령군','성주군','칠곡군','예천군','봉화군','울진군','울릉군'],
  '경상남도': ['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군','창녕군','고성군','남해군','하동군','산청군','함양군','거창군','합천군'],
  '제주특별자치도': ['제주시','서귀포시'],
};

// ── 사업자번호 체크섬 검증 (국세청 표준 알고리즘) ──────────
function validateBizNo(bizNo) {
  const n = bizNo.replace(/-/g, '').trim();
  if (!/^\d{10}$/.test(n)) return false;
  const d = n.split('').map(Number);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += d[i] * w[i];
  sum += Math.floor((d[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === d[9];
}

// ── 국세청 사업자등록 실시간 상태 조회 ─────────────────────
// 공공데이터포털 API: https://api.odcloud.kr/api/nts-businessman/v1/status
async function checkBizStatus(bizNo) {
  const raw = bizNo.replace(/-/g, '').trim();
  const apiKey = process.env.EXPO_PUBLIC_MTRACE_API_KEY;
  if (!apiKey) return { ok: true, status: '조회 불가(키 없음)', taxType: '' };
  try {
    const res = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ b_no: [raw] }),
      }
    );
    if (!res.ok) return { ok: true, status: '조회 실패', taxType: '' }; // 네트워크 오류 시 통과
    const json = await res.json();
    const item = json?.data?.[0];
    if (!item) return { ok: true, status: '조회 불가', taxType: '' };
    const isActive = item.b_stt_cd === '01'; // 01: 계속사업자, 02: 휴업, 03: 폐업
    return {
      ok: isActive,
      status: item.b_stt || '알 수 없음',
      taxType: item.tax_type || '',
      endDt: item.end_dt || '',
    };
  } catch (_) {
    return { ok: true, status: '조회 실패', taxType: '' }; // 오프라인 등 예외 시 통과
  }
}

// 사업자번호 자동 하이픈 포맷 (000-00-00000)
function formatBizNo(raw) {
  const n = raw.replace(/\D/g, '').slice(0, 10);
  if (n.length <= 3) return n;
  if (n.length <= 5) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
}

export default function OnboardingScreen({ onDone }) {
  // mode: 'select' | 'owner' | 'employee' | 'jobseeker'
  const [mode, setMode] = useState('select');

  // ── 사장 플로우 ──
  const [step, setStep] = useState(1);
  const [biz, setBiz] = useState({ bizNo: '', bizName: '', owner: '', bizType: '개인사업자', addrSi: '', addrGu: '', addrDong: '' });
  const [bizNoError, setBizNoError] = useState('');
  const [bizChecking, setBizChecking] = useState(false); // API 조회 중
  const [species, setSpecies] = useState([]);
  const [staff, setStaff] = useState([{ name: '', role: '사장', pin: '' }]);

  // ── 구직자 플로우 (무소속) ──
  const [jsName, setJsName] = useState('');
  const [jsPhone, setJsPhone] = useState('');
  const [jsYears, setJsYears] = useState('');
  const [jsSubmitting, setJsSubmitting] = useState(false);

  // ── 주소 피커 ──
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState('si'); // 'si' | 'gu'

  const openPicker = (type) => {
    if (type === 'gu' && !biz.addrSi) return;
    setPickerType(type);
    setPickerVisible(true);
  };
  const selectAddr = (value) => {
    if (pickerType === 'si') {
      setBiz({ ...biz, addrSi: value, addrGu: '' });
    } else {
      setBiz({ ...biz, addrGu: value });
    }
    setPickerVisible(false);
  };

  // ── 직원 플로우 ──
  const [empBizNo, setEmpBizNo] = useState('');
  const [empPin, setEmpPin] = useState('');
  const [empName, setEmpName] = useState('');

  const totalSteps = 3;

  // ─── 사업자번호 입력 핸들러 ──────────────────────────────
  const handleBizNoChange = (text) => {
    const formatted = formatBizNo(text);
    setBiz({ ...biz, bizNo: formatted });
    if (formatted.replace(/-/g, '').length === 10) {
      if (!validateBizNo(formatted)) {
        setBizNoError('유효하지 않은 사업자등록번호입니다.');
      } else {
        setBizNoError('');
      }
    } else {
      setBizNoError('');
    }
  };

  // ─── 사장 다음 스텝 ──────────────────────────────────────
  const nextStep = async () => {
    if (step === 1) {
      if (!biz.bizName || !biz.owner) {
        Alert.alert('입력 오류', '상호명과 대표자명을 입력해주세요.');
        return;
      }
      const bizNumRaw = biz.bizNo.replace(/-/g, '');
      if (bizNumRaw.length === 10) {
        // 1단계: 체크섬 형식 검증
        if (!validateBizNo(biz.bizNo)) {
          Alert.alert('사업자번호 오류', '유효하지 않은 사업자등록번호입니다.\n번호를 확인해주세요.');
          return;
        }
        // 2단계: 국세청 실시간 상태 조회
        setBizChecking(true);
        const result = await checkBizStatus(bizNumRaw);
        setBizChecking(false);
        if (!result.ok) {
          const detail = result.endDt ? `\n폐업일: ${result.endDt}` : '';
          Alert.alert(
            '사업자 조회 실패',
            `해당 사업자번호는 "${result.status}" 상태입니다.${detail}\n\n사업자번호를 다시 확인해주세요.`
          );
          setBizNoError(`사업자 상태: ${result.status}`);
          return;
        }
        // 조회 성공 시 상태 텍스트로 안내
        if (result.taxType) {
          setBizNoError(''); // 에러 없음
        }
      }
    }
    if (step === 2 && species.length === 0) {
      Alert.alert('선택 오류', '취급 축종을 하나 이상 선택해주세요.');
      return;
    }
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      finishOwnerOnboarding();
    }
  };

  // ─── 사장 온보딩 완료 ────────────────────────────────────
  const finishOwnerOnboarding = async () => {
    const valid = staff.filter(s => s.name && s.pin.length >= 4);
    if (valid.length === 0) {
      Alert.alert('계정 등록 필요', '사장님 이름과 PIN(4자리 이상)을 입력해주세요.');
      return;
    }
    // 직원 초대 코드 생성 (사업자번호 앞 3자리 + 4자리 랜덤)
    const bizPrefix = biz.bizNo.replace(/-/g, '').slice(0, 3) || '000';
    const invitePin = bizPrefix + String(Math.floor(1000 + Math.random() * 9000));
    const bizFull = { ...biz, species };
    try {
      // 1) 로컬 저장
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');
      await AsyncStorage.setItem('@meatbig_biz', JSON.stringify(bizFull));
      await AsyncStorage.setItem('@meatbig_staff', JSON.stringify(valid));
      await AsyncStorage.setItem('@meatbig_invite_pin', invitePin);

      // 2) 현재 사용자 확인 → auth_uid 자동 연결 (RLS 핵심)
      const { data: { user } } = await supabase.auth.getUser();
      const ownerAuthUid = user?.id || null;

      // 3) Supabase stores 테이블 저장 (auth_uid로 소유권 명시)
      const { data: storeRow, error: storeErr } = await supabase
        .from('stores')
        .upsert({
          store_id:   biz.bizNo.replace(/-/g, '') || `store_${Date.now()}`,
          store_name: biz.bizName,
          owner:      biz.owner,
          biz_no:     biz.bizNo,
          biz_type:   biz.bizType,
          region_si:  biz.addrSi,
          region_gu:  biz.addrGu,
          region_dong:biz.addrDong,
          species,
          invite_pin: invitePin,
          auth_uid:   ownerAuthUid,    // ⭐ 소유자 식별
        }, { onConflict: 'store_id' })
        .select()
        .single();

      // 4) store_members 저장 (사장 계정은 본인 auth_uid 연결, 나머지 직원은 null)
      if (!storeErr && storeRow) {
        await supabase.from('store_members').upsert(
          valid.map(s => ({
            store_id: storeRow.id,
            name:     s.name,
            role:     s.role,
            pin:      s.pin,
            // 사장 본인에게만 auth_uid 부여, 나머지 직원은 본인 로그인 시 연결
            auth_uid: s.role === '사장' ? ownerAuthUid : null,
          })),
          { onConflict: 'store_id, name' }
        );
        // ⭐ RLS 를 위한 store UUID 캐시 (child 테이블 insert 시 필수)
        await AsyncStorage.setItem('@meatbig_store_uuid', storeRow.id);
      }

      Alert.alert(
        '직원 초대 코드 📋',
        `직원이 앱에 가입할 때 사용하는 코드:\n\n🔑 ${invitePin}\n\n이 코드를 직원에게 알려주세요.\n(설정 → 직원 관리에서 다시 확인 가능)`,
        [{ text: '확인', onPress: () => onDone({ biz: bizFull, staff: valid, currentUser: valid[0] }) }]
      );
    } catch {
      Alert.alert('저장 오류', '다시 시도해주세요.');
    }
  };

  // ─── 직원 가입 ───────────────────────────────────────────
  const joinAsEmployee = async () => {
    if (!empName.trim()) { Alert.alert('입력 오류', '이름을 입력해주세요.'); return; }
    if (!empBizNo.trim()) { Alert.alert('입력 오류', '사업장 사업자번호를 입력해주세요.'); return; }
    if (!empPin.trim()) { Alert.alert('입력 오류', '초대 코드를 입력해주세요.'); return; }

    try {
      const inputBizNo = empBizNo.replace(/-/g, '');

      // Supabase에서 초대코드 + 사업자번호 검증
      const { data: storeRow, error } = await supabase
        .from('stores')
        .select('*')
        .eq('store_id', inputBizNo)
        .eq('invite_pin', empPin.trim())
        .maybeSingle();

      if (error || !storeRow) {
        // 로컬 폴백 (같은 기기인 경우)
        const storedPin = await AsyncStorage.getItem('@meatbig_invite_pin');
        const storedBiz = await AsyncStorage.getItem('@meatbig_biz');
        if (!storedPin || !storedBiz) {
          Alert.alert('인증 실패', '사업자번호 또는 초대 코드가 올바르지 않습니다.');
          return;
        }
        const bizData = JSON.parse(storedBiz);
        if (bizData.bizNo.replace(/-/g, '') !== inputBizNo || storedPin !== empPin.trim()) {
          Alert.alert('인증 실패', '사업자번호 또는 초대 코드가 올바르지 않습니다.');
          return;
        }
        // 로컬 인증 성공
        const storedStaff = await AsyncStorage.getItem('@meatbig_staff');
        const staffList = storedStaff ? JSON.parse(storedStaff) : [];
        const newEmployee = { name: empName.trim(), role: '직원', pin: '', id: Date.now().toString() };
        const updatedStaff = [...staffList, newEmployee];
        await AsyncStorage.setItem('@meatbig_staff', JSON.stringify(updatedStaff));
        await AsyncStorage.setItem('@meatbig_onboarded', 'true');
        onDone({ biz: bizData, staff: updatedStaff, currentUser: newEmployee });
        return;
      }

      // Supabase 인증 성공 → store_members에 추가 (auth_uid 연결)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberRow } = await supabase
        .from('store_members')
        .insert({
          store_id: storeRow.id,
          name:     empName.trim(),
          role:     '직원',
          pin:      '',
          auth_uid: user?.id || null,  // ⭐ 직원 계정 본인 연결
        })
        .select()
        .single();

      // 로컬에 가게 정보 캐시
      const bizData = {
        bizNo: storeRow.biz_no || storeRow.store_id,
        bizName: storeRow.store_name,
        owner: storeRow.owner,
        bizType: storeRow.biz_type,
        addrSi: storeRow.region_si,
        addrGu: storeRow.region_gu,
        addrDong: storeRow.region_dong,
        species: storeRow.species || [],
      };
      const newEmployee = { name: empName.trim(), role: '직원', pin: '', id: memberRow?.id || Date.now().toString() };
      const storedStaff = await AsyncStorage.getItem('@meatbig_staff');
      const staffList = storedStaff ? JSON.parse(storedStaff) : [];
      const updatedStaff = [...staffList, newEmployee];
      await AsyncStorage.setItem('@meatbig_biz', JSON.stringify(bizData));
      await AsyncStorage.setItem('@meatbig_staff', JSON.stringify(updatedStaff));
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');
      await AsyncStorage.setItem('@meatbig_invite_pin', storeRow.invite_pin);
      // ⭐ RLS 를 위한 store UUID 캐시 (child 테이블 insert 시 필수)
      if (storeRow?.id) {
        await AsyncStorage.setItem('@meatbig_store_uuid', storeRow.id);
      }

      onDone({ biz: bizData, staff: updatedStaff, currentUser: newEmployee });
    } catch (e) {
      Alert.alert('오류', '가입 중 오류가 발생했습니다.');
    }
  };

  // ─── 구직자(무소속) 가입 ─────────────────────────────────
  // 사업장 없이 이력만 관리 + 사장에게 헤드헌팅 받기.
  // 이름 + 연락처 + 경력연차만 받고 job_profiles 에 프로필 선생성.
  // 나머지 상세(자가역량평가·희망부위·자기소개)는 JobProfileEditor 에서 채움.
  const joinAsJobseeker = async () => {
    const name = jsName.trim();
    const phone = jsPhone.replace(/[^0-9]/g, '');
    const years = parseInt(jsYears, 10);

    if (!name) { Alert.alert('입력 오류', '이름을 입력해주세요.'); return; }
    if (phone.length < 10 || phone.length > 11) {
      Alert.alert('입력 오류', '올바른 휴대전화 번호를 입력해주세요.');
      return;
    }
    if (isNaN(years) || years < 0 || years > 60) {
      Alert.alert('입력 오류', '경력 연차는 0~60 사이 숫자로 입력해주세요.');
      return;
    }

    setJsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('로그인 필요', '세션이 만료되었습니다. 다시 로그인해주세요.');
        setJsSubmitting(false);
        return;
      }

      // 같은 사용자가 이미 프로필을 만들었으면 그것을 재사용(upsert)
      const { error: upsertErr } = await supabase
        .from('job_profiles')
        .upsert({
          auth_uid:     user.id,
          full_name:    name,
          phone,
          career_years: years,
          is_public:    false,       // JobProfileEditor 에서 공개 여부 결정
          phone_verified: false,     // PASS 연동 후 true
        }, { onConflict: 'auth_uid' });

      if (upsertErr) {
        // unique constraint 가 아직 안 걸려있으면 단순 insert 로 폴백
        const { error: insertErr } = await supabase
          .from('job_profiles')
          .insert({
            auth_uid:     user.id,
            full_name:    name,
            phone,
            career_years: years,
            is_public:    false,
            phone_verified: false,
          });
        if (insertErr && !(insertErr.code === '23505')) {
          Alert.alert('가입 실패', insertErr.message || '프로필 저장 중 오류');
          setJsSubmitting(false);
          return;
        }
      }

      // 로컬 플래그 — 사업장 없음 모드
      await AsyncStorage.multiSet([
        ['@meatbig_onboarded', 'true'],
        ['@meatbig_role', 'jobseeker'],
        ['@meatbig_jobseeker_name', name],
      ]);
      // 사업장 관련 캐시는 모두 비움
      await AsyncStorage.multiRemove([
        '@meatbig_biz', '@meatbig_staff', '@meatbig_invite_pin', '@meatbig_store_uuid',
      ]);

      onDone({ jobseeker: true, profile: { name, phone, years } });
    } catch (e) {
      Alert.alert('오류', e?.message || '가입 중 오류가 발생했습니다.');
    }
    setJsSubmitting(false);
  };

  const toggleSpecies = (s) => {
    setSpecies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const updateStaff = (idx, key, val) => {
    const next = [...staff];
    next[idx] = { ...next[idx], [key]: val };
    setStaff(next);
  };

  // ═══════════════════════════════════════════════════════
  // 역할 선택 화면
  // ═══════════════════════════════════════════════════════
  if (mode === 'select') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.selectWrap}>
          <Text style={styles.selectTitle}>MeatBig에{'\n'}오신 것을 환영합니다 🥩</Text>
          <Text style={styles.selectSub}>어떻게 시작하시겠어요?</Text>

          <TouchableOpacity style={styles.roleCard} onPress={() => setMode('owner')} activeOpacity={0.85}>
            <Text style={{ fontSize: 44, marginBottom: spacing.xs }}>👨‍🍳</Text>
            <Text style={styles.roleCardTitle}>사장님으로 시작</Text>
            <Text style={styles.roleCardDesc}>사업장 정보를 등록하고{'\n'}처음 시작합니다</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.roleCard, { borderColor: colors.a2, backgroundColor: colors.a2 + '12' }]}
            onPress={() => setMode('employee')} activeOpacity={0.85}>
            <Text style={{ fontSize: 44, marginBottom: spacing.xs }}>👷</Text>
            <Text style={[styles.roleCardTitle, { color: colors.a2 }]}>직원으로 참여</Text>
            <Text style={styles.roleCardDesc}>사장님에게 받은 초대 코드로{'\n'}참여합니다</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.roleCard, { borderColor: '#22c55e', backgroundColor: '#22c55e' + '12' }]}
            onPress={() => setMode('jobseeker')} activeOpacity={0.85}>
            <Text style={{ fontSize: 44, marginBottom: spacing.xs }}>🔍</Text>
            <Text style={[styles.roleCardTitle, { color: '#22c55e' }]}>구직자로 가입</Text>
            <Text style={styles.roleCardDesc}>사업장 없이 이력 관리 +{'\n'}사장님의 헤드헌팅 받기</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════
  // 구직자(무소속) 가입 화면
  // ═══════════════════════════════════════════════════════
  if (mode === 'jobseeker') {
    return (
      <View style={styles.container}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressDot, { backgroundColor: '#22c55e', flex: 3 }]} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          <Text style={styles.stepLabel}>구직자 가입</Text>
          <Text style={styles.stepTitle}>간단한 정보만{'\n'}입력하면 시작합니다</Text>
          <Text style={[styles.stepSub, { marginBottom: spacing.xl }]}>
            자세한 경력·희망 조건은 가입 후 프로필 편집에서 채울 수 있어요.
          </Text>

          <FieldInput label="이름 *" placeholder="홍길동"
            value={jsName} onChangeText={setJsName} />
          <FieldInput label="휴대전화 *" placeholder="01012345678"
            value={jsPhone} onChangeText={t => setJsPhone(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric" />
          <FieldInput label="경력 연차 *" placeholder="예: 3 (정육업계 경력, 년)"
            value={jsYears} onChangeText={t => setJsYears(t.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="numeric" />

          <View style={[styles.infoBox, { backgroundColor: '#22c55e' + '15', borderColor: '#22c55e' + '40' }]}>
            <Text style={[styles.infoBoxText, { color: '#166534' }]}>
              🔒 프로필은 처음엔 비공개예요.{'\n'}
              공개 여부와 자기소개는 JobProfileEditor 에서 직접 설정할 수 있습니다.
            </Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <OutlineBtn label="뒤로" onPress={() => setMode('select')} style={{ flex: 1 }} />
          <PrimaryBtn
            label={jsSubmitting ? '가입 중...' : '구직 시작하기 🚀'}
            onPress={joinAsJobseeker}
            color="#22c55e"
            disabled={jsSubmitting}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════
  // 직원 가입 화면
  // ═══════════════════════════════════════════════════════
  if (mode === 'employee') {
    return (
      <View style={styles.container}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressDot, { backgroundColor: colors.a2, flex: 3 }]} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          <Text style={styles.stepLabel}>직원 가입</Text>
          <Text style={styles.stepTitle}>사업장 정보와{'\n'}초대 코드를 입력하세요</Text>
          <Text style={[styles.stepSub, { marginBottom: spacing.xl }]}>사장님에게 초대 코드를 받으신 후 진행하세요</Text>

          <FieldInput label="이름 *" placeholder="홍길동" value={empName}
            onChangeText={setEmpName} />
          <FieldInput label="사업장 사업자번호 *" placeholder="000-00-00000"
            value={formatBizNo(empBizNo)}
            onChangeText={t => setEmpBizNo(t.replace(/-/g, ''))}
            keyboardType="numeric" />
          <FieldInput label="초대 코드 *" placeholder="사장님에게 받은 7자리 코드"
            value={empPin} onChangeText={setEmpPin} keyboardType="numeric" />

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>📋 초대 코드는 사장님 앱의 설정 → 직원 관리 화면에서 확인할 수 있습니다.</Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <OutlineBtn label="뒤로" onPress={() => setMode('select')} style={{ flex: 1 }} />
          <PrimaryBtn label="참여하기 🚀" onPress={joinAsEmployee} color={colors.a2} style={{ flex: 2 }} />
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════
  // 사장 온보딩 (3단계)
  // ═══════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* ── 주소 피커 모달 ── */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.s1, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '65%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.bd }}>
              <Text style={{ color: colors.tx, fontWeight: '900', fontSize: fontSize.lg }}>
                {pickerType === 'si' ? '📍 시/도 선택' : '📍 구/군 선택'}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={{ color: colors.t3, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerType === 'si' ? Object.keys(ADDR_DATA) : (ADDR_DATA[biz.addrSi] || [])}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const selected = pickerType === 'si' ? biz.addrSi === item : biz.addrGu === item;
                return (
                  <TouchableOpacity
                    style={{ paddingHorizontal: spacing.lg, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.bd + '40', backgroundColor: selected ? colors.ac + '18' : 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    onPress={() => selectAddr(item)}
                  >
                    <Text style={{ color: selected ? colors.ac : colors.tx, fontWeight: selected ? '800' : '500', fontSize: fontSize.md }}>
                      {item}
                    </Text>
                    {selected && <Text style={{ color: colors.ac, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <View style={styles.progressWrap}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.progressDot, {
            backgroundColor: i <= step ? colors.ac : colors.bd,
            flex: i === step ? 2 : 1,
          }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* STEP 1: 사업자 정보 */}
        {step === 1 && (
          <View>
            <Text style={styles.stepLabel}>STEP 1 / 3</Text>
            <Text style={styles.stepTitle}>사업장 정보를{'\n'}입력해주세요</Text>

            <FieldInput label="상호명 *" placeholder="예: ○○한우 직판점" value={biz.bizName}
              onChangeText={t => setBiz({ ...biz, bizName: t })} />
            <FieldInput label="대표자명 *" placeholder="예: 홍길동" value={biz.owner}
              onChangeText={t => setBiz({ ...biz, owner: t })} />

            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.fieldLabel}>사업자등록번호</Text>
              <TextInput
                style={[styles.input, bizNoError ? { borderColor: colors.rd } : {}]}
                placeholderTextColor={colors.t3}
                placeholder="000-00-00000"
                value={biz.bizNo}
                onChangeText={handleBizNoChange}
                keyboardType="numeric"
                maxLength={12}
              />
              {bizNoError ? (
                <Text style={styles.errorText}>⚠ {bizNoError}</Text>
              ) : bizChecking ? (
                <Text style={[styles.validText, { color: '#D97706' }]}>🔍 국세청 조회 중...</Text>
              ) : biz.bizNo.replace(/-/g, '').length === 10 ? (
                <Text style={styles.validText}>✓ 형식 검증 완료 (다음 버튼 시 실시간 조회)</Text>
              ) : null}
              <Text style={styles.hintText}>※ 다음 버튼 클릭 시 국세청 API로 실시간 사업자 상태를 조회합니다</Text>
            </View>

            <Text style={styles.fieldLabel}>사업자 유형</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
              {['개인사업자', '법인사업자'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.roleBtn, { flex: 1 }, biz.bizType === t && styles.roleBtnActive]}
                  onPress={() => setBiz({ ...biz, bizType: t })}
                >
                  <Text style={[styles.roleBtnText, biz.bizType === t && styles.roleBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>매장 주소</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              {/* 시/도 드롭다운 */}
              <TouchableOpacity
                style={[styles.input, styles.addrBtn]}
                onPress={() => openPicker('si')}
                activeOpacity={0.7}
              >
                <Text style={{ color: biz.addrSi ? colors.tx : colors.t3, fontSize: fontSize.sm, flex: 1 }}>
                  {biz.addrSi || '시/도'}
                </Text>
                <Text style={{ color: colors.t3 }}>▾</Text>
              </TouchableOpacity>
              {/* 구/군 드롭다운 */}
              <TouchableOpacity
                style={[styles.input, styles.addrBtn, !biz.addrSi && { opacity: 0.4 }]}
                onPress={() => openPicker('gu')}
                activeOpacity={0.7}
              >
                <Text style={{ color: biz.addrGu ? colors.tx : colors.t3, fontSize: fontSize.sm, flex: 1 }}>
                  {biz.addrGu || '구/군'}
                </Text>
                <Text style={{ color: colors.t3 }}>▾</Text>
              </TouchableOpacity>
            </View>
            {/* 동 직접입력 (선택) */}
            <TextInput
              style={[styles.input, { marginBottom: spacing.md }]}
              placeholder="동/읍/면 (선택)"
              placeholderTextColor={colors.t3}
              value={biz.addrDong}
              onChangeText={t => setBiz({ ...biz, addrDong: t })}
            />
          </View>
        )}

        {/* STEP 2: 축종 선택 */}
        {step === 2 && (
          <View>
            <Text style={styles.stepLabel}>STEP 2 / 3</Text>
            <Text style={styles.stepTitle}>취급하는 축종을{'\n'}선택하세요</Text>
            <Text style={styles.stepSub}>다중 선택 가능</Text>
            <View style={styles.speciesGrid}>
              {SPECIES.map(s => {
                const sel = species.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.speciesBtn, sel && styles.speciesBtnActive]}
                    onPress={() => toggleSpecies(s)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={SPECIES_ICON[s] || 'paw'}
                      size={40}
                      color={sel ? colors.ac : colors.t2}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={[styles.speciesLabel, sel && styles.speciesLabelActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 3: 직원/계정 등록 */}
        {step === 3 && (
          <View>
            <Text style={styles.stepLabel}>STEP 3 / 3</Text>
            <Text style={styles.stepTitle}>계정을{'\n'}등록해주세요</Text>

            {staff.map((s, idx) => (
              <View key={idx} style={styles.staffForm}>
                <Text style={styles.staffIdx}>{idx + 1}번</Text>
                <FieldInput label="이름" placeholder="홍길동" value={s.name}
                  onChangeText={t => updateStaff(idx, 'name', t)} />
                <Text style={styles.fieldLabel}>역할</Text>
                <View style={styles.roleRow}>
                  {ROLES.map(r => (
                    <TouchableOpacity key={r}
                      style={[styles.roleBtn, s.role === r && styles.roleBtnActive]}
                      onPress={() => updateStaff(idx, 'role', r)}>
                      <Text style={[styles.roleBtnText, s.role === r && styles.roleBtnTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <FieldInput label="PIN (4자리 이상)" placeholder="••••" value={s.pin}
                  onChangeText={t => updateStaff(idx, 'pin', t)} secureTextEntry keyboardType="numeric" />
              </View>
            ))}

            <TouchableOpacity style={styles.addStaffBtn}
              onPress={() => setStaff([...staff, { name: '', role: '직원', pin: '' }])}>
              <Text style={styles.addStaffText}>+ 직원 추가</Text>
            </TouchableOpacity>

            <View style={[styles.infoBox, { marginTop: spacing.md }]}>
              <Text style={styles.infoBoxText}>
                💡 완료 후 직원 초대 코드가 자동 생성됩니다.{'\n'}직원에게 코드를 공유해 팀원을 초대하세요.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {(step > 1 || mode === 'owner') && (
          <OutlineBtn
            label={step === 1 ? '뒤로' : '이전'}
            onPress={() => step === 1 ? setMode('select') : setStep(step - 1)}
            style={{ flex: 1 }}
          />
        )}
        <PrimaryBtn
          label={bizChecking ? '사업자 확인 중...' : step === totalSteps ? '시작하기 🚀' : '다음 →'}
          onPress={nextStep}
          style={{ flex: 2 }}
          disabled={bizChecking}
        />
      </View>
    </View>
  );
}

const FieldInput = ({ label, ...props }) => (
  <View style={{ marginBottom: spacing.md }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor={colors.t3} {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // 역할 선택 화면 — 3-way 카드 (ScrollView 용)
  selectWrap: { flexGrow: 1, padding: spacing.lg, paddingTop: 60, paddingBottom: 40, justifyContent: 'center' },
  selectTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.tx, lineHeight: 44, marginBottom: spacing.sm },
  selectSub: { fontSize: fontSize.md, color: colors.t2, marginBottom: spacing.lg },
  roleCard: {
    backgroundColor: colors.s1, borderRadius: radius.lg, borderWidth: 2,
    borderColor: colors.ac, padding: spacing.lg, alignItems: 'center',
    marginBottom: spacing.md, ...shadow.md,
  },
  roleCardTitle: { fontSize: fontSize.xl, fontWeight: '900', color: colors.ac, marginBottom: spacing.sm },
  roleCardDesc: { fontSize: fontSize.sm, color: colors.t2, textAlign: 'center', lineHeight: 22 },

  progressWrap: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md,
  },
  progressDot: { height: 6, borderRadius: 3 },

  stepLabel: { fontSize: fontSize.xs, color: colors.t3, fontWeight: '700', marginBottom: 8, letterSpacing: 2 },
  stepTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.tx, lineHeight: 44, marginBottom: 6 },
  stepSub: { fontSize: fontSize.sm, color: colors.t2, marginBottom: spacing.lg },

  fieldLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: colors.s1, borderWidth: 1.5, borderColor: colors.bd,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 16,
    fontSize: fontSize.md, color: colors.tx, minHeight: 56,
  },
  addrBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { fontSize: fontSize.xs, color: colors.rd, marginTop: 5, fontWeight: '700' },
  validText: { fontSize: fontSize.xs, color: colors.gn, marginTop: 5, fontWeight: '700' },
  hintText: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 4 },

  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  speciesBtn: {
    width: '30%', aspectRatio: 1, backgroundColor: colors.s1, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.bd, alignItems: 'center', justifyContent: 'center', ...shadow.sm,
  },
  speciesBtnActive: { borderColor: colors.ac, backgroundColor: colors.ac + '20' },
  speciesEmoji: { fontSize: 32, marginBottom: 6 },
  speciesLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },
  speciesLabelActive: { color: colors.ac },

  staffForm: {
    backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.md,
  },
  staffIdx: { fontSize: fontSize.xs, color: colors.ac, fontWeight: '800', marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.bd, alignItems: 'center' },
  roleBtnActive: { borderColor: colors.ac, backgroundColor: colors.ac },
  roleBtnText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },
  roleBtnTextActive: { color: '#fff' },
  addStaffBtn: {
    borderWidth: 2, borderColor: colors.bd, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: 18, alignItems: 'center', marginTop: spacing.sm,
  },
  addStaffText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },

  infoBox: {
    backgroundColor: colors.a2 + '15', borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.a2 + '40', padding: spacing.md,
  },
  infoBoxText: { fontSize: fontSize.xs, color: colors.a2, lineHeight: 20, fontWeight: '600' },

  footer: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: colors.bd, backgroundColor: colors.bg,
  },
});
