/**
 * CarcassWeighingScreen.js — 계근 입고(원두 분할) 5단계 위저드
 *
 * Step 1  원두 정보 (품종, 이력번호, 공급처, 구매일)
 * Step 2  3단 계근 (산피 → 지육 → 발골)
 * Step 3  부대비용 (운반/하차/중개/우족작업)
 * Step 4  부위별 계근 (+ 부위 추가/삭제)
 * Step 5  확정 (재고로 배치 등록)
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import {
  getStandardParts, getCommonExtras, SPECIES_OPTIONS, DEFAULT_EXTRAS,
} from '../data/standardParts';
import { carcassStore } from '../lib/carcassStore';
import { meatStore } from '../lib/dataStore';
import { lookupTrace } from '../lib/traceApi';

const STEP_LABELS = ['원두정보', '3단계근', '부대비용', '부위계근', '확정'];

// 숫자 변환 헬퍼
const num = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const fmt = (n, digits = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const rounded = digits > 0 ? Number(n).toFixed(digits) : Math.round(Number(n));
  return Number(rounded).toLocaleString('ko-KR', { maximumFractionDigits: digits });
};

export default function CarcassWeighingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Step 1
  const [species, setSpecies] = useState('한우');
  const [traceNo, setTraceNo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  // 이력번호 조회 결과 (자동 채움용 + 요약 카드 표시)
  const [traceInfo, setTraceInfo] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // ── Step 2 (3단 계근)
  const [liveWeight, setLiveWeight] = useState('');
  const [liveUnitPrice, setLiveUnitPrice] = useState('');
  const [carcassWeight, setCarcassWeight] = useState('');
  const [trimmedWeight, setTrimmedWeight] = useState('');
  const [fatWeight, setFatWeight] = useState('');

  // ── Step 3 (부대비용)
  const [extras, setExtras] = useState({ ...DEFAULT_EXTRAS });

  // ── Step 4 (부위별)
  // parts: [{ key, name, order, enabled, weight, priceKg, isCustom, group, suggestedRatio, sampleCount }]
  const [parts, setParts] = useState([]);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [newPartPrice, setNewPartPrice] = useState('');
  // 매장별 과거 평균 수율 맵 { part_name: { avg_ratio, sample_count, ... } }
  const [yieldStats, setYieldStats] = useState({});
  // 사용자가 "삭제(숨김)"한 표준 부위명 집합 — 프리셋에 영속 저장됨
  const [partsDisabled, setPartsDisabled] = useState(() => new Set());

  // 품종 변경 / 최초 진입 시 프리셋 + 과거 평균 수율 로드
  // ※ 지난 세션에서 저장한 매장 커스터마이징(사용 부위/단가/숨긴 부위/커스텀 부위)이 그대로 복원됨
  const presetLoadedRef = useRef(false);
  useEffect(() => {
    (async () => {
      const std = getStandardParts(species);
      const [preset, stats] = await Promise.all([
        carcassStore.loadPreset(species),
        carcassStore.loadYieldStats(species),
      ]);
      setYieldStats(stats || {});

      // 지난번에 "삭제(숨김)"한 표준 부위 복원
      const disabledSet = new Set(preset?.parts_disabled || []);
      setPartsDisabled(disabledSet);

      // 커스텀 부위 (매장에서 추가한 비표준 부위)
      const custom = (preset?.custom_parts || []).map((p, i) => {
        const s = stats?.[p.name];
        return {
          key: `c-${p.name}`, name: p.name, order: p.order ?? (1000 + i),
          group: p.group || '커스텀',
          enabled: true, weight: '', priceKg: String(p.defaultPrice || ''),
          isCustom: true,
          suggestedRatio: s?.avg_ratio || 0,
          sampleCount:    s?.sample_count || 0,
        };
      });

      const enabledMap = preset?.parts_enabled
        ? Object.fromEntries((preset.parts_enabled || []).map(n => [n, true]))
        : null;
      const pricesMap = preset?.default_prices || {};

      // 표준 부위 — 숨긴 부위는 제외, 체크/단가는 프리셋 우선 복원
      const standardParts = std
        .filter(p => !disabledSet.has(p.name))
        .map((p) => {
          const s = stats?.[p.name];
          return {
            key: `s-${p.name}`,
            name: p.name,
            order: p.order,
            group: p.group || '기타',
            enabled: enabledMap ? !!enabledMap[p.name] : true,
            weight: '',
            priceKg: String(pricesMap[p.name] ?? p.defaultPrice ?? ''),
            isCustom: false,
            avgRatio: p.avgRatio,                     // 표준 평균 (식약처 기준)
            suggestedRatio: s?.avg_ratio || 0,        // 매장 실제 평균
            sampleCount:    s?.sample_count || 0,
          };
        });

      // 프리셋에 부대비용 기본값 있으면 반영 (최초 1회)
      if (!presetLoadedRef.current && preset?.default_extras) {
        setExtras(prev => ({ ...prev, ...preset.default_extras }));
      }
      presetLoadedRef.current = true;
      setParts([...standardParts, ...custom]);
    })();
  }, [species]);

  // ── 파생 계산 ─────────────────────────────────
  const liveCost       = num(liveWeight) * num(liveUnitPrice);
  const extrasTotal    = num(extras.transport) + num(extras.unload) + num(extras.broker) + num(extras.hoof);
  const totalCost      = liveCost + extrasTotal;
  const carcassKgPrice = num(carcassWeight) > 0 ? liveCost / num(carcassWeight) : 0;
  const trimmedKgPrice = num(trimmedWeight) > 0 ? totalCost / num(trimmedWeight) : 0;
  const yieldLive2Car  = num(liveWeight) > 0 ? num(carcassWeight) / num(liveWeight) : 0;
  const yieldCar2Trim  = num(carcassWeight) > 0 ? num(trimmedWeight) / num(carcassWeight) : 0;

  // 부위 합계
  const enabledParts       = parts.filter(p => p.enabled);
  const totalPartWeight    = enabledParts.reduce((s, p) => s + num(p.weight), 0);
  const totalSaleAmount    = enabledParts.reduce((s, p) => s + num(p.weight) * num(p.priceKg), 0);
  const weightMatchDiff    = num(trimmedWeight) - totalPartWeight; // 0 가까울수록 좋음
  const weightMatchPct     = num(trimmedWeight) > 0 ? totalPartWeight / num(trimmedWeight) : 0;
  const expectedMargin     = totalSaleAmount - totalCost;
  const marginPct          = totalCost > 0 ? expectedMargin / totalCost : 0;

  // 부위별 계산값
  function partStats(p) {
    const w = num(p.weight);
    const ratio = num(trimmedWeight) > 0 ? w / num(trimmedWeight) : 0;
    const allocatedCost = ratio * totalCost;
    const saleAmount    = w * num(p.priceKg);
    const profit        = saleAmount - allocatedCost;
    return { w, ratio, allocatedCost, saleAmount, profit };
  }

  // ── 단계 이동 검증 ──
  function canNext() {
    if (step === 1) return !!species;
    if (step === 2) return num(liveWeight) > 0 && num(trimmedWeight) > 0;
    if (step === 3) return true;
    if (step === 4) return totalPartWeight > 0;
    return true;
  }

  // ── 이력번호 조회 (EKAPE API) ─────────────────────────
  async function handleTraceLookup() {
    const clean = (traceNo || '').replace(/\D/g, '');
    if (clean.length < 12) {
      Alert.alert('이력번호 오류', '이력번호는 12자리 이상입니다.');
      return;
    }
    if (traceLoading) return;
    setTraceLoading(true);
    try {
      const info = await lookupTrace(clean);
      if (!info) {
        Alert.alert('조회 실패', '이력번호를 다시 확인해 주세요.');
        setTraceInfo(null);
        return;
      }
      setTraceInfo(info);

      // 자동 채움 (기존 입력 존중: 비어있을 때만)
      if (info.species && species !== info.species) setSpecies(info.species);
      if (!supplier && info.slaughterPlaceName) setSupplier(info.slaughterPlaceName);
      if (info.slaughterDateIso) setPurchaseDate(info.slaughterDateIso);

      if (info.animalType === '조회 불가') {
        Alert.alert(
          'API 키 미설정',
          '실제 이력 데이터를 조회하려면 스캔 화면에서 축산물이력 API 키를 먼저 등록하세요.'
        );
      } else if (info.animalType === '이력 없음') {
        Alert.alert('이력 없음', '등록되지 않은 이력번호입니다.');
      }
    } catch (e) {
      Alert.alert('조회 실패', e?.message || '네트워크 오류');
    } finally {
      setTraceLoading(false);
    }
  }

  // ── Step 4: 매장 평균 수율로 발골 무게 자동 배분 ────
  function fillByAverageYield() {
    const trimmed = num(trimmedWeight);
    if (trimmed <= 0) {
      Alert.alert('발골 무게를 먼저 입력하세요', 'Step 2에서 발골(기름뺀지육) 무게를 입력해야 평균 수율을 적용할 수 있습니다.');
      return;
    }
    // 과거 데이터(suggestedRatio>0) 우선, 없으면 표준 평균(avgRatio)
    const hasAnyReal = parts.some(p => (p.suggestedRatio || 0) > 0);
    const hasAnyStd  = parts.some(p => (p.avgRatio || 0) > 0);
    if (!hasAnyReal && !hasAnyStd) {
      Alert.alert('평균 수율 데이터가 없습니다', '한 번 저장하면 그 이후부터 매장 평균이 집계됩니다.');
      return;
    }
    setParts(prev => prev.map(p => {
      const ratio = (p.suggestedRatio && p.suggestedRatio > 0)
        ? p.suggestedRatio
        : (p.avgRatio || 0);
      if (!ratio || !p.enabled) return p;
      const w = trimmed * ratio;
      return { ...p, weight: w.toFixed(2) };
    }));
    Alert.alert(
      '평균값 채움',
      hasAnyReal
        ? '매장 과거 평균 수율로 각 부위 무게가 제안되었습니다. 실제 계근 후 수정하세요.'
        : '표준 평균 수율(Excel 기준)로 각 부위 무게가 제안되었습니다. 실제 계근 후 수정하세요.'
    );
  }

  // ── Step 4: 부위 조작 ──
  function togglePart(key) {
    setParts(prev => prev.map(p => p.key === key ? { ...p, enabled: !p.enabled } : p));
  }
  function updatePart(key, field, value) {
    setParts(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p));
  }
  function addCustomPart() {
    const name = newPartName.trim();
    if (!name) { Alert.alert('부위명을 입력하세요'); return; }
    if (parts.some(p => p.name === name)) { Alert.alert('이미 있는 부위명입니다'); return; }
    setParts(prev => [...prev, {
      key: `c-${Date.now()}`,
      name,
      order: 1000 + prev.length,
      enabled: true,
      weight: '',
      priceKg: newPartPrice || '0',
      isCustom: true,
    }]);
    setNewPartName('');
    setNewPartPrice('');
    setAddPartOpen(false);
  }
  function removeCustomPart(key) {
    setParts(prev => prev.filter(p => p.key !== key));
  }

  // 표준 부위 "삭제" = 앞으로 이 매장 목록에서 숨김 (parts_disabled 프리셋에 저장)
  function removeStandardPart(key, name) {
    Alert.alert(
      `"${name}" 부위 숨기기`,
      `다음번부터 이 부위를 목록에서 숨길까요?\n(언제든 "기본 부위 복원"으로 되살릴 수 있습니다)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '숨김', style: 'destructive',
          onPress: () => {
            setParts(prev => prev.filter(p => p.key !== key));
            setPartsDisabled(prev => {
              const n = new Set(prev); n.add(name); return n;
            });
          },
        },
      ]
    );
  }

  // 기본 39부위 전체 복원 (숨긴 부위 모두 되살림)
  function restoreDefaultParts() {
    if (partsDisabled.size === 0) {
      Alert.alert('이미 기본 상태입니다', '숨김 처리된 표준 부위가 없습니다.');
      return;
    }
    Alert.alert(
      '기본 부위 복원',
      `숨겨둔 표준 부위 ${partsDisabled.size}개를 모두 되살릴까요?\n(커스텀 추가한 부위는 그대로 유지됩니다)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          onPress: () => {
            const std = getStandardParts(species);
            setParts(prev => {
              const existingNames = new Set(prev.map(p => p.name));
              const pricesCache = Object.fromEntries(prev.map(p => [p.name, p.priceKg]));
              const stats = yieldStats || {};
              const restored = std
                .filter(p => !existingNames.has(p.name))
                .map(p => {
                  const s = stats?.[p.name];
                  return {
                    key: `s-${p.name}`, name: p.name, order: p.order,
                    group: p.group || '기타',
                    enabled: true, weight: '',
                    priceKg: String(pricesCache[p.name] ?? p.defaultPrice ?? ''),
                    isCustom: false, avgRatio: p.avgRatio,
                    suggestedRatio: s?.avg_ratio || 0,
                    sampleCount:    s?.sample_count || 0,
                  };
                });
              return [...prev, ...restored];
            });
            setPartsDisabled(new Set());
          },
        },
      ]
    );
  }

  // 빠른 추가: 자주 쓰는 부산물을 한 탭에 커스텀 부위로 추가
  function quickAddExtra(extra) {
    if (parts.some(p => p.name === extra.name)) {
      Alert.alert('이미 추가되어 있습니다');
      return;
    }
    setParts(prev => [...prev, {
      key: `c-${Date.now()}-${extra.name}`,
      name: extra.name,
      order: 1000 + prev.length,
      group: '부산물/기타',
      enabled: true,
      weight: '',
      priceKg: String(extra.defaultPrice || ''),
      isCustom: true,
      suggestedRatio: 0,
      sampleCount: 0,
    }]);
  }

  // 삭제(숨긴) 표준 부위 단건 복원 (모달에서 사용)
  function undeleteStandardPart(name) {
    const std = getStandardParts(species);
    const def = std.find(p => p.name === name);
    if (!def) return;
    const s = yieldStats?.[name];
    setParts(prev => [
      ...prev,
      {
        key: `s-${def.name}`, name: def.name, order: def.order,
        group: def.group || '기타',
        enabled: true, weight: '',
        priceKg: String(def.defaultPrice || ''),
        isCustom: false, avgRatio: def.avgRatio,
        suggestedRatio: s?.avg_ratio || 0,
        sampleCount:    s?.sample_count || 0,
      },
    ]);
    setPartsDisabled(prev => {
      const n = new Set(prev); n.delete(name); return n;
    });
  }

  // ── 저장 ─────────────────────────────────────
  async function handleFinish() {
    if (saving) return;
    if (enabledParts.length === 0) {
      Alert.alert('부위를 하나 이상 입력하세요');
      return;
    }
    setSaving(true);
    try {
      // Supabase용 세션 페이로드
      const sessionPayload = {
        species, trace_no: traceNo || null,
        supplier_name: supplier || null,
        purchase_date: purchaseDate || null,
        live_weight_kg: num(liveWeight) || null,
        live_unit_price: num(liveUnitPrice) || null,
        carcass_weight_kg: num(carcassWeight) || null,
        trimmed_weight_kg: num(trimmedWeight) || null,
        fat_weight_kg: num(fatWeight) || null,
        transport_cost: num(extras.transport),
        unload_cost: num(extras.unload),
        broker_cost: num(extras.broker),
        hoof_cost: num(extras.hoof),
        total_cost: totalCost,
        trimmed_unit_price: trimmedKgPrice,
        expected_revenue: totalSaleAmount,
        expected_margin: expectedMargin,
        margin_pct: marginPct,
        status: 'done',
        notes: null,
      };

      const partRows = enabledParts.map(p => {
        const s = partStats(p);
        return {
          part_name: p.name,
          part_order: p.order,
          is_custom: !!p.isCustom,
          weight_kg: s.w,
          ratio: s.ratio,
          allocated_cost: s.allocatedCost,
          retail_price_kg: num(p.priceKg),
          retail_price_600g: num(p.priceKg) * 0.6,
          sale_amount: s.saleAmount,
          profit: s.profit,
        };
      });

      // 1) 세션 저장
      await carcassStore.saveSession(sessionPayload, partRows);

      // 2) 프리셋 업데이트 (매장별 커스텀 부위/활성 부위/기본단가/숨김 목록 저장)
      const customPartList = parts
        .filter(p => p.isCustom)
        .map(p => ({
          name: p.name, order: p.order,
          group: p.group || '커스텀',
          defaultPrice: num(p.priceKg),
        }));
      const enabledNames = parts.filter(p => p.enabled).map(p => p.name);
      const defaultPrices = Object.fromEntries(parts.map(p => [p.name, num(p.priceKg)]));
      await carcassStore.savePreset(species, {
        parts_enabled:  enabledNames,
        parts_disabled: [...partsDisabled],          // 🗑 숨긴 표준 부위
        custom_parts:   customPartList,
        default_prices: defaultPrices,
        default_extras: {
          transport: num(extras.transport),
          unload:    num(extras.unload),
          broker:    num(extras.broker),
          hoof:      num(extras.hoof),
        },
      });

      // 3) 기존 재고(meat_inventory)에 부위별 row 추가
      const existing = await meatStore.load([]);
      const today = new Date().toLocaleDateString('ko-KR');
      const expireDate = (() => {
        const d = new Date(); d.setDate(d.getDate() + 7);
        return d.toISOString().slice(0, 10);
      })();
      const originLabel = `${species}${traceNo ? ` (${traceNo.slice(-6)})` : ''}`;
      const newItems = enabledParts.map((p, idx) => {
        const s = partStats(p);
        const buyPrice = s.w > 0 ? Math.round(s.allocatedCost / s.w) : 0;
        return {
          id: `${Date.now()}-${idx}`,
          cut: p.name,
          origin: originLabel,
          qty: s.w, unit: 'kg',
          buyPrice,
          sellPrice: Math.round(num(p.priceKg)),
          expire: expireDate,
          dday: 7,
          status: 'ok',
          sold: false, soldDate: null,
          editCount: 0, editLog: [],
          inboundDate: today,
          supplierName: supplier || '',
          notes: `계근입고 · ${species}`,
        };
      });
      await meatStore.save([...existing, ...newItems]);

      Alert.alert(
        '저장 완료',
        `${species} 한 마리가 ${enabledParts.length}개 부위로 분할 등록되었습니다.\n\n예상 매출: ${fmt(totalSaleAmount)}원\n예상 마진: ${fmt(expectedMargin)}원 (${fmt(marginPct * 100, 1)}%)`,
        [{ text: '확인', onPress: () => navigation?.goBack() }]
      );
    } catch (e) {
      console.warn(e);
      Alert.alert('저장 실패', e?.message || '저장 중 문제가 발생했습니다');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={C.t1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>계근 입고</Text>
        <TouchableOpacity
          onPress={() => navigation?.navigate('CarcassHistory')}
          style={styles.backBtn}
          accessibilityLabel="계근 이력"
        >
          <Ionicons name="time-outline" size={24} color={C.t1} />
        </TouchableOpacity>
      </View>

      {/* ── 진행도 ── */}
      <View style={styles.progressBar}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done   = n < step;
          return (
            <TouchableOpacity
              key={label}
              style={styles.progItem}
              onPress={() => { if (n < step) setStep(n); }}
              activeOpacity={n < step ? 0.7 : 1}
            >
              <View style={[
                styles.progDot,
                active && styles.progDotActive,
                done && styles.progDotDone,
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <Text style={[styles.progDotNum, active && { color: '#fff' }]}>{n}</Text>}
              </View>
              <Text style={[
                styles.progLabel,
                active && { color: C.red, fontWeight: '800' },
                done && { color: C.ok2 },
              ]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <Step1
            species={species} setSpecies={setSpecies}
            traceNo={traceNo} setTraceNo={setTraceNo}
            supplier={supplier} setSupplier={setSupplier}
            purchaseDate={purchaseDate} setPurchaseDate={setPurchaseDate}
            traceInfo={traceInfo} traceLoading={traceLoading}
            onTraceLookup={handleTraceLookup}
            onClearTrace={() => { setTraceInfo(null); setTraceNo(''); }}
          />
        )}
        {step === 2 && (
          <Step2
            liveWeight={liveWeight} setLiveWeight={setLiveWeight}
            liveUnitPrice={liveUnitPrice} setLiveUnitPrice={setLiveUnitPrice}
            carcassWeight={carcassWeight} setCarcassWeight={setCarcassWeight}
            trimmedWeight={trimmedWeight} setTrimmedWeight={setTrimmedWeight}
            fatWeight={fatWeight} setFatWeight={setFatWeight}
            liveCost={liveCost} carcassKgPrice={carcassKgPrice} trimmedKgPrice={trimmedKgPrice}
            yieldLive2Car={yieldLive2Car} yieldCar2Trim={yieldCar2Trim}
          />
        )}
        {step === 3 && (
          <Step3
            extras={extras} setExtras={setExtras}
            liveCost={liveCost} extrasTotal={extrasTotal} totalCost={totalCost}
            trimmedWeight={num(trimmedWeight)} trimmedKgPrice={trimmedKgPrice}
          />
        )}
        {step === 4 && (
          <Step4
            parts={parts}
            togglePart={togglePart} updatePart={updatePart}
            removeCustomPart={removeCustomPart}
            removeStandardPart={removeStandardPart}
            onAddPart={() => setAddPartOpen(true)}
            onFillByAverage={fillByAverageYield}
            onRestoreDefaults={restoreDefaultParts}
            disabledCount={partsDisabled.size}
            partStats={partStats}
            totalPartWeight={totalPartWeight}
            trimmedWeight={num(trimmedWeight)}
            weightMatchPct={weightMatchPct}
            totalCost={totalCost}
          />
        )}
        {step === 5 && (
          <Step5
            species={species} traceNo={traceNo} supplier={supplier}
            liveWeight={num(liveWeight)} trimmedWeight={num(trimmedWeight)}
            liveCost={liveCost} extrasTotal={extrasTotal} totalCost={totalCost}
            trimmedKgPrice={trimmedKgPrice}
            enabledParts={enabledParts}
            totalSaleAmount={totalSaleAmount} expectedMargin={expectedMargin} marginPct={marginPct}
            partStats={partStats}
            weightMatchPct={weightMatchPct}
          />
        )}
      </ScrollView>

      {/* ── 하단 네비게이션 ── */}
      <View style={styles.bottomBar}>
        {step > 1 && (
          <OutlineBtn label="이전" onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: 8 }} />
        )}
        {step < 5 && (
          <PrimaryBtn
            label={`다음 (${step}/5)`}
            color={canNext() ? C.red : C.t4}
            onPress={() => { if (canNext()) setStep(step + 1); else Alert.alert('필수 입력을 완료하세요'); }}
            style={{ flex: 1 }}
          />
        )}
        {step === 5 && (
          <PrimaryBtn
            label={saving ? '저장 중...' : '재고로 확정 저장'}
            color={C.red}
            onPress={handleFinish}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* ── 부위 추가 모달 ── */}
      <Modal visible={addPartOpen} transparent animationType="fade" onRequestClose={() => setAddPartOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>부위 추가</Text>
            <Text style={styles.modalDesc}>자주 쓰는 부산물은 탭 한 번으로 추가 · 숨긴 표준 부위 복원 · 직접 입력</Text>

            <ScrollView
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* (A) 자주 쓰는 부산물 빠른 추가 */}
              {(() => {
                const existingNames = new Set(parts.map(p => p.name));
                const extras = getCommonExtras(species)
                  .filter(e => !existingNames.has(e.name));
                if (extras.length === 0) return null;
                return (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={styles.modalSectionTitle}>🦴 자주 쓰는 부산물 (뼈·내장·족)</Text>
                    <Text style={styles.modalSectionDesc}>탭하면 바로 커스텀 부위로 추가됩니다</Text>
                    <View style={styles.chipRow}>
                      {extras.map(e => (
                        <TouchableOpacity
                          key={e.name}
                          style={styles.extraChip}
                          onPress={() => { quickAddExtra(e); setAddPartOpen(false); }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={12} color={C.red} />
                          <Text style={styles.extraChipTxt}>{e.name}</Text>
                          <Text style={styles.extraChipPrice}>{fmt(e.defaultPrice / 1000)}k</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })()}

              {/* (B) 숨긴 표준 부위 복원 */}
              {partsDisabled.size > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.modalSectionTitle}>↩️ 숨김 처리한 표준 부위 되살리기</Text>
                  <Text style={styles.modalSectionDesc}>예전에 삭제한 부위를 다시 목록에 넣습니다</Text>
                  <View style={styles.chipRow}>
                    {[...partsDisabled].map(name => (
                      <TouchableOpacity
                        key={name}
                        style={styles.undeleteChip}
                        onPress={() => { undeleteStandardPart(name); setAddPartOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-undo" size={12} color={C.blue} />
                        <Text style={styles.undeleteChipTxt}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* (C) 직접 입력 */}
              <Text style={styles.modalSectionTitle}>✍️ 직접 입력</Text>
              <Text style={styles.modalSectionDesc}>사업장 고유 명칭으로 추가 (예: 특수부위)</Text>

              <Text style={styles.fieldLabel}>부위명 *</Text>
              <TextInput
                style={styles.input}
                value={newPartName}
                onChangeText={setNewPartName}
                placeholder="예: 살치살 1등급, 특양"
                placeholderTextColor={C.t4}
              />

              <Text style={styles.fieldLabel}>기본 판매단가 (원/kg)</Text>
              <TextInput
                style={styles.input}
                value={newPartPrice}
                onChangeText={setNewPartPrice}
                placeholder="0"
                placeholderTextColor={C.t4}
                keyboardType="numeric"
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <OutlineBtn label="닫기" onPress={() => { setAddPartOpen(false); setNewPartName(''); setNewPartPrice(''); }} style={{ flex: 1, marginRight: 8 }} />
              <PrimaryBtn label="직접 추가" color={C.red} onPress={addCustomPart} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────
// Step 1 — 원두 정보
// ─────────────────────────────────────────────────────
function Step1({
  species, setSpecies, traceNo, setTraceNo,
  supplier, setSupplier, purchaseDate, setPurchaseDate,
  traceInfo, traceLoading, onTraceLookup, onClearTrace,
}) {
  const canLookup = (traceNo || '').replace(/\D/g, '').length >= 12;

  return (
    <View>
      <SectionTitle icon="paw-outline" title="원두 정보" desc="어떤 고기를 얼마에 샀는지 기본 정보를 입력하세요" />

      <Text style={styles.fieldLabel}>품종 *</Text>
      <View style={styles.chipRow}>
        {SPECIES_OPTIONS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, species === s && styles.chipActive]}
            onPress={() => setSpecies(s)}
          >
            <Text style={[styles.chipTxt, species === s && styles.chipTxtActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>축산물 이력번호 (선택)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={traceNo}
          onChangeText={setTraceNo}
          placeholder="예: 002200774717"
          placeholderTextColor={C.t4}
          keyboardType="numeric"
          maxLength={15}
        />
        <TouchableOpacity
          style={[
            styles.lookupBtn,
            (!canLookup || traceLoading) && { opacity: 0.5 },
          ]}
          disabled={!canLookup || traceLoading}
          onPress={onTraceLookup}
          activeOpacity={0.7}
        >
          {traceLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.lookupBtnTxt}>조회</Text>
              </>}
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        <Ionicons name="information-circle-outline" size={12} color={C.t3} /> 조회 시 품종/공급처(도축장)/구매일(도축일)이 자동으로 채워집니다
      </Text>

      {/* 이력 조회 결과 카드 */}
      {traceInfo && (
        <View style={styles.traceCard}>
          <View style={styles.traceCardHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="checkmark-circle" size={18} color={C.ok2} />
              <Text style={styles.traceTitle}>이력 조회 완료</Text>
              {traceInfo.grade && traceInfo.grade !== 'N/A' && (
                <View style={styles.gradeBadge}>
                  <Text style={styles.gradeBadgeTxt}>{traceInfo.grade}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClearTrace}>
              <Ionicons name="close-circle" size={18} color={C.t4} />
            </TouchableOpacity>
          </View>
          <KV k="품종"     v={traceInfo.animalType || '-'} />
          <KV k="출생"     v={traceInfo.birthDate || '-'} />
          <KV k="도축일"   v={traceInfo.slaughterDate || '-'} />
          <KV k="도축장"   v={traceInfo.slaughterPlace || '-'} />
          <KV k="농장"     v={traceInfo.farmName || '-'} />
          {traceInfo.weight && traceInfo.weight !== 'N/A' && (
            <KV k="도체중량" v={traceInfo.weight} />
          )}
          {traceInfo.inspection && traceInfo.inspection !== 'N/A' && (
            <KV
              k="검사결과"
              v={traceInfo.inspection}
              badge={traceInfo.inspection === '적합' ? 'ok' : 'warn'}
              badgeText={traceInfo.inspection}
            />
          )}
        </View>
      )}

      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>공급처</Text>
      <TextInput
        style={styles.input}
        value={supplier}
        onChangeText={setSupplier}
        placeholder="예: ○○도축장 / △△농장"
        placeholderTextColor={C.t4}
      />

      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>구매일자</Text>
      <TextInput
        style={styles.input}
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.t4}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────
// Step 2 — 3단 계근
// ─────────────────────────────────────────────────────
function Step2({
  liveWeight, setLiveWeight, liveUnitPrice, setLiveUnitPrice,
  carcassWeight, setCarcassWeight, trimmedWeight, setTrimmedWeight,
  fatWeight, setFatWeight,
  liveCost, carcassKgPrice, trimmedKgPrice,
  yieldLive2Car, yieldCar2Trim,
}) {
  const y1Warn = yieldLive2Car > 0 && (yieldLive2Car < 0.50 || yieldLive2Car > 0.65);
  const y2Warn = yieldCar2Trim > 0 && (yieldCar2Trim < 0.70 || yieldCar2Trim > 0.85);

  return (
    <View>
      <SectionTitle icon="scale-outline" title="3단 계근" desc="산피 → 지육 → 발골(기름뺀지육) 순서로 무게를 측정합니다" />

      {/* 산피 */}
      <View style={styles.stageCard}>
        <View style={styles.stageHeader}>
          <View style={[styles.stageNum, { backgroundColor: C.red }]}><Text style={styles.stageNumTxt}>1</Text></View>
          <Text style={styles.stageTitle}>산피 (生皮) — 생체 무게</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>무게 (kg) *</Text>
            <TextInput style={styles.input} value={liveWeight} onChangeText={setLiveWeight} placeholder="0.0" placeholderTextColor={C.t4} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Kg 단가 (원)</Text>
            <TextInput style={styles.input} value={liveUnitPrice} onChangeText={setLiveUnitPrice} placeholder="0" placeholderTextColor={C.t4} keyboardType="numeric" />
          </View>
        </View>
        <KV k="산피 금액" v={`${fmt(liveCost)}원`} strong />
      </View>

      {/* 지육 */}
      <View style={styles.stageCard}>
        <View style={styles.stageHeader}>
          <View style={[styles.stageNum, { backgroundColor: C.warn2 }]}><Text style={styles.stageNumTxt}>2</Text></View>
          <Text style={styles.stageTitle}>지육 (枝肉) — 도축 후 뼈 포함</Text>
        </View>
        <Text style={styles.fieldLabel}>무게 (kg)</Text>
        <TextInput style={styles.input} value={carcassWeight} onChangeText={setCarcassWeight} placeholder="0.0" placeholderTextColor={C.t4} keyboardType="decimal-pad" />
        <KV k="지육 Kg단가 (자동)" v={`${fmt(carcassKgPrice)}원`} />
        {yieldLive2Car > 0 && (
          <KV
            k="산피 → 지육 수율"
            v={`${fmt(yieldLive2Car * 100, 1)}%`}
            badge={y1Warn ? 'warn' : 'ok'}
            badgeText={y1Warn ? '범위 밖' : '정상'}
          />
        )}
      </View>

      {/* 발골 */}
      <View style={styles.stageCard}>
        <View style={styles.stageHeader}>
          <View style={[styles.stageNum, { backgroundColor: C.ok2 }]}><Text style={styles.stageNumTxt}>3</Text></View>
          <Text style={styles.stageTitle}>발골 (기름뺀지육) — 뼈·기름 제거 후 *</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>발골 무게 (kg)</Text>
            <TextInput style={styles.input} value={trimmedWeight} onChangeText={setTrimmedWeight} placeholder="0.0" placeholderTextColor={C.t4} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>기름 무게 (kg)</Text>
            <TextInput style={styles.input} value={fatWeight} onChangeText={setFatWeight} placeholder="0.0" placeholderTextColor={C.t4} keyboardType="decimal-pad" />
          </View>
        </View>
        {yieldCar2Trim > 0 && (
          <KV
            k="지육 → 발골 수율"
            v={`${fmt(yieldCar2Trim * 100, 1)}%`}
            badge={y2Warn ? 'warn' : 'ok'}
            badgeText={y2Warn ? '범위 밖' : '정상'}
          />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// Step 3 — 부대비용
// ─────────────────────────────────────────────────────
function Step3({ extras, setExtras, liveCost, extrasTotal, totalCost, trimmedWeight, trimmedKgPrice }) {
  const items = [
    { key: 'transport', label: '운반비',    hint: '도축장 → 매장 운송비' },
    { key: 'unload',    label: '하차비',    hint: '적재/하차 인건비' },
    { key: 'broker',    label: '중개비',    hint: '중매인 수수료' },
    { key: 'hoof',      label: '우족작업비', hint: '우족 분리 공임 등' },
  ];
  return (
    <View>
      <SectionTitle icon="wallet-outline" title="부대비용" desc="매장에서 자주 쓰는 값은 저장 시 자동으로 다음 입고에 반영됩니다" />

      {items.map(it => (
        <View key={it.key} style={{ marginBottom: 12 }}>
          <Text style={styles.fieldLabel}>{it.label} <Text style={{ color: C.t4, fontWeight: '400' }}>— {it.hint}</Text></Text>
          <TextInput
            style={styles.input}
            value={String(extras[it.key] ?? '')}
            onChangeText={v => setExtras(prev => ({ ...prev, [it.key]: v }))}
            placeholder="0"
            placeholderTextColor={C.t4}
            keyboardType="numeric"
          />
        </View>
      ))}

      <View style={styles.summaryBox}>
        <KV k="산피 금액" v={`${fmt(liveCost)}원`} />
        <KV k="부대비용 합계" v={`${fmt(extrasTotal)}원`} />
        <View style={styles.divider} />
        <KV k="총 원가" v={`${fmt(totalCost)}원`} strong color={C.red} />
        {trimmedWeight > 0 && (
          <KV k="발골 Kg단가 (핵심)" v={`${fmt(trimmedKgPrice)}원/kg`} strong color={C.blue} />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// Step 4 — 부위별 계근
// ─────────────────────────────────────────────────────
function Step4({
  parts, togglePart, updatePart,
  removeCustomPart, removeStandardPart,
  onAddPart, onFillByAverage, onRestoreDefaults,
  disabledCount,
  partStats, totalPartWeight, trimmedWeight, weightMatchPct, totalCost,
}) {
  const sorted = [...parts].sort((a, b) => a.order - b.order);
  const matchGood = trimmedWeight > 0 && Math.abs(1 - weightMatchPct) < 0.02;

  // 평균 수율 데이터가 있는 부위 수 (매장 실제 평균)
  const realAvgCount = parts.filter(p => (p.suggestedRatio || 0) > 0).length;
  const canFill = trimmedWeight > 0;
  const stdCount    = parts.filter(p => !p.isCustom).length;
  const customCount = parts.filter(p =>  p.isCustom).length;

  // 그룹별로 나눠 섹션 헤더 표시
  const grouped = sorted.reduce((acc, p) => {
    const g = p.group || '기타';
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});
  const groupOrder = Object.keys(grouped); // sorted 순서 따라감

  return (
    <View>
      <SectionTitle
        icon="grid-outline"
        title="부위별 계근"
        desc={`표준 ${stdCount}부위 + 커스텀 ${customCount}부위. 사용할 부위만 체크·수정하세요.`}
      />

      {/* 부위 커스터마이징 액션 바 */}
      <View style={styles.custActionBar}>
        <TouchableOpacity style={styles.custActionBtn} onPress={onAddPart} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={16} color={C.red} />
          <Text style={[styles.custActionTxt, { color: C.red }]}>부위 추가</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.custActionBtn, disabledCount === 0 && { opacity: 0.4 }]}
          onPress={onRestoreDefaults}
          disabled={disabledCount === 0}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={16} color={C.blue} />
          <Text style={[styles.custActionTxt, { color: C.blue }]}>
            기본 부위 복원{disabledCount > 0 ? ` (${disabledCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 합계 / 일치 */}
      <View style={[styles.matchBox, matchGood ? styles.matchBoxOk : (trimmedWeight > 0 && styles.matchBoxWarn)]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchLabel}>부위 합계 / 발골 무게</Text>
          <Text style={styles.matchValue}>
            {fmt(totalPartWeight, 2)} kg / {fmt(trimmedWeight, 2)} kg
          </Text>
        </View>
        {trimmedWeight > 0 && (
          <Text style={[styles.matchPct, matchGood ? { color: C.ok2 } : { color: C.warn2 }]}>
            {fmt(weightMatchPct * 100, 1)}%
          </Text>
        )}
      </View>

      {/* 평균 수율 적용 (Phase 2 — 과거 누적 평균) */}
      <TouchableOpacity
        style={[styles.avgFillBtn, !canFill && { opacity: 0.5 }]}
        disabled={!canFill}
        onPress={onFillByAverage}
        activeOpacity={0.7}
      >
        <Ionicons name="sparkles-outline" size={18} color={C.blue} />
        <View style={{ flex: 1 }}>
          <Text style={styles.avgFillTitle}>
            {realAvgCount > 0
              ? `매장 평균 수율로 자동 배분 (데이터: ${realAvgCount}개 부위)`
              : '표준 평균 수율로 자동 배분'}
          </Text>
          <Text style={styles.avgFillDesc}>
            {realAvgCount > 0
              ? '과거 계근 세션에서 집계된 평균 비율로 예상 무게 제안'
              : '이 매장의 과거 데이터가 아직 없어 Excel 기준 평균을 사용합니다'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.t3} />
      </TouchableOpacity>

      {/* 부위 리스트 (그룹별) */}
      {groupOrder.map(groupName => (
        <View key={groupName}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupHeaderTxt}>{groupName}</Text>
            <Text style={styles.groupHeaderCount}>{grouped[groupName].length}부위</Text>
          </View>
          {grouped[groupName].map(renderPartRow)}
        </View>
      ))}
    </View>
  );

  function renderPartRow(p) {
        const s = partStats(p);
        const profitColor = s.profit >= 0 ? C.ok2 : C.red;

        // 매장 평균 수율 기반 제안 무게 (trimmedWeight * suggestedRatio)
        const bestRatio = (p.suggestedRatio && p.suggestedRatio > 0)
          ? p.suggestedRatio
          : (p.avgRatio || 0);
        const suggestKg = trimmedWeight > 0 && bestRatio > 0 ? trimmedWeight * bestRatio : 0;
        const hasRealAvg = (p.suggestedRatio || 0) > 0;
        // 현재 비율이 평균 대비 ±30% 이상 벗어나면 경고
        const deviatePct = (p.enabled && s.w > 0 && bestRatio > 0)
          ? Math.abs(s.ratio - bestRatio) / bestRatio
          : 0;
        const deviated = deviatePct > 0.3;

        return (
          <View key={p.key} style={[styles.partRow, !p.enabled && { opacity: 0.5 }]}>
            <View style={styles.partTopRow}>
              <TouchableOpacity onPress={() => togglePart(p.key)} style={styles.partCheck}>
                <Ionicons
                  name={p.enabled ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={p.enabled ? C.red : C.t4}
                />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.partName}>{p.name}</Text>
                  {p.isCustom && (
                    <View style={styles.customTag}>
                      <Text style={styles.customTagTxt}>커스텀</Text>
                    </View>
                  )}
                  {p.enabled && hasRealAvg && (
                    <View style={styles.avgTag}>
                      <Ionicons name="sparkles" size={9} color={C.blue} />
                      <Text style={styles.avgTagTxt}>
                        평균 {fmt(p.suggestedRatio * 100, 2)}% · n={p.sampleCount}
                      </Text>
                    </View>
                  )}
                </View>
                {p.enabled && s.w > 0 && (
                  <Text style={styles.partStats}>
                    비율 {fmt(s.ratio * 100, 2)}% · 원가 {fmt(s.allocatedCost)}원 · 매출 {fmt(s.saleAmount)}원
                  </Text>
                )}
                {p.enabled && s.w === 0 && suggestKg > 0 && (
                  <Text style={styles.partSuggest}>
                    💡 {hasRealAvg ? '매장 평균' : '표준 평균'} 예상: {fmt(suggestKg, 2)} kg
                  </Text>
                )}
                {p.enabled && deviated && (
                  <Text style={[styles.partStats, { color: C.warn2, fontWeight: '700' }]}>
                    ⚠ 평균 대비 {s.ratio > bestRatio ? '+' : ''}{fmt((s.ratio / bestRatio - 1) * 100, 0)}% — 재확인 권장
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => p.isCustom
                  ? removeCustomPart(p.key)
                  : removeStandardPart(p.key, p.name)}
                style={{ padding: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={C.t3} />
              </TouchableOpacity>
            </View>

            {p.enabled && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>무게 (kg)</Text>
                  <TextInput
                    style={styles.inputSm}
                    value={p.weight}
                    onChangeText={v => updatePart(p.key, 'weight', v)}
                    placeholder="0.0"
                    placeholderTextColor={C.t4}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Kg 단가 (원)</Text>
                  <TextInput
                    style={styles.inputSm}
                    value={p.priceKg}
                    onChangeText={v => updatePart(p.key, 'priceKg', v)}
                    placeholder="0"
                    placeholderTextColor={C.t4}
                    keyboardType="numeric"
                  />
                </View>
                {p.enabled && s.w > 0 && (
                  <View style={{ width: 72, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                    <Text style={styles.miniLabel}>차액</Text>
                    <Text style={[styles.profitTxt, { color: profitColor }]}>
                      {s.profit >= 0 ? '+' : ''}{fmt(s.profit / 1000)}k
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
  }
}

// ─────────────────────────────────────────────────────
// Step 5 — 확정
// ─────────────────────────────────────────────────────
function Step5({
  species, traceNo, supplier,
  liveWeight, trimmedWeight, liveCost, extrasTotal, totalCost, trimmedKgPrice,
  enabledParts, totalSaleAmount, expectedMargin, marginPct, partStats, weightMatchPct,
}) {
  const losses = enabledParts
    .map(p => ({ p, s: partStats(p) }))
    .filter(x => x.s.profit < 0);

  return (
    <View>
      <SectionTitle icon="checkmark-done-outline" title="최종 확인" desc="이대로 저장하면 각 부위가 재고로 자동 등록됩니다" />

      <View style={styles.summaryBox}>
        <Text style={styles.summaryHead}>📌 원두 정보</Text>
        <KV k="품종" v={species} />
        {traceNo ? <KV k="이력번호" v={traceNo} /> : null}
        {supplier ? <KV k="공급처" v={supplier} /> : null}

        <View style={styles.divider} />
        <Text style={styles.summaryHead}>⚖️ 무게</Text>
        <KV k="산피" v={`${fmt(liveWeight, 2)} kg`} />
        <KV k="발골" v={`${fmt(trimmedWeight, 2)} kg`} />
        <KV k="부위 합계 일치율" v={`${fmt(weightMatchPct * 100, 1)}%`} badge={Math.abs(1 - weightMatchPct) < 0.02 ? 'ok' : 'warn'} />

        <View style={styles.divider} />
        <Text style={styles.summaryHead}>💰 원가</Text>
        <KV k="산피 비용" v={`${fmt(liveCost)}원`} />
        <KV k="부대비용" v={`${fmt(extrasTotal)}원`} />
        <KV k="총 원가" v={`${fmt(totalCost)}원`} strong color={C.red} />
        <KV k="발골 Kg단가" v={`${fmt(trimmedKgPrice)}원/kg`} />

        <View style={styles.divider} />
        <Text style={styles.summaryHead}>📊 예상 손익</Text>
        <KV k="예상 매출" v={`${fmt(totalSaleAmount)}원`} strong color={C.blue} />
        <KV k="예상 마진" v={`${fmt(expectedMargin)}원`} strong color={expectedMargin >= 0 ? C.ok2 : C.red} />
        <KV k="마진율" v={`${fmt(marginPct * 100, 1)}%`} color={marginPct >= 0.25 ? C.ok2 : C.warn2} />

        <View style={styles.divider} />
        <Text style={styles.summaryHead}>🥩 분할 부위 ({enabledParts.length}개)</Text>
        <Text style={{ color: C.t3, fontSize: F.xs, marginTop: 4 }}>
          저장 시 각 부위가 기존 재고 목록에 자동 추가됩니다
        </Text>
      </View>

      {losses.length > 0 && (
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={20} color={C.warn2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnTitle}>손실 예상 부위 {losses.length}개</Text>
            <Text style={styles.warnDesc}>
              {losses.map(x => `${x.p.name}(${fmt(x.s.profit)})`).join(', ')}
            </Text>
            <Text style={styles.warnHint}>→ 이 부위들은 판매단가 재검토 또는 번들 판매 고려</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────
// 공용 소컴포넌트
// ─────────────────────────────────────────────────────
function SectionTitle({ icon, title, desc }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={22} color={C.red} />
        <Text style={styles.secTitle}>{title}</Text>
      </View>
      {desc && <Text style={styles.secDesc}>{desc}</Text>}
    </View>
  );
}

function KV({ k, v, strong, color, badge, badgeText }) {
  const badgeColor = badge === 'ok' ? C.ok2 : badge === 'warn' ? C.warn2 : null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {badgeColor && (
          <View style={[styles.miniBadge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '50' }]}>
            <Text style={[styles.miniBadgeTxt, { color: badgeColor }]}>{badgeText || badge}</Text>
          </View>
        )}
        <Text style={[
          styles.kvVal,
          strong && { fontWeight: '900', fontSize: F.body + 1 },
          color && { color },
        ]}>{v}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: F.h3, fontWeight: '900', color: C.t1 },

  progressBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  progItem: { alignItems: 'center', flex: 1 },
  progDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.bg3, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  progDotActive: { backgroundColor: C.red },
  progDotDone:   { backgroundColor: C.ok2 },
  progDotNum: { fontSize: F.xs, fontWeight: '900', color: C.t3 },
  progLabel: { fontSize: F.xxs, color: C.t3, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },

  secTitle: { fontSize: F.h3, fontWeight: '900', color: C.t1 },
  secDesc:  { fontSize: F.sm, color: C.t3, marginTop: 4, marginLeft: 30 },

  fieldLabel: { fontSize: F.sm, fontWeight: '700', color: C.t2, marginBottom: 6, marginTop: 2 },
  input: {
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: F.body, color: C.t1, minHeight: 50,
  },
  inputSm: {
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: F.body, color: C.t1, minHeight: 42,
  },
  hint: { fontSize: F.xxs, color: C.t3, marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: R.full, backgroundColor: C.bg3,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: C.red, borderColor: C.red },
  chipTxt:  { fontSize: F.body, fontWeight: '800', color: C.t1 },
  chipTxtActive: { color: '#fff' },

  stageCard: {
    backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 12, ...SH.sm,
  },
  stageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stageNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stageNumTxt: { color: '#fff', fontWeight: '900', fontSize: F.xs },
  stageTitle: { fontSize: F.body, fontWeight: '800', color: C.t1 },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  kvKey: { fontSize: F.sm, color: C.t3, fontWeight: '600' },
  kvVal: { fontSize: F.body, fontWeight: '700', color: C.t1 },

  summaryBox: {
    backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    padding: 14, marginTop: 4, ...SH.sm,
  },
  summaryHead: { fontSize: F.sm, fontWeight: '900', color: C.t2, marginTop: 8, marginBottom: 4 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },

  matchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border,
    padding: 14, marginBottom: 12,
  },
  matchBoxOk:   { borderColor: C.ok2, backgroundColor: C.okS },
  matchBoxWarn: { borderColor: C.warn2, backgroundColor: C.warnS },
  matchLabel: { fontSize: F.xs, color: C.t3, fontWeight: '700' },
  matchValue: { fontSize: F.body, fontWeight: '800', color: C.t1, marginTop: 2 },
  matchPct:   { fontSize: F.h3, fontWeight: '900' },

  addPartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, backgroundColor: C.redS, borderRadius: R.sm,
    borderWidth: 1.5, borderColor: C.redS2, borderStyle: 'dashed',
    marginBottom: 12,
  },
  addPartBtnTxt: { color: C.red, fontSize: F.sm, fontWeight: '800' },

  partRow: {
    backgroundColor: C.white, borderRadius: R.sm, borderWidth: 1, borderColor: C.border,
    padding: 10, marginBottom: 8,
  },
  partTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partCheck: { padding: 2 },
  partName: { fontSize: F.body, fontWeight: '800', color: C.t1 },
  partStats: { fontSize: F.xxs, color: C.t3, marginTop: 2 },
  customTag: { backgroundColor: C.red + '22', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  customTagTxt: { color: C.red, fontSize: 9, fontWeight: '900' },

  miniLabel: { fontSize: F.xxs, color: C.t3, fontWeight: '700', marginBottom: 3 },
  profitTxt: { fontSize: F.sm, fontWeight: '900' },

  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  miniBadgeTxt: { fontSize: F.xxs, fontWeight: '800' },

  warnBox: {
    flexDirection: 'row', gap: 10,
    backgroundColor: C.warnS, borderRadius: R.md, borderLeftWidth: 4, borderLeftColor: C.warn2,
    padding: 12, marginTop: 12,
  },
  warnTitle: { fontSize: F.sm, fontWeight: '900', color: C.warn },
  warnDesc:  { fontSize: F.xs, color: C.t2, marginTop: 3 },
  warnHint:  { fontSize: F.xxs, color: C.t3, marginTop: 4, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox:     { backgroundColor: C.white, borderRadius: R.md, padding: 20, width: '100%' },
  modalTitle:   { fontSize: F.h3, fontWeight: '900', color: C.t1, marginBottom: 4 },
  modalDesc:    { fontSize: F.sm, color: C.t3, marginBottom: 14 },

  // 이력번호 조회
  lookupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: C.red, borderRadius: R.sm,
    paddingHorizontal: 14, minHeight: 50,
  },
  lookupBtnTxt: { color: '#fff', fontSize: F.body, fontWeight: '800' },

  traceCard: {
    marginTop: 10,
    backgroundColor: C.okS, borderRadius: R.md,
    borderLeftWidth: 4, borderLeftColor: C.ok2,
    padding: 12,
  },
  traceCardHead: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 6, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  traceTitle: { fontSize: F.sm, fontWeight: '900', color: C.t1 },
  gradeBadge: {
    backgroundColor: C.red, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 4,
  },
  gradeBadgeTxt: { color: '#fff', fontSize: F.xxs, fontWeight: '900' },

  // 부위별 평균 수율 제안
  avgFillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderRadius: R.sm,
    borderWidth: 1.5, borderColor: C.blue + '40',
    paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 10,
  },
  avgFillTitle: { fontSize: F.sm, fontWeight: '800', color: C.t1 },
  avgFillDesc:  { fontSize: F.xxs, color: C.t3, marginTop: 2 },

  avgTag: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: C.blue + '15', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  avgTagTxt: { color: C.blue, fontSize: 9, fontWeight: '800' },

  partSuggest: { fontSize: F.xxs, color: C.blue, marginTop: 2, fontWeight: '700' },

  // 부위 커스터마이징 액션 바 (추가/복원)
  custActionBar: {
    flexDirection: 'row', gap: 8, marginBottom: 10,
  },
  custActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: C.white, borderWidth: 1.2, borderColor: C.border,
    borderRadius: R.sm, paddingVertical: 10,
  },
  custActionTxt: { fontSize: F.sm, fontWeight: '800' },

  // 그룹 헤더 (대분할 섹션)
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, marginBottom: 4,
    paddingHorizontal: 4, paddingVertical: 2,
    borderLeftWidth: 3, borderLeftColor: C.red,
    paddingLeft: 8,
  },
  groupHeaderTxt:   { fontSize: F.sm, fontWeight: '900', color: C.t1 },
  groupHeaderCount: { fontSize: F.xxs, color: C.t3, fontWeight: '700' },

  // 모달 — 자주 쓰는 부산물 / 숨김 복원 칩
  modalSectionTitle: { fontSize: F.sm, fontWeight: '900', color: C.t1, marginTop: 8, marginBottom: 2 },
  modalSectionDesc:  { fontSize: F.xxs, color: C.t3, marginBottom: 6 },

  extraChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.redS, borderRadius: R.full,
    borderWidth: 1, borderColor: C.redS2,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  extraChipTxt:   { fontSize: F.xs, fontWeight: '800', color: C.t1 },
  extraChipPrice: { fontSize: 10, color: C.t3, fontWeight: '700', marginLeft: 2 },

  undeleteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.blueS || 'rgba(29,78,216,0.09)',
    borderRadius: R.full,
    borderWidth: 1, borderColor: C.blue + '40',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  undeleteChipTxt: { fontSize: F.xs, fontWeight: '800', color: C.blue },
});
