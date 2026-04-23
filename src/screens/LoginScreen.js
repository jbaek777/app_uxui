import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { colors, fontSize, spacing, radius } from '../theme';

export default function LoginScreen({ onDone }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode]       = useState('login'); // 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [pw2, setPw2]         = useState('');
  const [loading, setLoading] = useState(false);

  // 비밀번호 찾기 — 현재 입력된 이메일로 재설정 메일 발송
  const handleForgotPassword = () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      Alert.alert(
        '이메일 입력 필요',
        '가입하신 이메일을 먼저 입력한 후\n"비밀번호 찾기"를 눌러주세요.',
      );
      return;
    }
    Alert.alert(
      '비밀번호 재설정',
      `${emailTrim} 로\n재설정 링크를 보낼까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '보내기', style: 'default', onPress: async () => {
          setLoading(true);
          try {
            await resetPassword(emailTrim);
            Alert.alert(
              '📧 전송 완료',
              '메일함에서 재설정 링크를 클릭한 후\n새 비밀번호로 로그인해주세요.',
            );
          } catch (e) {
            Alert.alert('오류', e.message || '잠시 후 다시 시도해주세요.');
          }
          setLoading(false);
        }},
      ],
    );
  };

  const handleSubmit = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !pw) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      Alert.alert('이메일 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (pw.length < 6) {
      Alert.alert('비밀번호 오류', '비밀번호는 6자리 이상이어야 합니다.');
      return;
    }
    // 회원가입 시 강화 정책 (8자+문자+숫자) — 기존 로그인 계정 호환 유지
    if (mode === 'signup') {
      if (pw.length < 8) {
        Alert.alert('비밀번호 취약', '안전을 위해 비밀번호는 8자 이상을 권장합니다.');
        return;
      }
      if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
        Alert.alert('비밀번호 취약', '영문과 숫자를 함께 포함해주세요.');
        return;
      }
      // 흔한 비밀번호 차단
      const weak = ['12345678','password','qwerty123','meatbig123','test1234'];
      if (weak.includes(pw.toLowerCase())) {
        Alert.alert('비밀번호 취약', '추측하기 쉬운 비밀번호입니다. 다른 값으로 설정해주세요.');
        return;
      }
      if (pw !== pw2) {
        Alert.alert('비밀번호 불일치', '비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(emailTrim, pw);
        onDone('login');
      } else {
        // 회원가입 — Supabase Confirm email 이 켜져 있으면 session 은 null
        const { session } = await signUp(emailTrim, pw);
        if (!session) {
          // 이메일 인증 필요 → 로그인 탭으로 복귀하고 안내
          Alert.alert(
            '📧 이메일 인증 필요',
            `${emailTrim} 로 인증 메일을 보냈습니다.\n\n메일함에서 인증 링크를 클릭한 후 로그인해주세요.`,
            [{ text: '확인', onPress: () => {
              setMode('login');
              setPw('');
              setPw2('');
            }}],
          );
          setLoading(false);
          return;
        }
        // Confirm email 비활성 상태 — 바로 로그인 완료
        onDone('signup');
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Invalid login credentials'))
        Alert.alert('로그인 실패', '이메일 또는 비밀번호가 올바르지 않습니다.');
      else if (msg.includes('User already registered'))
        Alert.alert('이미 가입된 이메일', '해당 이메일로 이미 계정이 있습니다.\n로그인을 시도해주세요.');
      else if (msg.includes('Email not confirmed'))
        Alert.alert('이메일 인증 필요', '가입 시 발송된 이메일을 확인해주세요.\n인증 완료 후 다시 로그인해주세요.');
      else
        Alert.alert('오류', msg || '잠시 후 다시 시도해주세요.');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* 로고 */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🥩</Text>
          <Text style={styles.logoTitle}>MeatBig</Text>
          <Text style={styles.logoSub}>정육점 스마트 관리 솔루션</Text>
        </View>

        {/* 탭 토글 */}
        <View style={styles.toggleRow}>
          {['login', 'signup'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'login' ? '로그인' : '회원가입'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 입력 폼 */}
        <View style={styles.form}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            placeholderTextColor={colors.t3}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder={mode === 'signup' ? '8자 이상, 영문+숫자 포함' : '비밀번호'}
            placeholderTextColor={colors.t3}
            value={pw}
            onChangeText={setPw}
            secureTextEntry
          />

          {mode === 'signup' && (
            <>
              <Text style={styles.label}>비밀번호 확인</Text>
              <TextInput
                style={styles.input}
                placeholder="비밀번호 재입력"
                placeholderTextColor={colors.t3}
                value={pw2}
                onChangeText={setPw2}
                secureTextEntry
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>
                  {mode === 'login' ? '🔑 로그인' : '🚀 회원가입'}
                </Text>
            }
          </TouchableOpacity>

          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 하단 안내 */}
        <View style={styles.footer}>
          {mode === 'login' ? (
            <Text style={styles.footerText}>
              처음 사용하시나요?{' '}
              <Text style={styles.footerLink} onPress={() => setMode('signup')}>
                회원가입
              </Text>
            </Text>
          ) : (
            <Text style={styles.footerText}>
              이미 계정이 있으신가요?{' '}
              <Text style={styles.footerLink} onPress={() => setMode('login')}>
                로그인
              </Text>
            </Text>
          )}
        </View>

        <View style={[styles.infoBox]}>
          <Text style={styles.infoText}>
            {mode === 'signup'
              ? '📧 회원가입 후 이메일 인증 링크를\n클릭해야 로그인이 가능합니다.'
              : '🔒 계정을 만들면 기기를 바꿔도\n데이터가 자동으로 복원됩니다.\n\n💡 아이디는 가입 시 사용한 이메일입니다.'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, padding: spacing.lg, paddingTop: 80, paddingBottom: 40,
    backgroundColor: colors.bg,
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logoEmoji: { fontSize: 64, marginBottom: spacing.sm },
  logoTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.tx, marginBottom: 4 },
  logoSub: { fontSize: fontSize.sm, color: colors.t2 },

  toggleRow: {
    flexDirection: 'row', backgroundColor: colors.s1,
    borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.md,
  },
  toggleBtnActive: { backgroundColor: colors.ac },
  toggleText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.t2 },
  toggleTextActive: { color: '#fff', fontWeight: '900' },

  form: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.sm, color: colors.t2, fontWeight: '700',
    marginBottom: 7, marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.s1, borderWidth: 1.5, borderColor: colors.bd,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 16,
    fontSize: fontSize.md, color: colors.tx, minHeight: 56,
  },
  submitBtn: {
    backgroundColor: colors.ac, paddingVertical: 18,
    borderRadius: radius.lg, alignItems: 'center', marginTop: spacing.lg,
  },
  submitText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900', letterSpacing: 0.3 },

  forgotBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 4,
  },
  forgotText: {
    fontSize: fontSize.sm, color: colors.t2, fontWeight: '600',
    textDecorationLine: 'underline',
  },

  footer: { alignItems: 'center', marginBottom: spacing.lg },
  footerText: { fontSize: fontSize.sm, color: colors.t2 },
  footerLink: { color: colors.ac, fontWeight: '800' },

  infoBox: {
    backgroundColor: colors.a2 + '15', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.a2 + '40',
    padding: spacing.md, alignItems: 'center',
  },
  infoText: {
    fontSize: fontSize.xs, color: colors.a2, fontWeight: '600',
    lineHeight: 20, textAlign: 'center',
  },
});
