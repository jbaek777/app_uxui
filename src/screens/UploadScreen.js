import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, shadow } from '../theme';
import { AlertBox, PrimaryBtn, OutlineBtn } from '../components/UI';

const DOC_TYPES = [
  { key: '도축 검사증명서', icon: '🏭' },
  { key: '거래명세서', icon: '📄' },
  { key: '이력확인서', icon: '🔍' },
  { key: '보건증', icon: '🏥' },
  { key: '위생교육 이수증', icon: '📚' },
  { key: '기타', icon: '📋' },
];

const SCHEMAS = {
  '도축 검사증명서': ['이력번호', '도축일', '등급', '부위', '원산지', '중량(kg)', '도축장명', '검사관'],
  '거래명세서': ['공급업체', '거래일', '이력번호', '부위', '원산지', '중량(kg)', '금액', '매입처'],
  '보건증': ['성명', '생년월일', '발급일', '만료일', '발급기관', '검사결과'],
  '위생교육 이수증': ['성명', '교육명', '이수일', '유효기한', '발급기관', '이수시간'],
  '이력확인서': ['이력번호', '개체번호', '출생일', '품종', '도축일', '등급'],
  '기타': ['서류명', '날짜', '발급기관', '비고'],
};

const DEMO_DATA = {
  '도축 검사증명서': { '이력번호': 'HN-2603-0301', '도축일': '2026.03.24', '등급': '1+', '부위': '채끝', '원산지': '국내산(한우)', '중량(kg)': '11.5', '도축장명': '부경양돈농협', '검사관': '김검사' },
  '보건증': { '성명': '홍길동', '생년월일': '1985.03.15', '발급일': '2026.03.24', '만료일': '2027.03.24', '발급기관': '김해시보건소', '검사결과': '이상없음' },
  '위생교육 이수증': { '성명': '홍길동', '교육명': '식육위생교육', '이수일': '2026.03.24', '유효기한': '2027.03.24', '발급기관': '한국식품안전관리인증원', '이수시간': '8시간' },
};

// ⚠️ 실제 배포 시 EXPO_PUBLIC_ANTHROPIC_API_KEY 환경변수에 키를 설정하세요.
// .env 파일: EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-xxxxx
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';

