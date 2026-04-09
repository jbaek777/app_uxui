import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, darkColors, lightColors, radius, fontSize, spacing } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { meatStore, staffStore } from '../lib/dataStore';
import { meatInventory as initMeat, staffData } from '../data/mockData';

const DOC_TYPES = [
  { key: '거래명세서',      icon: '📄', category: 'stock' },
  { key: '도축 검사증명서', icon: '🏭', category: 'stock' },
  { key: '이력확인서',      icon: '🔍', category: 'trace' },
  { key: '보건증',          icon: '🏥', category: 'staff' },
  { key: '위생교육 이수증', icon: '📚', category: 'staff' },
  { key: '기타',            icon: '📋', category: 'etc'   },
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
  '거래명세서':      { '공급업체': '○○축산유통', '거래일': '2026.03.29', '이력번호': 'HN-2603-0302', '부위': '등심', '원산지': '국내산(한우)', '중량(kg)': '8.5', '금액': '833000', '매입처': '○○농협' },
  '보건증':          { '성명': '홍길동', '생년월일': '1985.03.15', '발급일': '2026.03.24', '만료일': '2027.03.24', '발급기관': '김해시보건소', '검사결과': '이상없음' },
  '위생교육 이수증': { '성명': '홍길동', '교육명': '식육위생교육', '이수일': '2026.03.24', '유효기한': '2027.03.24', '발급기관': '한국식품안전관리인증원', '이수시간': '8시간' },
};

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
const HAS_API_KEY = API_KEY.length > 10;

// OCR 결과에서 소비기한 계산 (도축일 기준 14일)
function calcExpire(slaughterDate) {
  if (!slaughterDate) return '';
  try {
    const [y, m, d] = slaughterDate.split('.').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 14);
    return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
  } catch { return ''; }
}

// 소비기한 → dday 계산
function calcDday(expireStr) {
  if (!expireStr) return 0;
  try {
    const [y, m, d] = expireStr.split('.').map(Number);
    return Math.ceil((new Date(y, m-1, d) - new Date()) / 86400000);
  } catch { return 0; }
}

