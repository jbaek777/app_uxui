import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, shadow, fontSize, spacing } from '../theme';
import { PrimaryBtn, OutlineBtn, StatusBadge } from '../components/UI';

// ─── 공공 API 모의 응답 (실제 연동 시 교체) ──────────────
const MOCK_TRACE_DB = {
  '002091700003743': {
    traceNo: '002091700003743',
    animalType: '한우',
    grade: '1++',
    birthDate: '2022.03.15',
    farmName: '○○한우농장 (경북 안동)',
    slaughterDate: '2024.10.20',
    slaughterPlace: '○○도축장 (HACCP 인증)',
    weight: '462kg',
    inspection: '적합',
  },
  '002091800012456': {
    traceNo: '002091800012456',
    animalType: '한우',
    grade: '1+',
    birthDate: '2021.11.08',
    farmName: '△△한우목장 (강원 횡성)',
    slaughterDate: '2024.09.05',
    slaughterPlace: '△△도축장 (HACCP 인증)',
    weight: '498kg',
    inspection: '적합',
  },
};

async function lookupTrace(traceNo) {
  // 실제 연동: https://www.mtrace.go.kr/ 공공 API
  // const res = await fetch(`https://mtrace.go.kr/api/traceNo/${traceNo}?serviceKey=YOUR_KEY`);
  await new Promise(r => setTimeout(r, 800)); // 로딩 시뮬레이션
  const clean = traceNo.replace(/\D/g, '');
  return MOCK_TRACE_DB[clean] || {
    traceNo: clean,
    animalType: '조회 완료',
    grade: 'N/A',
    birthDate: 'N/A',
    farmName: '등록된 이력 없음',
    slaughterDate: 'N/A',
    slaughterPlace: 'N/A',
    weight: 'N/A',
    inspection: 'N/A',
  };
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [history, setHistory] = useState([]);

  const handleBarcode = async ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setLoading(true);
    try {
      const info = await lookupTrace(data);
      setResult({ ...info, rawData: data, scanTime: new Date().toLocaleString('ko-KR') });
      setHistory(prev => [{ ...info, rawData: data, scanTime: new Date().toLocaleString('ko-KR') }, ...prev.slice(0, 9)]);
    } catch {
      Alert.alert('오류', '이력 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator color={colors.ac} /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>카메라 권한 필요</Text>
        <Text style={styles.permSub}>이력번호 바코드 스캔을 위해{'\n'}카메라 접근 권한이 필요합니다</Text>
        <PrimaryBtn label="권한 허용" onPress={requestPermission} style={{ marginTop: 20, paddingHorizontal: 40 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 스캔 버튼 */}
      <View style={styles.scanLaunchArea}>
        <Text style={styles.scanTitle}>🏷️ 축산물 이력번호 조회</Text>
        <Text style={styles.scanSub}>바코드·QR코드를 스캔하면{'\n'}도축 정보·등급·원산지를 즉시 확인합니다</Text>
        <TouchableOpacity style={styles.scanBigBtn} onPress={() => { setScanning(true); setScanned(false); }}>
          <Text style={styles.scanBigIcon}>📷</Text>
          <Text style={styles.scanBigLabel}>바코드 스캔 시작</Text>
        </TouchableOpacity>
      </View>

      {/* 스캔 이력 */}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {history.length > 0 && (
          <>
            <Text style={styles.histTitle}>최근 조회 이력</Text>
            {history.map((h, i) => (
              <TouchableOpacity key={i} style={styles.histCard} onPress={() => setResult(h)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTrace}>{h.traceNo}</Text>
                  <Text style={styles.histMeta}>{h.animalType} · {h.grade}등급 · {h.farmName}</Text>
                  <Text style={styles.histTime}>{h.scanTime}</Text>
                </View>
                <Text style={{ fontSize: 18, color: colors.t3 }}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {history.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>스캔 이력이 없습니다{'\n'}바코드를 스캔해보세요</Text>
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
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.ac} />
            <Text style={styles.loadingText}>이력 정보 조회 중...</Text>
          </View>
        </View>
      </Modal>

      {/* 결과 모달 */}
      <Modal visible={!!result && !loading} animationType="slide" presentationStyle="pageSheet">
        {result && (
          <View style={{ flex: 1, backgroundColor: colors.s1 }}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>🏷️ 이력 조회 결과</Text>
              <TouchableOpacity onPress={() => setResult(null)}>
                <Text style={styles.resultClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
              {/* 이력번호 */}
              <View style={styles.traceBox}>
                <Text style={styles.traceLabel}>이력번호</Text>
                <Text style={styles.traceNo}>{result.traceNo}</Text>
                <Text style={styles.traceTime}>조회: {result.scanTime}</Text>
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

              <PrimaryBtn label="✓ 숙성 관리에 등록" color={colors.ac}
                onPress={() => { Alert.alert('등록', `이력번호 ${result.traceNo}를 숙성 관리에 등록합니다.\n(AgingScreen 연동 예정)`); setResult(null); }}
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
  <View style={styles.infoSection}>
    <Text style={styles.infoSectionTitle}>{title}</Text>
    {children}
  </View>
);

const InfoRow = ({ label, value, highlight, highlightColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, highlight && { color: highlightColor || colors.ac, fontWeight: '800' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  permIcon: { fontSize: 56, marginBottom: spacing.md },
  permTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx, marginBottom: spacing.sm },
  permSub: { fontSize: fontSize.sm, color: colors.t2, textAlign: 'center', lineHeight: 22 },

  scanLaunchArea: {
    backgroundColor: colors.s1, margin: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.bd, padding: spacing.lg, alignItems: 'center', ...shadow.sm,
  },
  scanTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.tx, marginBottom: 6 },
  scanSub: { fontSize: fontSize.sm, color: colors.t2, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  scanBigBtn: {
    backgroundColor: colors.ac, borderRadius: radius.lg, paddingVertical: 18,
    paddingHorizontal: 48, alignItems: 'center', ...shadow.md,
  },
  scanBigIcon: { fontSize: 32, marginBottom: 8 },
  scanBigLabel: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },

  histTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: spacing.sm },
  histCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  histTrace: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx, fontFamily: 'Courier' },
  histMeta: { fontSize: fontSize.xs, color: colors.t2, marginTop: 3 },
  histTime: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { fontSize: fontSize.md, color: colors.t3, textAlign: 'center', lineHeight: 26 },

  // 카메라
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

  // 로딩
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { backgroundColor: colors.s1, borderRadius: radius.lg, padding: 32, alignItems: 'center', ...shadow.md },
  loadingText: { marginTop: 14, fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },

  // 결과
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.bd,
  },
  resultTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.tx },
  resultClose: { fontSize: 20, color: colors.t2, padding: 4 },
  traceBox: {
    backgroundColor: colors.a2 + '18', borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.a2 + '50', padding: spacing.md, marginBottom: spacing.md, alignItems: 'center',
  },
  traceLabel: { fontSize: fontSize.xxs, color: colors.t2, fontWeight: '700', marginBottom: 4 },
  traceNo: { fontSize: fontSize.lg, fontWeight: '900', color: colors.a2, fontFamily: 'Courier', letterSpacing: 1 },
  traceTime: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 4 },

  infoSection: {
    backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.bd, marginBottom: spacing.sm, overflow: 'hidden', ...shadow.sm,
  },
  infoSectionTitle: {
    fontSize: fontSize.sm, fontWeight: '800', color: colors.tx,
    padding: spacing.md, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.bd,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.bd + '50',
  },
  infoLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },
  infoValue: { fontSize: fontSize.sm, color: colors.tx, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 16 },
});