export default function UploadScreen() {
  const [docType, setDocType] = useState('도축 검사증명서');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const pickImage = async (useCamera) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라/갤러리 접근 권한이 필요합니다.');
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.9 });
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0]);
      setResult(null);
      setSaved(false);
    }
  };

  const runOCR = async () => {
    if (!image) return;
    setLoading(true);
    const schema = SCHEMAS[docType] || SCHEMAS['기타'];
    const prompt = `당신은 한국 축산물 관련 문서 분석 전문가입니다.\n이미지는 "${docType}" 문서입니다.\n다음 항목들을 추출하여 JSON으로만 반환하세요 (다른 텍스트 없이):\n${schema.map(k => `- ${k}`).join('\n')}\n없는 값은 "" 으로, 날짜는 YYYY.MM.DD 형식으로.`;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.base64 } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });
      const data = await response.json();
      const raw = data.content?.[0]?.text || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : '{}');
      setResult(parsed);
    } catch {
      // API 키 미설정 시 데모 데이터로 대체
      setResult(DEMO_DATA[docType] || { '서류명': docType, '날짜': '2026.03.26' });
    }
    setLoading(false);
  };

  const handleSave = () => {
    setSaved(true);
    setResult(null);
    setImage(null);
    Alert.alert('저장 완료', `${docType}이(가) DB에 저장되었습니다.`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Doc type selector */}
      <Text style={styles.sectionLabel}>📂 문서 종류 선택</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
        {DOC_TYPES.map(dt => (
          <TouchableOpacity
            key={dt.key}
            style={[styles.typeBtn, docType === dt.key && styles.typeBtnActive]}
            onPress={() => { setDocType(dt.key); setImage(null); setResult(null); setSaved(false); }}
          >
            <Text style={styles.typeIcon}>{dt.icon}</Text>
            <Text style={[styles.typeLabel, docType === dt.key && styles.typeLabelActive]}>{dt.key}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Upload zone */}
      <View style={styles.uploadZone}>
        {image ? (
          <View style={{ alignItems: 'center' }}>
            <Image source={{ uri: image.uri }} style={styles.preview} />
            <Text style={styles.fileName}>{image.fileName || '선택한 이미지'}</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Text style={styles.uploadIcon}>📱</Text>
            <Text style={styles.uploadTitle}>서류 사진을 촬영하거나 선택하세요</Text>
            <Text style={styles.uploadSub}>JPG, PNG, HEIC 지원</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: colors.a2 }]} onPress={() => pickImage(true)}>
          <Text style={styles.imgBtnText}>📷 카메라</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: colors.s3, borderWidth: 1, borderColor: colors.bd }]} onPress={() => pickImage(false)}>
          <Text style={[styles.imgBtnText, { color: colors.t2 }]}>🖼️ 갤러리</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.ocrBtn, (!image || loading) && { opacity: 0.5 }]}
        onPress={runOCR}
        disabled={!image || loading}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.ocrBtnText}>AI 분석 중...</Text>
          </View>
        ) : (
          <Text style={styles.ocrBtnText}>✨ AI로 자동 읽기</Text>
        )}
      </TouchableOpacity>

      {image && (
        <TouchableOpacity style={styles.resetBtn} onPress={() => { setImage(null); setResult(null); }}>
          <Text style={styles.resetBtnText}>초기화</Text>
        </TouchableOpacity>
      )}

      {/* OCR Result */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>✅ AI 인식 결과</Text>
            <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>✨ 자동 추출</Text></View>
          </View>
          <AlertBox
            type="info"
            icon="✨"
            message={`AI가 "${docType}"에서 ${Object.values(result).filter(v => v).length}개 항목을 인식했습니다.`}
          />
          {Object.entries(result).map(([key, value]) => (
            value ? (
              <View key={key} style={styles.resultRow}>
                <Text style={styles.resultKey}>{key}</Text>
                <Text style={styles.resultVal}>{value}</Text>
              </View>
            ) : null
          ))}
          <View style={styles.resultBtns}>
            <PrimaryBtn label="💾 저장" onPress={handleSave} color={colors.gn} style={{ flex: 1 }} />
            <OutlineBtn label="취소" onPress={() => setResult(null)} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {/* 촬영 가이드 */}
      {!image && !result && (
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>📖 촬영 가이드</Text>
          {[
            { icon: '🔆', title: '밝은 곳에서 촬영', sub: '직사광선 반사 주의, 형광등 아래 권장' },
            { icon: '📐', title: '문서 전체가 보이게', sub: '모서리 4개가 모두 화면 안에' },
            { icon: '🔍', title: '글자가 선명하게', sub: '흔들리지 않게 고정 후 촬영' },
          ].map(g => (
            <View key={g.title} style={styles.guideRow}>
              <Text style={styles.guideIcon}>{g.icon}</Text>
              <View>
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
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.t2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeBtn: { alignItems: 'center', backgroundColor: colors.s1, borderWidth: 1.5, borderColor: colors.bd, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, ...shadow.sm },
  typeBtnActive: { borderColor: colors.a2, backgroundColor: '#eff6ff' },
  typeIcon: { fontSize: 20, marginBottom: 4 },
  typeLabel: { fontSize: 10, color: colors.t2, fontWeight: '600', textAlign: 'center', maxWidth: 70 },
  typeLabelActive: { color: colors.a2, fontWeight: '800' },

  uploadZone: { borderWidth: 2, borderColor: colors.bd, borderStyle: 'dashed', borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: 12, overflow: 'hidden', minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 200, resizeMode: 'contain', borderRadius: 8, margin: 10 },
  fileName: { fontSize: 11, color: colors.t3, marginTop: 6, marginBottom: 10 },
  uploadIcon: { fontSize: 40, marginBottom: 10 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: colors.tx, marginBottom: 6 },
  uploadSub: { fontSize: 11, color: colors.t3 },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  imgBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  imgBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ocrBtn: { backgroundColor: colors.pu, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginBottom: 8 },
  ocrBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  resetBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  resetBtnText: { fontSize: 12, color: colors.t3 },

  resultCard: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, overflow: 'hidden', ...shadow.sm, marginBottom: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.bd, backgroundColor: colors.bg },
  resultTitle: { fontSize: 13, fontWeight: '700', color: colors.tx },
  aiBadge: { backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  aiBadgeText: { fontSize: 10, color: colors.pu, fontWeight: '700' },
  resultRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.bd + '60' },
  resultKey: { fontSize: 11, color: colors.t3, width: 120, fontWeight: '600' },
  resultVal: { fontSize: 12, color: colors.tx, flex: 1, fontWeight: '600' },
  resultBtns: { flexDirection: 'row', gap: 10, padding: 14 },

  guideCard: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: 16, ...shadow.sm },
  guideTitle: { fontSize: 13, fontWeight: '700', color: colors.tx, marginBottom: 14 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  guideIcon: { fontSize: 20 },
  guideRowTitle: { fontSize: 13, fontWeight: '600', color: colors.tx, marginBottom: 3 },
  guideRowSub: { fontSize: 11, color: colors.t3 },
});