export default function UploadScreen({ navigation }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;

  const [docType, setDocType] = useState('거래명세서');
  const [image, setImage]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [isDemo, setIsDemo]   = useState(false);
  const [saving, setSaving]   = useState(false);

  // 재고 등록 모달
  const [stockModal, setStockModal] = useState(false);
  const [stockForm, setStockForm]   = useState({
    cut: '', origin: '', qty: '', buyPrice: '', sellPrice: '', expire: '',
  });

  const pickImage = async (useCamera) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('권한 필요', '카메라/갤러리 접근 권한이 필요합니다.');
      return;
    }
    // quality 0.7: base64 메모리 절약, HEIC → JPEG 자동 변환
    const opts = { base64: true, quality: 0.7, exif: false };
    const res = useCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      if (!asset.base64) {
        Alert.alert('이미지 오류', '이미지를 불러오지 못했습니다. 다시 시도해주세요.');
        return;
      }
      setImage(asset);
      setResult(null);
      setIsDemo(false);
    }
  };

  const runOCR = async () => {
    if (!image) return;
    setLoading(true);
    if (!HAS_API_KEY) {
      await new Promise(r => setTimeout(r, 1200));
      setResult(DEMO_DATA[docType] || { '서류명': docType, '날짜': '2026.03.29' });
      setIsDemo(true);
      setLoading(false);
      return;
    }
    // base64 재확인
    if (!image.base64) {
      Alert.alert('이미지 오류', '이미지 데이터가 없습니다. 다시 촬영해주세요.');
      setLoading(false);
      return;
    }
    // Anthropic 지원 MIME: jpeg/png/gif/webp만 허용
    const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mimeType = SUPPORTED.includes(image.mimeType) ? image.mimeType : 'image/jpeg';

    const schema = SCHEMAS[docType] || SCHEMAS['기타'];
    const prompt = `당신은 한국 축산물 관련 문서 분석 전문가입니다.\n이미지는 "${docType}" 문서입니다.\n다음 항목들을 추출하여 JSON으로만 반환하세요 (다른 텍스트 없이):\n${schema.map(k => `- ${k}`).join('\n')}\n없는 값은 "" 으로, 날짜는 YYYY.MM.DD 형식으로.`;

    // 30초 타임아웃
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: image.base64 } },
            { type: 'text', text: prompt },
          ]}],
        }),
      });
      clearTimeout(timer);
      const data = await response.json();
      // 인증 오류 → 데모 모드로 자동 폴백
      if (data.error?.type === 'authentication_error' || data.error?.message?.includes('x-api-key')) {
        setResult(DEMO_DATA[docType] || { '서류명': docType, '날짜': new Date().toLocaleDateString('ko-KR') });
        setIsDemo(true);
        setLoading(false);
        return;
      }
      if (data.error) throw new Error(data.error.message);
      const raw = data.content?.[0]?.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI가 결과를 반환하지 못했습니다. 서류를 더 선명하게 촬영 후 다시 시도해주세요.');
      const parsed = JSON.parse(match[0]);
      if (Object.keys(parsed).length === 0) throw new Error('인식된 내용이 없습니다. 서류가 잘 보이도록 다시 촬영해주세요.');
      setResult(parsed);
      setIsDemo(false);
    } catch (e) {
      clearTimeout(timer);
      const msg = e.name === 'AbortError'
        ? '요청 시간이 초과됐습니다 (30초). 인터넷 연결을 확인 후 다시 시도해주세요.'
        : (e.message || 'AI 분석에 실패했습니다. 다시 시도해주세요.');
      Alert.alert('OCR 오류', msg);
    }
    setLoading(false);
  };

  // ── 문서 타입별 저장 분기 ────────────────────────────────
  const handleSave = () => {
    const category = DOC_TYPES.find(d => d.key === docType)?.category;

    if (category === 'stock') {
      // 거래명세서 / 도축 검사증명서 → 재고 등록 모달
      const cut    = result['부위'] || '';
      const origin = result['원산지'] || '';
      const qty    = result['중량(kg)'] || '';
      // 금액이 있으면 kg당 단가 계산 시도 (총액 / 중량)
      let buyPrice = '';
      if (result['금액'] && qty) {
        const total = parseFloat(result['금액'].replace(/[^0-9.]/g, ''));
        const kg    = parseFloat(qty);
        if (!isNaN(total) && !isNaN(kg) && kg > 0)
          buyPrice = String(Math.round(total / kg));
      }
      // 도축일 있으면 소비기한 자동 계산 (도축일 + 14일)
      const slaughterDate = result['도축일'] || result['거래일'] || '';
      const expire = calcExpire(slaughterDate);

      setStockForm({ cut, origin, qty, buyPrice, sellPrice: '', expire });
      setStockModal(true);
    } else if (category === 'staff') {
      // 보건증 / 위생교육 이수증 → 직원 서류 업데이트
      handleStaffSave();
    } else {
      Alert.alert('저장 완료', `${docType}이(가) 기록되었습니다.`);
      setResult(null);
      setImage(null);
    }
  };

  // ── 직원 서류 저장 ────────────────────────────────────────
  const handleStaffSave = async () => {
    setSaving(true);
    try {
      const name     = result['성명'] || '';
      const expDate  = result['만료일'] || result['유효기한'] || '';
      const isHealth = docType === '보건증';

      const staff = await staffStore.load(staffData);
      const idx   = staff.findIndex(s => s.name === name);

      if (idx === -1) {
        Alert.alert(
          '직원 없음',
          `"${name}"은(는) 등록된 직원이 아닙니다.\n설정 > 직원 관리에서 먼저 등록해주세요.`
        );
        setSaving(false);
        return;
      }

      const updated = staff.map((s, i) => {
        if (i !== idx) return s;
        return isHealth
          ? { ...s, health: expDate, status: new Date(expDate.replace(/\./g, '-')) < new Date() ? 'expired' : 'ok' }
          : { ...s, edu: expDate };
      });

      await staffStore.save(updated);
      Alert.alert('저장 완료', `${name} 직원의 ${isHealth ? '보건증' : '위생교육 이수증'} 만료일이 업데이트되었습니다.`);
      setResult(null);
      setImage(null);
    } catch (e) {
      Alert.alert('오류', '저장 중 문제가 발생했습니다.');
    }
    setSaving(false);
  };

  // ── 재고 등록 확정 ────────────────────────────────────────
  const handleStockConfirm = async () => {
    const { cut, origin, qty, buyPrice, sellPrice, expire } = stockForm;
    if (!cut || !qty || !expire) {
      Alert.alert('입력 오류', '부위명, 중량, 소비기한은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const existing = await meatStore.load(initMeat);
      const dday   = calcDday(expire);
      const newItem = {
        id: `m_${Date.now()}`,
        cut:       cut.trim(),
        origin:    origin.trim(),
        qty:       parseFloat(qty) || 0,
        unit:      'kg',
        buyPrice:  parseInt(buyPrice) || 0,
        sellPrice: parseInt(sellPrice) || 0,
        expire,
        dday,
        status:    dday <= 0 ? 'critical' : dday <= 2 ? 'low' : 'ok',
        sold:      false,
        soldDate:  null,
        editCount: 0,
        editLog:   [],
      };
      await meatStore.save([...existing, newItem]);
      setStockModal(false);
      setResult(null);
      setImage(null);
      Alert.alert('재고 등록 완료', `${cut} ${qty}kg이 재고에 추가되었습니다.\n재고 화면에서 확인하세요.`);
    } catch (e) {
      Alert.alert('오류', '재고 저장 중 문제가 발생했습니다.');
    }
    setSaving(false);
  };

  const docCategory = DOC_TYPES.find(d => d.key === docType)?.category;
  const saveLabel = docCategory === 'stock' ? '📦 재고에 등록'
    : docCategory === 'staff' ? '👤 직원 서류 등록'
    : '💾 저장';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: pal.bg }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>

      {/* API 키 상태 배너 */}
      {!HAS_API_KEY && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.demoBannerTitle}>데모 모드</Text>
            <Text style={styles.demoBannerSub}>.env.local에 EXPO_PUBLIC_ANTHROPIC_API_KEY 설정 시 실제 AI 분석 가능</Text>
          </View>
        </View>
      )}

      {/* 문서 종류 */}
      <Text style={[styles.sectionTitle, { color: pal.tx }]}>📂 문서 종류</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
        {DOC_TYPES.map(dt => (
          <TouchableOpacity
            key={dt.key}
            style={[styles.typeBtn, { backgroundColor: pal.s1, borderColor: pal.bd },
              docType === dt.key && { borderColor: '#3d7ef5', backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
            onPress={() => { setDocType(dt.key); setImage(null); setResult(null); }}>
            <Text style={styles.typeIcon}>{dt.icon}</Text>
            <Text style={[styles.typeLabel, { color: pal.t2 },
              docType === dt.key && { color: '#3d7ef5', fontWeight: '800' }]}>{dt.key}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 카테고리 안내 */}
      {docCategory === 'stock' && (
        <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#1a3a1a' : '#f0fdf4', borderColor: '#22c55e' }]}>
          <Text style={{ fontSize: fontSize.xs, color: '#16a34a', fontWeight: '700' }}>
            📦 분석 후 재고에 자동 등록됩니다
          </Text>
        </View>
      )}
      {docCategory === 'staff' && (
        <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#1a1a3a' : '#f5f3ff', borderColor: '#8b5cf6' }]}>
          <Text style={{ fontSize: fontSize.xs, color: '#7c3aed', fontWeight: '700' }}>
            👤 분석 후 직원 서류가 자동 업데이트됩니다
          </Text>
        </View>
      )}

      {/* 업로드 영역 */}
      <View style={[styles.uploadZone, { borderColor: pal.bd, backgroundColor: pal.s1 }]}>
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
            <Text style={[styles.uploadTitle, { color: pal.tx }]}>서류 사진을 올려주세요</Text>
            <Text style={[styles.uploadSub, { color: pal.t3 }]}>카메라 촬영 또는 갤러리에서 선택</Text>
          </View>
        )}
      </View>

      {/* 버튼들 */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: colors.a2 }]} onPress={() => pickImage(true)}>
          <Text style={styles.imgBtnIcon}>📷</Text>
          <Text style={styles.imgBtnText}>카메라</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: pal.s1, borderWidth: 1.5, borderColor: pal.bd }]} onPress={() => pickImage(false)}>
          <Text style={styles.imgBtnIcon}>🖼️</Text>
          <Text style={[styles.imgBtnText, { color: pal.t2 }]}>갤러리</Text>
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
        <View style={[styles.resultCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <View style={[styles.resultHeader, { backgroundColor: pal.bg, borderBottomColor: pal.bd }]}>
            <Text style={[styles.resultTitle, { color: pal.tx }]}>✅ 인식 결과</Text>
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
              <View key={key} style={[styles.resultRow, { borderBottomColor: pal.bd + '50' }]}>
                <Text style={[styles.resultKey, { color: pal.t3 }]}>{key}</Text>
                <Text style={[styles.resultVal, { color: pal.tx }]}>{value}</Text>
              </View>
            ) : null
          )}
          <View style={styles.resultBtns}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{saveLabel}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: pal.bd }]} onPress={() => setResult(null)}>
              <Text style={[styles.cancelBtnText, { color: pal.t2 }]}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 촬영 가이드 */}
      {!image && !result && (
        <View style={[styles.guideCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={[styles.guideTitle, { color: pal.tx }]}>📖 촬영 가이드</Text>
          {[
            { icon: '🔆', title: '밝은 곳에서 촬영', sub: '직사광선 반사 주의, 형광등 아래 권장' },
            { icon: '📐', title: '문서 전체가 보이게', sub: '모서리 4개가 화면 안에 들어오게' },
            { icon: '🔍', title: '글자가 선명하게', sub: '흔들리지 않게 고정 후 촬영' },
          ].map(g => (
            <View key={g.title} style={styles.guideRow}>
              <Text style={styles.guideIcon}>{g.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guideRowTitle, { color: pal.tx }]}>{g.title}</Text>
                <Text style={[styles.guideRowSub, { color: pal.t3 }]}>{g.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 재고 등록 확인 모달 ── */}
      <Modal visible={stockModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>📦 재고 등록</Text>
            <TouchableOpacity onPress={() => setStockModal(false)}>
              <Text style={{ fontSize: 20, color: pal.t2 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <View style={[styles.modalNotice, { backgroundColor: isDark ? '#1a3a1a' : '#f0fdf4', borderColor: '#22c55e' }]}>
              <Text style={{ fontSize: fontSize.xs, color: '#16a34a', fontWeight: '600', lineHeight: 20 }}>
                OCR로 인식한 내용을 확인·수정 후 등록하세요.{'\n'}소비기한과 판매가는 직접 입력이 필요합니다.
              </Text>
            </View>

            {[
              { label: '부위명 *', key: 'cut',       placeholder: '예: 등심', keyboard: 'default' },
              { label: '원산지',   key: 'origin',    placeholder: '예: 한우 1+', keyboard: 'default' },
              { label: '중량 (kg) *', key: 'qty',    placeholder: '예: 8.5', keyboard: 'decimal-pad' },
              { label: '매입가 (원/kg)', key: 'buyPrice', placeholder: '예: 98000', keyboard: 'number-pad' },
              { label: '판매가 (원/kg)', key: 'sellPrice', placeholder: '예: 158000', keyboard: 'number-pad' },
              { label: '소비기한 * (YYYY.MM.DD)', key: 'expire', placeholder: '예: 2026.04.12', keyboard: 'default' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: pal.t2 }]}>{f.label}</Text>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={pal.t3}
                  keyboardType={f.keyboard}
                  value={stockForm[f.key]}
                  onChangeText={v => setStockForm(prev => ({ ...prev, [f.key]: v }))}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.5 }]}
              onPress={handleStockConfirm}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>✅ 재고에 추가</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: pal.bd, marginTop: spacing.sm }]}
              onPress={() => setStockModal(false)}>
              <Text style={[styles.cancelBtnText, { color: pal.t2 }]}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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

  sectionTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm },

  typeBtn: {
    alignItems: 'center', borderWidth: 1.5,
    borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, minWidth: 80,
  },
  typeIcon:  { fontSize: 24, marginBottom: 5 },
  typeLabel: { fontSize: fontSize.xs, fontWeight: '600', textAlign: 'center' },

  categoryBadge: {
    borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: spacing.sm, marginTop: 4,
  },

  uploadZone: {
    borderWidth: 2, borderStyle: 'dashed',
    borderRadius: radius.lg, marginBottom: spacing.md,
    minHeight: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  preview:      { width: '100%', height: 220, resizeMode: 'contain' },
  clearBtn:     { padding: spacing.sm, alignSelf: 'center', marginBottom: spacing.sm },
  clearBtnText: { fontSize: fontSize.sm, color: colors.rd, fontWeight: '700' },
  uploadTitle:  { fontSize: fontSize.md, fontWeight: '800', marginBottom: 6 },
  uploadSub:    { fontSize: fontSize.xs },

  btnRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  imgBtn:     { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', gap: 4 },
  imgBtnIcon: { fontSize: 22 },
  imgBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },

  ocrBtn: {
    backgroundColor: colors.pu, paddingVertical: 16, borderRadius: radius.md,
    alignItems: 'center', marginBottom: spacing.md,
  },
  ocrBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900', letterSpacing: 0.3 },

  resultCard:   { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.md },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1 },
  resultTitle:  { fontSize: fontSize.md, fontWeight: '800' },
  modeBadge:    { backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  modeBadgeText:{ fontSize: fontSize.xs, color: colors.pu, fontWeight: '800' },
  demoNotice:   { backgroundColor: '#fffbeb', padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  demoNoticeText:{ fontSize: fontSize.xs, color: '#92400e', fontWeight: '600' },
  resultRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1 },
  resultKey:    { fontSize: fontSize.sm, width: 130, fontWeight: '600' },
  resultVal:    { fontSize: fontSize.sm, flex: 1, fontWeight: '700' },
  resultBtns:   { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  saveBtn:      { flex: 1, backgroundColor: colors.gn, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },
  cancelBtn:    { flex: 1, borderWidth: 1.5, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center' },
  cancelBtnText:{ fontSize: fontSize.sm, fontWeight: '600' },

  guideCard:     { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginTop: spacing.sm },
  guideTitle:    { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.md },
  guideRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: spacing.md },
  guideIcon:     { fontSize: 24, marginTop: 2 },
  guideRowTitle: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 3 },
  guideRowSub:   { fontSize: fontSize.xs, lineHeight: 19 },

  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1 },
  modalTitle:      { fontSize: fontSize.lg, fontWeight: '900' },
  modalNotice:     { borderWidth: 1, borderRadius: radius.sm, padding: 12, marginBottom: spacing.lg },
  fieldLabel:      { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 6 },
  fieldInput:      { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: fontSize.md },
  confirmBtn:      { backgroundColor: colors.gn, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  confirmBtnText:  { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },
});
