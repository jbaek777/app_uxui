import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn, OutlineBtn } from '../components/UI';

const SPECIES = ['한우', '육우', '한돈', '수입우', '닭', '오리'];
const ROLES = ['사장', '직원'];

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
  const [biz, setBiz] = useState({ bizNo: '', bizName: '', owner: '' });
  const [bizNoError, setBizNoError] = useState('');
  const [species, setSpecies] = useState([]);
  const [staff, setStaff] = useState([{ name: '', role: '사장', pin: '' }]);

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
