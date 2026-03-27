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

export default function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(1);
  const [biz, setBiz] = useState({ bizNo: '', bizName: '', owner: '' });
  const [species, setSpecies] = useState([]);
  const [staff, setStaff] = useState([{ name: '', role: '사장', pin: '' }]);

  const totalSteps = 3;

  const nextStep = () => {
    if (step === 1) {
      if (!biz.bizName || !biz.owner) {
        Alert.alert('입력 오류', '상호명과 대표자명을 입력해주세요.');
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
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    const valid = staff.filter(s => s.name && s.pin.length >= 4);
    if (valid.length === 0) {
      Alert.alert('직원 등록', '사장님 계정을 최소 1명 등록해주세요.\n이름과 PIN(4자리 이상) 필수.');
      return;
    }
    try {
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');
      await AsyncStorage.setItem('@meatbig_biz', JSON.stringify({ ...biz, species }));
      await AsyncStorage.setItem('@meatbig_staff', JSON.stringify(valid));
      onDone({ biz: { ...biz, species }, staff: valid, currentUser: valid[0] });
    } catch (e) {
      Alert.alert('저장 오류', '다시 시도해주세요.');
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

  return (
    <View style={styles.container}>
      {/* 상단 진행바 */}
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
            <FieldInput label="사업자등록번호" placeholder="000-00-00000" value={biz.bizNo}
              onChangeText={t => setBiz({ ...biz, bizNo: t })} keyboardType="numeric" />
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

        {/* STEP 3: 직원 등록 */}
        {step === 3 && (
          <View>
            <Text style={styles.stepLabel}>STEP 3 / 3</Text>
            <Text style={styles.stepTitle}>직원을{'\n'}등록해주세요</Text>

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

            <TouchableOpacity style={styles.addStaffBtn} onPress={() => setStaff([...staff, { name: '', role: '직원', pin: '' }])}>
              <Text style={styles.addStaffText}>+ 직원 추가</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        {step > 1 && (
          <OutlineBtn label="이전" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
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

  progressWrap: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
    transition: 'flex 0.3s',
  },

  stepLabel: { fontSize: fontSize.xs, color: colors.t3, fontWeight: '700', marginBottom: 8, letterSpacing: 2 },
  stepTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.tx, lineHeight: 44, marginBottom: 6 },
  stepSub: { fontSize: fontSize.sm, color: colors.t2, marginBottom: spacing.lg },

  fieldLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: colors.s1,
    borderWidth: 1.5,
    borderColor: colors.bd,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    fontSize: fontSize.md,
    color: colors.tx,
    minHeight: 56,
  },

  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  speciesBtn: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.bd,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  speciesBtnActive: { borderColor: colors.ac, backgroundColor: colors.ac + '20' },
  speciesEmoji: { fontSize: 32, marginBottom: 6 },
  speciesLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },
  speciesLabelActive: { color: colors.ac },

  staffForm: {
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bd,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  staffIdx: { fontSize: fontSize.xs, color: colors.ac, fontWeight: '800', marginBottom: spacing.sm },

  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.bd, alignItems: 'center' },
  roleBtnActive: { borderColor: colors.ac, backgroundColor: colors.ac },
  roleBtnText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },
  roleBtnTextActive: { color: '#fff' },

  addStaffBtn: {
    borderWidth: 2,
    borderColor: colors.bd,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addStaffText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.bd,
    backgroundColor: colors.bg,
  },
});
