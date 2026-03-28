import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Modal, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn, OutlineBtn } from '../components/UI';

const SPECIES = ['한우', '육우', '한돈', '수입우', '닭', '오리'];
const ROLES = ['사장', '직원'];

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

// 사업자번호 자동 하이픈 포맷 (000-00-00000)
function formatBizNo(raw) {
  const n = raw.replace(/\D/g, '').slice(0, 10);
  if (n.length <= 3) return n;
  if (n.length <= 5) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
}

export default function OnboardingScreen({ onDone }) {
  // mode: 'select' | 'owner' | 'employee'
  const [mode, setMode] = useState('select');

  // ── 사장 플로우 ──
  const [step, setStep] = useState(1);
  const [biz, setBiz] = useState({ bizNo: '', bizName: '', owner: '', bizType: '개인사업자', addrSi: '', addrGu: '', addrDong: '' });
  const [bizNoError, setBizNoError] = useState('');
  const [species, setSpecies] = useState([]);
  const [staff, setStaff] = useState([{ name: '', role: '사장', pin: '' }]);

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
  const nextStep = () => {
    if (step === 1) {
      if (!biz.bizName || !biz.owner) {
        Alert.alert('입력 오류', '상호명과 대표자명을 입력해주세요.');
        return;
      }
      const bizNumRaw = biz.bizNo.replace(/-/g, '');
      if (bizNumRaw.length === 10 && !validateBizNo(biz.bizNo)) {
        Alert.alert('사업자번호 오류', '유효하지 않은 사업자등록번호입니다.\n번호를 확인해주세요.');
        return;
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
    const bizPrefix = biz.bizNo.replace(/-/g, '').slice(0, 3);
    const invitePin = bizPrefix + String(Math.floor(1000 + Math.random() * 9000));
    try {
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');
      await AsyncStorage.setItem('@meatbig_biz', JSON.stringify({ ...biz, species }));
      await AsyncStorage.setItem('@meatbig_staff', JSON.stringify(valid));
      await AsyncStorage.setItem('@meatbig_invite_pin', invitePin);
      Alert.alert(
        '직원 초대 코드 📋',
        `직원이 앱에 가입할 때 사용하는 코드:\n\n🔑 ${invitePin}\n\n이 코드를 직원에게 알려주세요.\n(설정 → 직원 관리에서 다시 확인 가능)`,
        [{ text: '확인', onPress: () => onDone({ biz: { ...biz, species }, staff: valid, currentUser: valid[0] }) }]
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
      const storedPin = await AsyncStorage.getItem('@meatbig_invite_pin');
      const storedBiz = await AsyncStorage.getItem('@meatbig_biz');

      if (!storedPin || !storedBiz) {
        Alert.alert('가입 불가', '해당 사업장이 아직 앱을 등록하지 않았습니다.\n사장님께 먼저 앱 등록을 요청하세요.');
        return;
      }
      const bizData = JSON.parse(storedBiz);
      const inputBizNo = empBizNo.replace(/-/g, '');
      const storedBizNo = bizData.bizNo.replace(/-/g, '');

      if (inputBizNo !== storedBizNo) {
        Alert.alert('인증 실패', '사업자번호가 일치하지 않습니다.');
        return;
      }
      if (empPin.trim() !== storedPin) {
        Alert.alert('인증 실패', '초대 코드가 올바르지 않습니다.\n사장님께 코드를 다시 확인하세요.');
        return;
      }

      const storedStaff = await AsyncStorage.getItem('@meatbig_staff');
      const staffList = storedStaff ? JSON.parse(storedStaff) : [];
      const newEmployee = { name: empName, role: '직원', pin: '', id: Date.now().toString() };
      await AsyncStorage.setItem('@meatbig_staff', JSON.stringify([...staffList, newEmployee]));
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');

      onDone({ biz: bizData, staff: [...staffList, newEmployee], currentUser: newEmployee });
    } catch {
      Alert.alert('오류', '가입 중 오류가 발생했습니다.');
    }
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
        <View style={styles.selectWrap}>
          <Text style={styles.selectTitle}>MeatBig에{'\n'}오신 것을 환영합니다 🥩</Text>
          <Text style={styles.selectSub}>사장님이신가요, 직원이신가요?</Text>

          <TouchableOpacity style={styles.roleCard} onPress={() => setMode('owner')} activeOpacity={0.85}>
            <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>👨‍🍳</Text>
            <Text style={styles.roleCardTitle}>사장님으로 시작</Text>
            <Text style={styles.roleCardDesc}>사업장 정보를 등록하고{'\n'}처음 시작합니다</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.roleCard, { borderColor: colors.a2, backgroundColor: colors.a2 + '12' }]}
            onPress={() => setMode('employee')} activeOpacity={0.85}>
            <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>👷</Text>
            <Text style={[styles.roleCardTitle, { color: colors.a2 }]}>직원으로 참여</Text>
            <Text style={styles.roleCardDesc}>사장님에게 받은 초대 코드로{'\n'}참여합니다</Text>
          </TouchableOpacity>
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
              ) : biz.bizNo.replace(/-/g, '').length === 10 ? (
                <Text style={styles.validText}>✓ 유효한 사업자번호입니다</Text>
              ) : null}
              <Text style={styles.hintText}>※ 입력 시 국세청 알고리즘으로 자동 검증됩니다</Text>
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
                    <Text style={styles.speciesEmoji}>
                      {s === '한우' || s === '육우' || s === '수입우' ? '🐄' : s === '한돈' ? '🐷' : s === '닭' ? '🐔' : '🦆'}
                    </Text>
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
          label={step === totalSteps ? '시작하기 🚀' : '다음 →'}
          onPress={nextStep}
          style={{ flex: 2 }}
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

  // 역할 선택 화면
  selectWrap: { flex: 1, padding: spacing.lg, paddingTop: 80, justifyContent: 'center' },
  selectTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.tx, lineHeight: 44, marginBottom: spacing.sm },
  selectSub: { fontSize: fontSize.md, color: colors.t2, marginBottom: spacing.xl },
  roleCard: {
    backgroundColor: colors.s1, borderRadius: radius.lg, borderWidth: 2,
    borderColor: colors.ac, padding: spacing.xl, alignItems: 'center',
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
