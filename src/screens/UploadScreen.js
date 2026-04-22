import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { meatStore, staffStore } from '../lib/dataStore';
import { supabase } from '../lib/supabase';
import { meatInventory as initMeat, staffData } from '../data/mockData';

const DOC_TYPES = [
  { key: '거래명세서',      icon: 'document-text', category: 'stock' },
  { key: '도축 검사증명서', icon: 'business',      category: 'stock' },
  { key: '이력확인서',      icon: 'search',        category: 'trace' },
  { key: '보건증',          icon: 'medkit',        category: 'staff' },
  { key: '위생교육 이수증', icon: 'school',        category: 'staff' },
  { key: '기타',            icon: 'clipboard',     category: 'etc'   },
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

// ※ Anthropic API 키는 클라이언트 번들에 넣지 않는다.
// Supabase Edge Function `ocr-proxy` 가 서버사이드에서 대신 호출한다.
// 프록시가 401/5xx 를 돌려주면 아래 runOCR 이 자동으로 데모 폴백한다.

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

  // ─── OCR 실행 — Supabase Edge Function `ocr-proxy` 호출 ──────
  // 키 노출 방지: Anthropic API 키는 서버(Edge Function)에만 존재.
  // 프록시 미배포/미인증/서버 오류 시 DEMO_DATA 로 자동 폴백.
  const runOCR = async () => {
    if (!image) return;
    setLoading(true);

    // 데모 폴백 헬퍼
    const fallbackToDemo = (reason) => {
      setResult(DEMO_DATA[docType] || { '서류명': docType, '날짜': new Date().toLocaleDateString('ko-KR') });
      setIsDemo(true);
      setLoading(false);
      if (reason) console.warn('[OCR] demo fallback:', reason);
    };

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

    try {
      // Supabase Edge Function 호출 (60초 타임아웃은 supabase-js 기본값)
      const { data, error } = await supabase.functions.invoke('ocr-proxy', {
        body: {
          docType,
          prompt,
          imageBase64: image.base64,
          mimeType,
        },
      });

      // 401(미로그인) · 404(함수 미배포) · 500/504(서버 오류) → 데모 폴백
      if (error) {
        if (error.context?.status === 504) {
          Alert.alert('시간 초과', '요청 시간이 초과됐습니다 (30초). 인터넷 연결을 확인 후 다시 시도해주세요.');
          setLoading(false);
          return;
        }
        return fallbackToDemo(`invoke error: ${error.message}`);
      }
      if (data?.error) {
        return fallbackToDemo(`proxy error: ${data.error}`);
      }

      // Anthropic 응답 파싱 (프록시는 { content, usage } 포맷으로 전달)
      const raw = data?.content?.[0]?.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        Alert.alert('OCR 오류', 'AI가 결과를 반환하지 못했습니다. 서류를 더 선명하게 촬영 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(match[0]);
      if (Object.keys(parsed).length === 0) {
        Alert.alert('OCR 오류', '인식된 내용이 없습니다. 서류가 잘 보이도록 다시 촬영해주세요.');
        setLoading(false);
        return;
      }
      setResult(parsed);
      setIsDemo(false);
    } catch (e) {
      fallbackToDemo(e?.message || 'unknown');
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
  const saveLabel = docCategory === 'stock' ? '재고에 등록'
    : docCategory === 'staff' ? '직원 서류 등록'
    : '저장';
  const saveIcon = docCategory === 'stock' ? 'cube'
    : docCategory === 'staff' ? 'person'
    : 'save';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>

      {/* API 키 상태 배너 */}
      {!HAS_API_KEY && (
        <View style={styles.demoBanner}>
          <Ionicons name="warning" size={22} color={C.warn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.demoBannerTitle}>데모 모드</Text>
            <Text style={styles.demoBannerSub}>.env.local에 EXPO_PUBLIC_ANTHROPIC_API_KEY 설정 시 실제 AI 분석 가능</Text>
          </View>
        </View>
      )}

      {/* 문서 종류 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Ionicons name="folder-open" size={18} color={C.t2} />
        <Text style={styles.sectionTitle}>문서 종류</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>
        {DOC_TYPES.map(dt => (
          <TouchableOpacity
            key={dt.key}
            style={[styles.typeBtn,
              docType === dt.key && { borderColor: C.red, backgroundColor: C.redS }]}
            onPress={() => { setDocType(dt.key); setImage(null); setResult(null); }}>
            <Ionicons name={dt.icon} size={24} color={docType === dt.key ? C.red : C.t3} />
            <Text style={[styles.typeLabel,
              docType === dt.key && { color: C.red, fontWeight: '800' }]}>{dt.key}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 카테고리 안내 */}
      {docCategory === 'stock' && (
        <View style={[styles.categoryBadge, { backgroundColor: C.okS, borderColor: C.ok2 }]}>
          <Ionicons name="cube" size={14} color={C.ok} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: F.xs, color: C.ok, fontWeight: '700' }}>
            분석 후 재고에 자동 등록됩니다
          </Text>
        </View>
      )}
      {docCategory === 'staff' && (
        <View style={[styles.categoryBadge, { backgroundColor: C.purS, borderColor: C.pur }]}>
          <Ionicons name="person" size={14} color={C.pur} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: F.xs, color: C.pur, fontWeight: '700' }}>
            분석 후 직원 서류가 자동 업데이트됩니다
          </Text>
        </View>
      )}

      {/* 업로드 영역 */}
      <View style={styles.uploadZone}>
        {image ? (
          <>
            <Image source={{ uri: image.uri }} style={styles.preview} />
            <TouchableOpacity onPress={() => { setImage(null); setResult(null); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={C.red3} />
              <Text style={styles.clearBtnText}> 다시 선택</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ alignItems: 'center', padding: 24 }}>
            <Ionicons name="document-text-outline" size={52} color={C.t4} style={{ marginBottom: 14 }} />
            <Text style={styles.uploadTitle}>서류 사진을 올려주세요</Text>
            <Text style={styles.uploadSub}>카메라 촬영 또는 갤러리에서 선택</Text>
          </View>
        )}
      </View>

      {/* 버튼들 */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: C.red }]} onPress={() => pickImage(true)}>
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.imgBtnText}>카메라</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.imgBtn, { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border }]} onPress={() => pickImage(false)}>
          <Ionicons name="images" size={22} color={C.t2} />
          <Text style={[styles.imgBtnText, { color: C.t2 }]}>갤러리</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={HAS_API_KEY ? 'sparkles' : 'search'} size={18} color="#fff" />
            <Text style={styles.ocrBtnText}>{HAS_API_KEY ? 'AI 자동 분석' : '데모로 확인'}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 결과 */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color={C.ok} />
              <Text style={styles.resultTitle}>인식 결과</Text>
            </View>
            <View style={[styles.modeBadge, isDemo && { backgroundColor: C.warnS, borderColor: C.warn2 }]}>
              <Ionicons name={isDemo ? 'clipboard' : 'sparkles'} size={12} color={isDemo ? C.warn : C.pur} />
              <Text style={[styles.modeBadgeText, isDemo && { color: C.warn }]}>
                {isDemo ? ' 데모' : ' AI'}
              </Text>
            </View>
          </View>
          {isDemo && (
            <View style={styles.demoNotice}>
              <Ionicons name="warning" size={14} color="#92400e" />
              <Text style={styles.demoNoticeText}> 데모 데이터입니다. 실제 문서 내용이 아닙니다.</Text>
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
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={saveIcon} size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{saveLabel}</Text>
                  </View>}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Ionicons name="book-outline" size={18} color={C.t1} />
            <Text style={styles.guideTitle}>촬영 가이드</Text>
          </View>
          {[
            { icon: 'sunny',   title: '밝은 곳에서 촬영', sub: '직사광선 반사 주의, 형광등 아래 권장' },
            { icon: 'scan',    title: '문서 전체가 보이게', sub: '모서리 4개가 화면 안에 들어오게' },
            { icon: 'search',  title: '글자가 선명하게', sub: '흔들리지 않게 고정 후 촬영' },
          ].map(g => (
            <View key={g.title} style={styles.guideRow}>
              <Ionicons name={g.icon} size={22} color={C.red} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.guideRowTitle}>{g.title}</Text>
                <Text style={styles.guideRowSub}>{g.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 재고 등록 확인 모달 ── */}
      <Modal visible={stockModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {/* V5 modal header with red accent */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderAccent} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="cube" size={20} color={C.red} />
              <Text style={styles.modalTitle}>재고 등록</Text>
            </View>
            <TouchableOpacity onPress={() => setStockModal(false)}>
              <Ionicons name="close" size={22} color={C.t3} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={styles.modalNotice}>
              <Ionicons name="information-circle" size={16} color={C.ok} style={{ marginRight: 6, marginTop: 2 }} />
              <Text style={{ fontSize: F.xs, color: C.ok, fontWeight: '600', lineHeight: 20, flex: 1 }}>
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
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.t4}
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
                : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.confirmBtnText}>재고에 추가</Text>
                  </View>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 10 }]}
              onPress={() => setStockModal(false)}>
              <Text style={styles.cancelBtnText}>취소</Text>
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
    backgroundColor: C.warnS, borderWidth: 1, borderColor: C.warn2 + '40',
    borderRadius: R.md, padding: 16, marginBottom: 16,
  },
  demoBannerTitle: { fontSize: F.sm, fontWeight: '800', color: '#92400e', marginBottom: 2 },
  demoBannerSub: { fontSize: F.xs, color: C.warn, lineHeight: 18 },

  sectionTitle: { fontSize: F.body, fontWeight: '800', color: C.t1 },

  typeBtn: {
    alignItems: 'center', borderWidth: 1.5,
    borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 16, minWidth: 80,
    backgroundColor: C.white, borderColor: C.border,
  },
  typeLabel: { fontSize: F.xs, fontWeight: '600', textAlign: 'center', color: C.t2, marginTop: 5 },

  categoryBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 10, marginTop: 4,
  },

  uploadZone: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
    borderRadius: R.lg, marginBottom: 16, backgroundColor: C.white,
    minHeight: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  preview:      { width: '100%', height: 220, resizeMode: 'contain' },
  clearBtn:     { flexDirection: 'row', alignItems: 'center', padding: 10, alignSelf: 'center', marginBottom: 10 },
  clearBtnText: { fontSize: F.sm, color: C.red3, fontWeight: '700' },
  uploadTitle:  { fontSize: F.body, fontWeight: '800', marginBottom: 6, color: C.t1 },
  uploadSub:    { fontSize: F.xs, color: C.t3 },

  btnRow:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
  imgBtn:     { flex: 1, flexDirection: 'row', paddingVertical: 14, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imgBtnText: { color: '#fff', fontSize: F.sm, fontWeight: '800' },

  ocrBtn: {
    backgroundColor: C.pur, paddingVertical: 16, borderRadius: R.md,
    alignItems: 'center', marginBottom: 16,
  },
  ocrBtnText: { color: '#fff', fontSize: F.body, fontWeight: '900', letterSpacing: 0.3 },

  resultCard:   { borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 16, backgroundColor: C.white },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg2 },
  resultTitle:  { fontSize: F.body, fontWeight: '800', color: C.t1 },
  modeBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.purS, borderWidth: 1, borderColor: C.pur + '30', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  modeBadgeText:{ fontSize: F.xs, color: C.pur, fontWeight: '800' },
  demoNotice:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.warnS, padding: 10, borderBottomWidth: 1, borderBottomColor: C.warn2 + '30' },
  demoNoticeText:{ fontSize: F.xs, color: '#92400e', fontWeight: '600' },
  resultRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border + '50' },
  resultKey:    { fontSize: F.sm, width: 130, fontWeight: '600', color: C.t3 },
  resultVal:    { fontSize: F.sm, flex: 1, fontWeight: '700', color: C.t1 },
  resultBtns:   { flexDirection: 'row', gap: 10, padding: 16 },
  saveBtn:      { flex: 1, backgroundColor: C.ok, paddingVertical: 13, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText:  { color: '#fff', fontSize: F.sm, fontWeight: '800' },
  cancelBtn:    { flex: 1, borderWidth: 1.5, borderColor: C.border, paddingVertical: 13, borderRadius: R.md, alignItems: 'center' },
  cancelBtnText:{ fontSize: F.sm, fontWeight: '600', color: C.t2 },

  guideCard:     { borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 10, backgroundColor: C.white, ...SH.sm },
  guideTitle:    { fontSize: F.body, fontWeight: '800', color: C.t1 },
  guideRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  guideRowTitle: { fontSize: F.sm, fontWeight: '700', marginBottom: 3, color: C.t1 },
  guideRowSub:   { fontSize: F.xs, lineHeight: 19, color: C.t3 },

  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  modalHeaderAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.red },
  modalTitle:      { fontSize: F.h3, fontWeight: '900', color: C.t1 },
  modalNotice:     { flexDirection: 'row', borderWidth: 1, borderColor: C.ok2 + '30', backgroundColor: C.okS, borderRadius: R.sm, padding: 12, marginBottom: 24 },
  fieldLabel:      { fontSize: F.sm, fontWeight: '700', marginBottom: 6, color: C.t2 },
  fieldInput:      { borderWidth: 1.5, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: F.body, backgroundColor: C.white, borderColor: C.border, color: C.t1 },
  confirmBtn:      { backgroundColor: C.ok, paddingVertical: 16, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  confirmBtnText:  { color: '#fff', fontSize: F.body, fontWeight: '900' },
});
