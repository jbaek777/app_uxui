import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert, AppState,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { radius, shadow, fontSize, spacing } from '../theme';
import { C } from '../lib/v5';
import { PrimaryBtn, OutlineBtn, StatusBadge } from '../components/UI';
import { lookupTrace, MTRACE_KEY_STORAGE } from '../lib/traceApi';

const OFFLINE_QUEUE_KEY = '@meatbig_scan_queue';
const SCAN_HISTORY_KEY = '@meatbig_scan_history';
// MTRACE_KEY_STORAGE / lookupTrace는 traceApi.js에서 import

// 네트워크 연결 확인 (간단한 fetch 방식)
async function checkOnline() {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 3000);
    await fetch('https://www.google.com/generate_204', { signal: ctrl.signal });
    clearTimeout(id);
    return true;
  } catch {
    return false;
  }
}

export default function ScanScreen({ navigation }) {
  const [mode, setMode] = useState('trace'); // 'trace' | 'ocr'
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [mtraceKey, setMtraceKey] = useState(process.env.EXPO_PUBLIC_MTRACE_API_KEY || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  // 앱 시작 시 히스토리 + 큐 + API 키 불러오기 (AsyncStorage가 있으면 우선)
  useEffect(() => {
    (async () => {
      try {
        const [hist, queue, savedKey] = await Promise.all([
          AsyncStorage.getItem(SCAN_HISTORY_KEY),
          AsyncStorage.getItem(OFFLINE_QUEUE_KEY),
          AsyncStorage.getItem(MTRACE_KEY_STORAGE),
        ]);
        if (hist) setHistory(JSON.parse(hist));
        if (queue) setPendingQueue(JSON.parse(queue));
        if (savedKey) setMtraceKey(savedKey);
      } catch (_) {}
    })();
  }, []);

  // 앱이 포그라운드로 돌아올 때 자동 동기화 시도
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') trySyncQueue();
    });
    return () => sub.remove();
  }, [pendingQueue]);

  const saveHistory = async (newHistory) => {
    try { await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(newHistory)); } catch (_) {}
  };

  const saveQueue = async (newQueue) => {
    try { await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue)); } catch (_) {}
  };

  // 오프라인 큐 동기화
  const trySyncQueue = useCallback(async () => {
    if (pendingQueue.length === 0 || syncing) return;
    const online = await checkOnline();
    setIsOnline(online);
    if (!online) return;
    setSyncing(true);
    try {
      // 실제 서버 저장 로직 (현재는 mock — Supabase agingApi.create 로 대체 가능)
      // await Promise.all(pendingQueue.map(item => agingApi.create(item)));
      await new Promise(r => setTimeout(r, 1000)); // 모의 동기화
      setPendingQueue([]);
      await saveQueue([]);
    } catch (_) {
    } finally {
      setSyncing(false);
    }
  }, [pendingQueue, syncing]);

  const saveApiKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('입력 오류', 'API 키를 입력해주세요.');
      return;
    }
    await AsyncStorage.setItem(MTRACE_KEY_STORAGE, trimmed);
    setMtraceKey(trimmed);
    setShowKeyModal(false);
    setKeyInput('');
    Alert.alert('저장 완료', 'API 키가 저장되었습니다.\n이제 실제 이력 데이터를 조회할 수 있습니다.');
  };

  const handleManualLookup = async () => {
    const clean = manualInput.replace(/\D/g, '');
    if (clean.length < 5) {
      Alert.alert('입력 오류', '이력번호를 정확히 입력해주세요.');
      return;
    }
    if (!mtraceKey) {
      Alert.alert(
        'API 키 필요',
        'data.go.kr에서 축산물이력제 API 키를 발급받아 설정해야 실제 데이터를 조회할 수 있습니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: 'API 키 설정', onPress: () => { setKeyInput(''); setShowKeyModal(true); } },
        ]
      );
      return;
    }
    setManualLoading(true);
    try {
      const info = await lookupTrace(clean, mtraceKey);
      const online = await checkOnline();
      setIsOnline(online);
      const entry = { ...info, rawData: clean, scanTime: new Date().toLocaleString('ko-KR'), synced: true };
      setResult(entry);
      const newHistory = [entry, ...history.slice(0, 9)];
      setHistory(newHistory);
      await saveHistory(newHistory);
      setManualInput('');
    } catch {
      Alert.alert('오류', '이력 조회에 실패했습니다.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleBarcode = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setLoading(true);
    try {
      if (!mtraceKey) {
        setLoading(false);
        Alert.alert(
          'API 키 필요',
          `스캔된 번호: ${data}\n\ndata.go.kr에서 API 키를 발급받아 설정해야 실제 데이터를 조회할 수 있습니다.`,
          [
            { text: '취소', style: 'cancel' },
            { text: 'API 키 설정', onPress: () => { setKeyInput(''); setShowKeyModal(true); } },
          ]
        );
        return;
      }
      const info = await lookupTrace(data, mtraceKey);
      const online = await checkOnline();
      setIsOnline(online);
      const entry = { ...info, rawData: data, scanTime: new Date().toLocaleString('ko-KR'), synced: true };
      setResult(entry);
      const newHistory = [entry, ...history.slice(0, 9)];
      setHistory(newHistory);
      await saveHistory(newHistory);
    } catch {
      Alert.alert('오류', '이력 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return (
    <View style={[styles.center, { backgroundColor: C.bg }]}>
      <ActivityIndicator color={C.red} />
    </View>
  );

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={[styles.permTitle, { color: C.t1 }]}>카메라 권한 필요</Text>
        <Text style={[styles.permSub, { color: C.t2 }]}>이력번호 바코드 스캔을 위해{'\n'}카메라 접근 권한이 필요합니다</Text>
        <PrimaryBtn label="권한 허용" onPress={requestPermission} style={{ marginTop: 20, paddingHorizontal: 40 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── V5 헤더 + 탭 ── */}
      <View style={[styles.v5Header]}>
        <View style={styles.v5HeaderAccent} />
        <View style={styles.v5HeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View style={{ width: 33, height: 33, borderRadius: 10, backgroundColor: '#B91C1C', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="scan" size={17} color="#fff" />
            </View>
            <Text style={styles.v5PageTitle}>이력 조회</Text>
          </View>
          {isOnline
            ? <View style={styles.v5OnlineBadge}><Text style={styles.v5OnlineTxt}>● 온라인</Text></View>
            : <View style={[styles.v5OnlineBadge, { backgroundColor:'#FEF3C7' }]}><Text style={[styles.v5OnlineTxt, { color:'#B45309' }]}>● 오프라인</Text></View>
          }
        </View>
      </View>
      {/* ── 상단 세그먼트 탭 ── */}
      <View style={[styles.segmentBar, { backgroundColor: C.white, borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={[styles.segmentTab, mode === 'trace' && { borderBottomColor: C.red }]}
          onPress={() => setMode('trace')}
        >
          <Text style={[styles.segmentText, { color: mode === 'trace' ? C.red : C.t3 }, mode === 'trace' && { fontWeight: '900' }]}>
            🏷️ 이력 조회
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentTab, mode === 'ocr' && { borderBottomColor: C.pur }]}
          onPress={() => setMode('ocr')}
        >
          <Text style={[styles.segmentText, { color: mode === 'ocr' ? C.pur : C.t3 }, mode === 'ocr' && { fontWeight: '900' }]}>
            📄 서류 OCR
          </Text>
        </TouchableOpacity>
      </View>

      {/* OCR 탭 */}
      {mode === 'ocr' && <OCRHub navigation={navigation} />}

      {/* 이력 조회 탭 — 전체 ScrollView */}
      {mode === 'trace' && (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>

          {/* 배너: 오프라인 */}
          {!isOnline && (
            <View style={[styles.offlineBanner, { backgroundColor: C.warn + '18', borderColor: C.warn + '50', marginBottom: spacing.sm }]}>
              <Text style={{ fontSize: 15 }}>📡</Text>
              <Text style={[styles.offlineBannerText, { color: C.warn }]}>오프라인 모드 — 스캔 결과가 로컬에 저장됩니다</Text>
            </View>
          )}
          {/* 배너: 미동기화 대기 */}
          {pendingQueue.length > 0 && (
            <TouchableOpacity
              style={[styles.syncBanner, { backgroundColor: C.red2 + '18', borderColor: C.red2 + '40', marginBottom: spacing.sm }]}
              onPress={trySyncQueue}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15 }}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.syncBannerTitle, { color: C.red2 }]}>오프라인 {pendingQueue.length}건 대기 중</Text>
                <Text style={[styles.syncBannerSub, { color: C.t3 }]}>네트워크 연결 시 자동 동기화 · 탭하여 지금 동기화</Text>
              </View>
              {syncing
                ? <ActivityIndicator size="small" color={C.red2} />
                : <Text style={{ color: C.red2, fontSize: 18 }}>↑</Text>
              }
            </TouchableOpacity>
          )}
          {/* 배너: API 키 미설정 */}
          {!mtraceKey ? (
            <TouchableOpacity
              style={[styles.offlineBanner, { backgroundColor: C.pur + '12', borderColor: C.pur + '40', marginBottom: spacing.sm }]}
              onPress={() => { setKeyInput(''); setShowKeyModal(true); }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15 }}>🔑</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.offlineBannerText, { color: C.pur, marginBottom: 2 }]}>API 키 미설정 — 실제 이력 조회 불가</Text>
                <Text style={{ fontSize: fontSize.xxs, color: C.pur + 'aa' }}>탭하여 data.go.kr API 키 입력 →</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.offlineBanner, { backgroundColor: C.ok2 + '12', borderColor: C.ok2 + '40', marginBottom: spacing.sm }]}>
              <Text style={{ fontSize: 15 }}>✅</Text>
              <Text style={[styles.offlineBannerText, { color: C.ok2 }]}>API 키 설정됨 — 실제 이력 조회 가능</Text>
              <TouchableOpacity onPress={() => { setKeyInput(mtraceKey); setShowKeyModal(true); }}>
                <Text style={{ fontSize: fontSize.xxs, color: C.t3 }}>변경</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 스캔 카드 */}
          <View style={[styles.scanLaunchArea, { backgroundColor: C.white, borderColor: C.border }]}>
            <Text style={[styles.scanTitle, { color: C.t1 }]}>🏷️ 축산물 이력번호 조회</Text>
            <Text style={[styles.scanSub, { color: C.t2 }]}>
              바코드·QR코드를 스캔하면{'\n'}도축 정보·등급·원산지를 즉시 확인합니다
            </Text>
            <TouchableOpacity
              style={[styles.scanBigBtn, { backgroundColor: C.red }]}
              onPress={() => { setScanning(true); setScanned(false); }}
            >
              <Text style={styles.scanBigIcon}>📷</Text>
              <Text style={styles.scanBigLabel}>바코드 스캔 시작</Text>
            </TouchableOpacity>
          </View>

          {/* 직접 입력 — 독립 행 (preview 스타일: 전체 너비 + 내장 버튼) */}
          <View style={[styles.lookupWrap, { backgroundColor: C.white, borderColor: manualInput ? C.red : C.border }]}>
            <TextInput
              style={[styles.lookupInput, { color: C.t1 }]}
              placeholder="이력번호 15자리 직접 입력"
              placeholderTextColor={C.t3}
              value={manualInput}
              onChangeText={setManualInput}
              keyboardType="numeric"
              maxLength={20}
              onSubmitEditing={handleManualLookup}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.lookupBtn, { backgroundColor: manualLoading ? C.border : C.red }]}
              onPress={handleManualLookup}
              disabled={manualLoading}
            >
              {manualLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ fontSize: 17 }}>🔍</Text>
              }
            </TouchableOpacity>
          </View>

          {/* 최근 조회 이력 */}
          {history.length > 0 && (
            <>
              <Text style={[styles.recentTitle, { color: C.t3 }]}>최근 조회 내역</Text>
              {history.map((h, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.recentItem, { backgroundColor: C.white, borderColor: C.border }]}
                  onPress={() => setResult(h)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.recentNo, { color: C.t1 }]}>{h.traceNo}</Text>
                      {h.synced === false && (
                        <View style={[styles.pendingBadge, { backgroundColor: C.warn + '30' }]}>
                          <Text style={[styles.pendingBadgeText, { color: C.warn }]}>미동기화</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.recentInfo, { color: C.t3 }]}>
                      {h.animalType}{h.grade && h.grade !== 'N/A' ? ` · ${h.grade}등급` : ''} · {h.farmName}
                    </Text>
                  </View>
                  <Text style={[styles.recentDate, { color: C.t3 }]}>{h.scanTime?.split(' ')[1] || h.scanTime}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {history.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyText, { color: C.t3 }]}>스캔 이력이 없습니다{'\n'}바코드를 스캔하거나 이력번호를 입력하세요</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* 카메라 모달 */}
      <Modal visible={scanning} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            autofocus="on"
            onBarcodeScanned={scanned ? undefined : handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'itf14', 'datamatrix', 'pdf417', 'upc_a', 'upc_e'] }}
          >
            <View style={styles.camOverlay}>
              <View style={styles.camTopBar}>
                <TouchableOpacity onPress={() => setScanning(false)} style={styles.camCloseBtn}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>✕ 닫기</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.camCenter}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.camHint}>바코드를 가이드 안에 수평으로 맞춰주세요</Text>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* 로딩 */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: C.white }]}>
            <ActivityIndicator size="large" color={C.red} />
            <Text style={[styles.loadingText, { color: C.t2 }]}>이력 정보 조회 중...</Text>
          </View>
        </View>
      </Modal>

      {/* 결과 모달 */}
      <Modal visible={!!result && !loading} animationType="slide" presentationStyle="pageSheet">
        {result && (
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[styles.resultHeader, { borderBottomColor: C.border, backgroundColor: C.white }]}>
              <Text style={[styles.resultTitle, { color: C.t1 }]}>🏷️ 이력 조회 결과</Text>
              <TouchableOpacity onPress={() => setResult(null)}>
                <Text style={[styles.resultClose, { color: C.t2 }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
              <View style={[styles.traceBox, { backgroundColor: C.red2 + '18', borderColor: C.red2 + '50' }]}>
                <Text style={[styles.traceLabel, { color: C.t2 }]}>이력번호</Text>
                <Text style={[styles.traceNo, { color: C.red2 }]}>{result.traceNo}</Text>
                <Text style={[styles.traceTime, { color: C.t3 }]}>조회: {result.scanTime}</Text>
              </View>

              <InfoSection title="📋 기본 정보">
                <InfoRow label="축종" value={result.animalType} />
                <InfoRow label="등급" value={`${result.grade}등급`} highlight />
                <InfoRow label="출생일" value={result.birthDate} />
                <InfoRow label="출하 중량" value={result.weight} />
              </InfoSection>

              <InfoSection title="🏡 농장 정보">
                <InfoRow label="사육 농가" value={result.farmName} />
              </InfoSection>

              <InfoSection title="🔪 도축 정보">
                <InfoRow label="도축일" value={result.slaughterDate} />
                <InfoRow label="도축장" value={result.slaughterPlace} />
                <InfoRow label="검사 결과" value={result.inspection}
                  highlight={result.inspection === '적합'} highlightColor={C.ok2} />
              </InfoSection>

              {result.synced === false && (
                <View style={[styles.offlineBanner, { marginHorizontal: 0, marginBottom: spacing.sm }]}>
                  <Text style={[styles.offlineBannerText, { color: C.warn }]}>
                    ⚠️ 오프라인 스캔 — 인터넷 연결 시 자동으로 서버에 동기화됩니다
                  </Text>
                </View>
              )}
              <PrimaryBtn label="✓ 숙성 관리에 등록" color={C.red}
                onPress={() => {
                  Alert.alert('등록', `이력번호 ${result.traceNo}를 숙성 관리에 등록합니다.`);
                  setResult(null);
                }}
                style={{ marginTop: spacing.md }} />
              <OutlineBtn label="닫기" onPress={() => setResult(null)} style={{ marginTop: spacing.sm }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* API 키 설정 모달 */}
      <Modal visible={showKeyModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.loadingOverlay}>
            <View style={[styles.keyModalBox, { backgroundColor: C.white }]}>
              <Text style={[styles.keyModalTitle, { color: C.t1 }]}>🔑 Mtrace API 키 설정</Text>
              <Text style={[styles.keyModalDesc, { color: C.t2 }]}>
                {'data.go.kr → 축산물이력제 API\n신청 후 발급받은 인증키를 입력하세요.'}
              </Text>
              <TextInput
                style={[styles.keyInput, { color: C.t1, borderColor: C.border, backgroundColor: C.bg }]}
                placeholder="인증키 붙여넣기"
                placeholderTextColor={C.t3}
                value={keyInput}
                onChangeText={setKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <OutlineBtn label="취소" onPress={() => setShowKeyModal(false)} style={{ flex: 1 }} />
                <PrimaryBtn label="저장" onPress={saveApiKey} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── 서류 OCR 허브 ─────────────────────────────────────────
const OCR_DOC_TYPES = [
  {
    icon: '📄',
    title: '거래명세서',
    desc: '부위·중량·단가 자동 추출\n→ 재고 자동 등록',
    color: '#3b82f6',
    badge: '재고 연동',
  },
  {
    icon: '🔬',
    title: '도축검사증명서',
    desc: '이력번호·도축일·원산지 추출\n→ 소비기한 자동 계산(+14일)',
    color: '#8b5cf6',
    badge: '재고 연동',
  },
  {
    icon: '🏥',
    title: '보건증',
    desc: '직원 이름·만료일 자동 추출\n→ 직원 서류 자동 업데이트',
    color: '#22c55e',
    badge: '직원 연동',
  },
  {
    icon: '📋',
    title: '위생교육이수증',
    desc: '이수일·만료일 자동 추출\n→ 직원 교육 이력 업데이트',
    color: '#06b6d4',
    badge: '직원 연동',
  },
];

function OCRHub({ navigation }) {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
      {/* 안내 배너 */}
      <View style={[styles.ocrBanner, { backgroundColor: C.pur + '14', borderColor: C.pur + '40' }]}>
        <Text style={{ fontSize: 36 }}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ocrBannerTitle, { color: C.t1 }]}>AI 서류 자동 인식</Text>
          <Text style={[styles.ocrBannerSub, { color: C.t3 }]}>
            서류를 촬영하면 텍스트를 읽어{'\n'}재고 및 직원 데이터를 자동으로 저장합니다.
          </Text>
        </View>
      </View>

      {/* 지원 서류 목록 */}
      <Text style={[styles.ocrSectionLabel, { color: C.t2 }]}>지원하는 서류 종류</Text>
      {OCR_DOC_TYPES.map(d => (
        <View key={d.title} style={[styles.ocrDocCard, { backgroundColor: C.white, borderColor: C.border, borderLeftColor: d.color, borderLeftWidth: 4 }]}>
          <Text style={{ fontSize: 28 }}>{d.icon}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={[styles.ocrDocTitle, { color: C.t1 }]}>{d.title}</Text>
              <View style={[styles.ocrDocBadge, { backgroundColor: d.color + '20' }]}>
                <Text style={[styles.ocrDocBadgeText, { color: d.color }]}>{d.badge}</Text>
              </View>
            </View>
            <Text style={[styles.ocrDocDesc, { color: C.t3 }]}>{d.desc}</Text>
          </View>
        </View>
      ))}

      {/* OCR 시작 버튼 */}
      <TouchableOpacity
        style={[styles.ocrStartBtn, { backgroundColor: C.pur }]}
        onPress={() => navigation.navigate('TraceOCR')}
        activeOpacity={0.85}
      >
        <Text style={styles.ocrStartIcon}>📷</Text>
        <View>
          <Text style={styles.ocrStartLabel}>서류 스캔 · AI OCR 시작</Text>
          <Text style={styles.ocrStartSub}>카메라로 촬영하거나 갤러리에서 선택</Text>
        </View>
      </TouchableOpacity>

      <Text style={[styles.ocrNotice, { color: C.t3 }]}>
        💡 인터넷 연결 필요 · 결과 확인 후 저장
      </Text>
    </ScrollView>
  );
}

const InfoSection = ({ title, children }) => (
  <View style={[styles.infoSection, { backgroundColor: C.white, borderColor: C.border }]}>
    <Text style={[styles.infoSectionTitle, { color: C.t1, backgroundColor: C.bg2, borderBottomColor: C.border }]}>
      {title}
    </Text>
    {children}
  </View>
);

const InfoRow = ({ label, value, highlight, highlightColor }) => (
  <View style={[styles.infoRow, { borderBottomColor: C.border + '50' }]}>
    <Text style={[styles.infoLabel, { color: C.t2 }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: C.t1 }, highlight && { color: highlightColor || C.red, fontWeight: '800' }]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  // V5 헤더
  v5Header:        { backgroundColor:'#FFFFFF', borderBottomWidth:1, borderBottomColor:'#E2E8F0', overflow:'hidden' },
  v5HeaderAccent:  { height:3, backgroundColor:'#B91C1C', position:'absolute', top:0, left:0, right:0 },
  v5HeaderRow:     { paddingHorizontal:20, paddingTop:16, paddingBottom:13, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  v5PageTitle:     { fontSize:22, fontWeight:'900', color:'#0F172A', letterSpacing:-0.6 },
  v5OnlineBadge:   { backgroundColor:'#DCFCE7', paddingHorizontal:12, paddingVertical:7, borderRadius:20 },
  v5OnlineTxt:     { fontSize:14, fontWeight:'700', color:'#15803D' },

  // 세그먼트 탭바
  segmentBar: { flexDirection: 'row', borderBottomWidth: 1 },
  segmentTab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  segmentText: { fontSize: 16, fontWeight: '700' },

  // OCR 허브
  ocrBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.lg, },
  ocrBannerTitle: { fontSize: fontSize.sm, fontWeight: '900', marginBottom: 4 },
  ocrBannerSub: { fontSize: fontSize.xs, lineHeight: 20 },
  ocrSectionLabel: { fontSize: fontSize.xs, fontWeight: '800', marginBottom: spacing.sm, letterSpacing: 0.5 },
  ocrDocCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, },
  ocrDocTitle: { fontSize: fontSize.sm, fontWeight: '900' },
  ocrDocBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  ocrDocBadgeText: { fontSize: 13, fontWeight: '800' },
  ocrDocDesc: { fontSize: fontSize.xs, lineHeight: 20 },
  ocrStartBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, },
  ocrStartIcon: { fontSize: 36 },
  ocrStartLabel: { color: '#fff', fontSize: fontSize.md, fontWeight: '900', marginBottom: 3 },
  ocrStartSub: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.xs, fontWeight: '600' },
  ocrNotice: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  permIcon: { fontSize: 56, marginBottom: spacing.md },
  permTitle: { fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.sm },
  permSub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 22 },

  scanLaunchArea: {
    margin: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, padding: spacing.lg, alignItems: 'center', ...shadow.sm,
  },
  scanTitle: { fontSize: fontSize.lg, fontWeight: '800', marginBottom: 6 },
  scanSub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  scanBigBtn: {
    borderRadius: radius.lg, paddingVertical: 18,
    paddingHorizontal: 48, alignItems: 'center', ...shadow.md,
  },
  scanBigIcon: { fontSize: 32, marginBottom: 8 },
  scanBigLabel: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },

  // 직접 입력 (lookup)
  lookupWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, borderWidth: 2,
    paddingLeft: spacing.md, marginBottom: spacing.md,
  },
  lookupInput: {
    flex: 1, fontSize: fontSize.sm, fontWeight: '600',
    paddingVertical: 14, paddingRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  lookupBtn: {
    width: 44, height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', margin: 4,
  },

  // 최근 조회 이력 (compact)
  recentTitle: { fontSize: fontSize.xs, fontWeight: '800', marginBottom: spacing.sm, letterSpacing: 0.5 },
  recentItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    marginBottom: 6,
  },
  recentNo:   { fontSize: fontSize.sm, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  recentInfo: { fontSize: fontSize.xs, marginTop: 2 },
  recentDate: { fontSize: fontSize.xs, flexShrink: 0, marginLeft: spacing.sm },

  // 기존 호환 스타일 유지
  histTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm },
  histCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  histTrace: { fontSize: fontSize.sm, fontWeight: '700', fontFamily: 'Courier' },
  histMeta: { fontSize: fontSize.xs, marginTop: 3 },
  histTime: { fontSize: fontSize.xxs, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 26 },

  camOverlay: { flex: 1 },
  camTopBar: { padding: spacing.md, paddingTop: 56 },
  camCloseBtn: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: radius.sm },
  camCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 300, height: 130, position: 'relative', marginBottom: 24 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#e8950a', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  camHint: { color: '#fff', fontSize: fontSize.sm, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm,
  },
  offlineBannerText: { flex: 1, fontSize: fontSize.xs, fontWeight: '700' },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.sm, borderWidth: 1, padding: spacing.md,
  },
  syncBannerTitle: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: 2 },
  syncBannerSub: { fontSize: fontSize.xxs },
  pendingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pendingBadgeText: { fontSize: 13, fontWeight: '800' },

  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { borderRadius: radius.lg, padding: 32, alignItems: 'center', ...shadow.md },
  loadingText: { marginTop: 14, fontSize: fontSize.sm, fontWeight: '600' },

  keyModalBox: { margin: spacing.lg, borderRadius: radius.lg, padding: spacing.lg, width: '90%', ...shadow.md },
  keyModalTitle: { fontSize: fontSize.md, fontWeight: '900', marginBottom: spacing.sm },
  keyModalDesc: { fontSize: fontSize.xs, lineHeight: 20, marginBottom: spacing.md },
  keyInput: { borderWidth: 1.5, borderRadius: radius.sm, padding: spacing.sm, fontSize: fontSize.xs, minHeight: 60 },

  resultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1,
  },
  resultTitle: { fontSize: fontSize.lg, fontWeight: '800' },
  resultClose: { fontSize: 20, padding: 4 },
  traceBox: {
    borderRadius: radius.md, borderWidth: 1.5,
    padding: spacing.md, marginBottom: spacing.md, alignItems: 'center',
  },
  traceLabel: { fontSize: fontSize.xxs, fontWeight: '700', marginBottom: 4 },
  traceNo: { fontSize: fontSize.lg, fontWeight: '900', fontFamily: 'Courier', letterSpacing: 1 },
  traceTime: { fontSize: fontSize.xxs, marginTop: 4 },

  infoSection: {
    borderRadius: radius.md, borderWidth: 1,
    marginBottom: spacing.sm, overflow: 'hidden', ...shadow.sm,
  },
  infoSectionTitle: {
    fontSize: fontSize.sm, fontWeight: '800',
    padding: spacing.md, borderBottomWidth: 1,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: fontSize.sm, fontWeight: '600' },
  infoValue: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 16 },

});
