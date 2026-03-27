import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, shadow, fontSize, spacing } from '../theme';

const DOC_TYPES = [
  { key: '도축 검사증명서', icon: '🏭' },
  { key: '거래명세서',      icon: '📄' },
  { key: '이력확인서',      icon: '🔍' },
  { key: '보건증',          icon: '🏥' },
  { key: '위생교육 이수증', icon: '📚' },
  { key: '기타',            icon: '📋' },
];

const SCHEMAS = {
  '도축 검사증명서': ['이력번호', '도축일', '등급', '부위', '원산지', '중량(kg)', '도축장명', '검사관'],
  '거래명세서':      ['공급업체', '거래일', '이력번호', '부위', '원산지', '중량(kg)', '금액', '매입처'],
  '보건증':          ['성명', '생년월일', '발급일', '만료일', '발급기관', '검사결과'],
  '위생교육 이수증': ['성명', '교육명', '이수일', '유효기한', '발급기관', '이수시간'],
  '이력확인서':      ['이력번호', '개체번호', '출생일', '품종', '도축일', '등급'],
  '기타':            ['서류명', '날짜', '발급기관', '비고'],
};

const DEMO_DATA = {
  '도축 검사증명서': { '이력번호': 'HN-2603-0301', '도축일': '2026.03.24', '등급': '1+', '부위': '채끝', '원산지': '국내산(한우)', '중량(kg)': '11.5', '도축장명': '부경양돈농협', '검사관': '김검사' },
  '보건증':          { '성명': '홍길동', '생년월일': '1985.03.15', '발급일': '2026.03.24', '만료일': '2027.03.24', '발급기관': '김해시보건소', '검사결과': '이상없음' },
  '위생교육 이수증': { '성명': '홍길동', '교육명': '식육위생교육', '이수일': '2026.03.24', '유효기한': '2027.03.24', '발급기관': '한국식품안전관리인증원', '이수시간': '8시간' },
};

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
const HAS_API_KEY = API_KEY.length > 10;

