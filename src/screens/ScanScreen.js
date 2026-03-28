import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, shadow, fontSize, spacing } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn, StatusBadge } from '../components/UI';

const OFFLINE_QUEUE_KEY = '@meatbig_scan_queue';
const SCAN_HISTORY_KEY = '@meatbig_scan_history';

// ─── 공공 API 모의 응답 ────────────────────────────────────
const MOCK_TRACE_DB = {
  '002091700003743': {
    traceNo: '002091700003743', animalType: '한우', grade: '1++',
    birthDate: '2022.03.15', farmName: '○○한우농장 (경북 안동)',
    slaughterDate: '2024.10.20', slaughterPlace: '○○도축장 (HACCP 인증)',
    weight: '462kg', inspection: '적합',
  },
  '002091800012456': {
    traceNo: '002091800012456', animalType: '한우', grade: '1+',
    birthDate: '2021.11.08', farmName: '△△한우목장 (강원 횡성)',
    slaughterDate: '2024.09.05', slaughterPlace: '△△도축장 (HACCP 인증)',
    weight: '498kg', inspection: '적합',
  },
};

async function lookupTrace(traceNo) {
  await new Promise(r => setTimeout(r, 800));
  const clean = traceNo.replace(/\D/g, '');
  return MOCK_TRACE_DB[clean] || {
    traceNo: clean, animalType: '조회 완료', grade: 'N/A',
    birthDate: 'N/A', farmName: '등록된 이력 없음',
    slaughterDate: 'N/A', slaughterPlace: 'N/A', weight: 'N/A', inspection: 'N/A',
  };
}

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