export default function UploadScreen() {
  const [docType, setDocType] = useState('도축 검사증명서');
  const [image, setImage]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [isDemo, setIsDemo]   = useState(false);

  const pickImage = async (useCamera) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('권한 필요', '카메라/갤러리 접근 권한이 필요합니다.');
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.9 });
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0]);
      setResult(null);
      setIsDemo(false);
    }
  };

  const runOCR = async () => {
    if (!image) return;
    setLoading(true);

    if (!HAS_API_KEY) {
      // 데모 모드
      await new Promise(r => setTimeout(r, 1200));
      setResult(DEMO_DATA[docType] || { '서류명': docType, '날짜': '2026.03.26' });
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const schema = SCHEMAS[docType] || SCHEMAS['기타'];
    const prompt = `당신은 한국 축산물 관련 문서 분석 전문가입니다.\n이미지는 "${docType}" 문서입니다.\n다음 항목들을 추출하여 JSON으로만 반환하세요 (다른 텍스트 없이):\n${schema.map(k => `- ${k}`).join('\n')}\n없는 값은 "" 으로, 날짜는 YYYY.MM.DD 형식으로.`;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.base64 } },
            { type: 'text', text: prompt },
          ]}],
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.content?.[0]?.text || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      setResult(JSON.parse(match ? match[0] : '{}'));
      setIsDemo(false);
    } catch (e) {
      Alert.alert('AI 오류', e.message || 'AI 분석에 실패했습니다. 다시 시도해주세요.');
    }
    setLoading(false);
  };

  const handleSave = () => {
    setResult(null);
    setImage(null);
    Alert.alert('저장 완료', `${docType}이(가) 저장되었습니다.`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>

      {/* API 키 상태 배너 */}
      {!HAS_API_KEY && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.demoBannerTitle}>데모 모드</Text>
            <Text style={styles.demoBannerSub}>.env.local 에 EXPO_PUBLIC_ANTHROPIC_API_KEY 설정 시 실제 AI 분석 가능</Text>
          </View>
        </View>
      )}

      {/* 문서 종류 */}
      <Text style={styles.sectionTitle}>📂 문서 종류</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
        {DOC_TYPES.map(dt => (
          <TouchableOpacity
            key={dt.key}
            style={[styles.typeBtn, docType === dt.key && styles.typeBtnActive]}
            onPress={() => { setDocType(dt.key); setImage(null); setResult(null); }}>
            <Text style={styles.typeIcon}>{dt.icon}</Text>
            <Text style={[styles.typeLabel, docType === dt.key && styles.typeLabelActive]}>{dt.key}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 업로드 영역 */}
      <View style={styles.uploadZone}>
        {image ? (
          <>
            <Image source={{ uri: image.uri }} style={styles.preview} />
            <TouchableOpacity onPress={() => { setImage(null); setResult(null); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕ 다시 선택</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ alignItems: 'center', padding: spacing.lg }}>
            <Text style={{ fontSize: 52, marginBottom: spacing.md }}>📄</Text>
            <Text style={styles.uploadTitle}>서류 사진을 올려주세요</Text>
            <Text style={styles.uploadSub}>카메라 촬영 또는 갤러리에서 선택</Text>
          </View>
        )}
      </View>

      {/* 버튼들 */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: colors.a2 }]} onPress={() => pickImage(true)}>
          <Text style={styles.imgBtnIcon}>📷</Text>
          <Text style={styles.imgBtnText}>카메라</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: colors.s1, borderWidth: 1.5, borderColor: colors.bd }]} onPress={() => pickImage(false)}>
          <Text style={styles.imgBtnIcon}>🖼️</Text>
          <Text style={[styles.imgBtnText, { color: colors.t2 }]}>갤러리</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.ocrBtn, (!image || loading) && { opacity: 0.4 }]}
        onPress={runOCR}
        disabled={!image || loading}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.ocrBtnText}>AI 분석 중...</Text>
          </View>
        ) : (
          <Text style={styles.ocrBtnText}>{HAS_API_KEY ? '✨ AI 자동 분석' : '🔍 데모로 확인'}</Text>
        )}
      </TouchableOpacity>

      {/* 결과 */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>✅ 인식 결과</Text>
            <View style={[styles.modeBadge, isDemo && { backgroundColor: '#fef9c3', borderColor: '#fde68a' }]}>
              <Text style={[styles.modeBadgeText, isDemo && { color: colors.yw }]}>
                {isDemo ? '📋 데모' : '✨ AI'}
              </Text>
            </View>
          </View>
          {isDemo && (
            <View style={styles.demoNotice}>
              <Text style={styles.demoNoticeText}>⚠️ 데모 데이터입니다. 실제 문서 내용이 아닙니다.</Text>
            </View>
          )}
          {Object.entries(result).map(([key, value]) =>
            value ? (
              <View key={key} style={styles.resultRow}>
                <Text style={styles.resultKey}>{key}</Text>
                <Text style={styles.resultVal}>{value}</Text>
              </View>
            ) : null
          )}
          <View style={styles.resultBtns}>
            <TouchableOpacity style={[styles.saveBtn, isDemo && { backgroundColor: colors.t3 }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{isDemo ? '📋 샘플 저장' : '💾 저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setResult(null)}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 촬영 가이드 */}
      {!image && !result && (
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>📖 촬영 가이드</Text>
          {[
            { icon: '🔆', title: '밝은 곳에서 촬영', sub: '직사광선 반사 주의, 형광등 아래 권장' },
            { icon: '📐', title: '문서 전체가 보이게', sub: '모서리 4개가 화면 안에 들어오게' },
            { icon: '🔍', title: '글자가 선명하게', sub: '흔들리지 않게 고정 후 촬영' },
          ].map(g => (
            <View key={g.title} style={styles.guideRow}>
              <Text style={styles.guideIcon}>{g.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideRowTitle}>{g.title}</Text>
                <Text style={styles.guideRowSub}>{g.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  demoBannerIcon: { fontSize: 20 },
  demoBannerTitle: { fontSize: fontSize.sm, fontWeight: '800', color: '#92400e', marginBottom: 2 },
  demoBannerSub: { fontSize: fontSize.xs, color: '#b45309', lineHeight: 18 },

  sectionTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: spacing.sm },

  typeBtn: {
    alignItems: 'center', backgroundColor: colors.s1, borderWidth: 1.5, borderColor: colors.bd,
    borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, ...shadow.sm, minWidth: 80,
  },
  typeBtnActive: { borderColor: colors.a2, backgroundColor: '#eff6ff' },
  typeIcon: { fontSize: 24, marginBottom: 5 },
  typeLabel: { fontSize: fontSize.xs, color: colors.t2, fontWeight: '600', textAlign: 'center' },
  typeLabelActive: { color: colors.a2, fontWeight: '800' },

  uploadZone: {
    borderWidth: 2, borderColor: colors.bd2, borderStyle: 'dashed',
    borderRadius: radius.lg, backgroundColor: colors.s1, marginBottom: spacing.md,
    minHeight: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  preview: { width: '100%', height: 220, resizeMode: 'contain' },
  clearBtn: { padding: spacing.sm, alignSelf: 'center', marginBottom: spacing.sm },
  clearBtnText: { fontSize: fontSize.sm, color: colors.rd, fontWeight: '700' },
  uploadTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: 6 },
  uploadSub: { fontSize: fontSize.xs, color: colors.t3 },

  btnRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  imgBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', gap: 4 },
  imgBtnIcon: { fontSize: 22 },
  imgBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },

  ocrBtn: {
    backgroundColor: colors.pu, paddingVertical: 16, borderRadius: radius.md,
    alignItems: 'center', marginBottom: spacing.md, ...shadow.sm,
  },
  ocrBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900', letterSpacing: 0.3 },

  resultCard: {
    backgroundColor: colors.s1, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.bd, overflow: 'hidden', ...shadow.md, marginBottom: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.bd, backgroundColor: colors.bg,
  },
  resultTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  modeBadge: {
    backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  modeBadgeText: { fontSize: fontSize.xs, color: colors.pu, fontWeight: '800' },
  demoNotice: {
    backgroundColor: '#fffbeb', padding: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  demoNoticeText: { fontSize: fontSize.xs, color: '#92400e', fontWeight: '600' },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.bd + '50',
  },
  resultKey: { fontSize: fontSize.sm, color: colors.t3, width: 130, fontWeight: '600' },
  resultVal: { fontSize: fontSize.sm, color: colors.tx, flex: 1, fontWeight: '700' },
  resultBtns: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  saveBtn: {
    flex: 1, backgroundColor: colors.gn, paddingVertical: 13,
    borderRadius: radius.md, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.bd,
    paddingVertical: 13, borderRadius: radius.md, alignItems: 'center',
  },
  cancelBtnText: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },

  guideCard: {
    backgroundColor: colors.s1, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.bd, padding: spacing.md, ...shadow.sm, marginTop: spacing.sm,
  },
  guideTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: spacing.md },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: spacing.md },
  guideIcon: { fontSize: 24, marginTop: 2 },
  guideRowTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx, marginBottom: 3 },
  guideRowSub: { fontSize: fontSize.xs, color: colors.t3, lineHeight: 19 },
});