export default function ScanScreen() {
  const { isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // 앱 시작 시 히스토리 + 큐 불러오기
  useEffect(() => {
    (async () => {
      try {
        const [hist, queue] = await Promise.all([
          AsyncStorage.getItem(SCAN_HISTORY_KEY),
          AsyncStorage.getItem(OFFLINE_QUEUE_KEY),
        ]);
        if (hist) setHistory(JSON.parse(hist));
        if (queue) setPendingQueue(JSON.parse(queue));
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

  const handleBarcode = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setLoading(true);
    try {
      const online = await checkOnline();
      setIsOnline(online);
      let info;
      if (online) {
        info = await lookupTrace(data);
      } else {
        // 오프라인: 기본 정보만 저장하고 큐에 추가
        info = {
          traceNo: data.replace(/\D/g, ''), animalType: '오프라인 스캔',
          grade: '—', birthDate: '—', farmName: '서버 미연결 (동기화 대기)',
          slaughterDate: '—', slaughterPlace: '—', weight: '—', inspection: '—',
        };
      }
      const entry = { ...info, rawData: data, scanTime: new Date().toLocaleString('ko-KR'), synced: online };
      setResult(entry);
      const newHistory = [entry, ...history.slice(0, 9)];
      setHistory(newHistory);
      await saveHistory(newHistory);

      if (!online) {
        const newQueue = [entry, ...pendingQueue];
        setPendingQueue(newQueue);
        await saveQueue(newQueue);
      }
    } catch {
      Alert.alert('오류', '이력 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.ac} />
    </View>
  );

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={[styles.permTitle, { color: colors.tx }]}>카메라 권한 필요</Text>
        <Text style={[styles.permSub, { color: colors.t2 }]}>이력번호 바코드 스캔을 위해{'\n'}카메라 접근 권한이 필요합니다</Text>
        <PrimaryBtn label="권한 허용" onPress={requestPermission} style={{ marginTop: 20, paddingHorizontal: 40 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 오프라인 / 동기화 배너 */}
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.yw + '22', borderColor: colors.yw + '60' }]}>
          <Text style={[styles.offlineBannerText, { color: colors.yw }]}>
            📡 오프라인 모드 — 스캔 결과가 로컬에 저장됩니다
          </Text>
        </View>
      )}
      {pendingQueue.length > 0 && (
        <TouchableOpacity
          style={[styles.syncBanner, { backgroundColor: colors.a2 + '18', borderColor: colors.a2 + '40' }]}
          onPress={trySyncQueue}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.syncBannerTitle, { color: colors.a2 }]}>
              🔄 미동기화 {pendingQueue.length}건
            </Text>
            <Text style={[styles.syncBannerSub, { color: colors.t3 }]}>탭하여 서버에 동기화</Text>
          </View>
          {syncing
            ? <ActivityIndicator size="small" color={colors.a2} />
            : <Text style={{ color: colors.a2, fontSize: 18 }}>↑</Text>
          }
        </TouchableOpacity>
      )}

      {/* 스캔 버튼 */}
      <View style={[styles.scanLaunchArea, { backgroundColor: colors.s1, borderColor: colors.bd }]}>
        <Text style={[styles.scanTitle, { color: colors.tx }]}>🏷️ 축산물 이력번호 조회</Text>
        <Text style={[styles.scanSub, { color: colors.t2 }]}>
          바코드·QR코드를 스캔하면{'\n'}도축 정보·등급·원산지를 즉시 확인합니다
        </Text>
        <TouchableOpacity
          style={[styles.scanBigBtn, { backgroundColor: colors.ac }]}
          onPress={() => { setScanning(true); setScanned(false); }}
        >
          <Text style={styles.scanBigIcon}>📷</Text>
          <Text style={styles.scanBigLabel}>바코드 스캔 시작</Text>
        </TouchableOpacity>
      </View>

      {/* 스캔 이력 */}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {history.length > 0 && (
          <>
            <Text style={[styles.histTitle, { color: colors.tx }]}>최근 조회 이력</Text>
            {history.map((h, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.histCard, { backgroundColor: colors.s1, borderColor: colors.bd }]}
                onPress={() => setResult(h)}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.histTrace, { color: colors.tx }]}>{h.traceNo}</Text>
                    {h.synced === false && (
                      <View style={[styles.pendingBadge, { backgroundColor: colors.yw + '30' }]}>
                        <Text style={[styles.pendingBadgeText, { color: colors.yw }]}>미동기화</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.histMeta, { color: colors.t2 }]}>{h.animalType} · {h.grade}등급 · {h.farmName}</Text>
                  <Text style={[styles.histTime, { color: colors.t3 }]}>{h.scanTime}</Text>
                </View>
                <Text style={{ fontSize: 18, color: colors.t3 }}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {history.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.t3 }]}>스캔 이력이 없습니다{'\n'}바코드를 스캔해보세요</Text>
          </View>
        )}
      </ScrollView>

      {/* 카메라 모달 */}
      <Modal visible={scanning} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'datamatrix'] }}
          >
            <View style={styles.camOverlay}>
              <View style={styles.camTopBar}>
                <TouchableOpacity onPress={() => setScanning(false)} style={styles.camCloseBtn}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕ 닫기</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.camCenter}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.camHint}>바코드를 네모 안에 맞춰주세요</Text>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* 로딩 */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: colors.s1 }]}>
            <ActivityIndicator size="large" color={colors.ac} />
            <Text style={[styles.loadingText, { color: colors.t2 }]}>이력 정보 조회 중...</Text>
          </View>
        </View>
      </Modal>

      {/* 결과 모달 */}
      <Modal visible={!!result && !loading} animationType="slide" presentationStyle="pageSheet">
        {result && (
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={[styles.resultHeader, { borderBottomColor: colors.bd, backgroundColor: colors.s1 }]}>
              <Text style={[styles.resultTitle, { color: colors.tx }]}>🏷️ 이력 조회 결과</Text>
              <TouchableOpacity onPress={() => setResult(null)}>
                <Text style={[styles.resultClose, { color: colors.t2 }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
              <View style={[styles.traceBox, { backgroundColor: colors.a2 + '18', borderColor: colors.a2 + '50' }]}>
                <Text style={[styles.traceLabel, { color: colors.t2 }]}>이력번호</Text>
                <Text style={[styles.traceNo, { color: colors.a2 }]}>{result.traceNo}</Text>
                <Text style={[styles.traceTime, { color: colors.t3 }]}>조회: {result.scanTime}</Text>
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
                  highlight={result.inspection === '적합'} highlightColor={colors.gn} />
              </InfoSection>

              {result.synced === false && (
                <View style={[styles.offlineBanner, { marginHorizontal: 0, marginBottom: spacing.sm }]}>
                  <Text style={[styles.offlineBannerText, { color: colors.yw }]}>
                    ⚠️ 오프라인 스캔 — 인터넷 연결 시 자동으로 서버에 동기화됩니다
                  </Text>
                </View>
              )}
              <PrimaryBtn label="✓ 숙성 관리에 등록" color={colors.ac}
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
    </View>
  );
}

const InfoSection = ({ title, children }) => (
  <View style={[styles.infoSection, { backgroundColor: colors.s1, borderColor: colors.bd }]}>
    <Text style={[styles.infoSectionTitle, { color: colors.tx, backgroundColor: colors.s2, borderBottomColor: colors.bd }]}>
      {title}
    </Text>
    {children}
  </View>
);

const InfoRow = ({ label, value, highlight, highlightColor }) => (
  <View style={[styles.infoRow, { borderBottomColor: colors.bd + '50' }]}>
    <Text style={[styles.infoLabel, { color: colors.t2 }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: colors.tx }, highlight && { color: highlightColor || colors.ac, fontWeight: '800' }]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
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
  scanFrame: { width: 240, height: 240, position: 'relative', marginBottom: 24 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#e8950a', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  camHint: { color: '#fff', fontSize: fontSize.sm, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4 },

  offlineBanner: {
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm,
  },
  offlineBannerText: { fontSize: fontSize.xs, fontWeight: '700', textAlign: 'center' },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, padding: spacing.md,
  },
  syncBannerTitle: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: 2 },
  syncBannerSub: { fontSize: fontSize.xxs },
  pendingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  pendingBadgeText: { fontSize: 10, fontWeight: '800' },

  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { borderRadius: radius.lg, padding: 32, alignItems: 'center', ...shadow.md },
  loadingText: { marginTop: 14, fontSize: fontSize.sm, fontWeight: '600' },

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
