/**
 * FeatureFlagsContext
 * - 앱 시작 시 Supabase feature_flags 테이블 로드
 * - 관리자가 변경하면 즉시 반영 (realtime subscription)
 * - isFeatureFree(key) → true면 무료 접근, false면 구독 필요
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const FeatureFlagsContext = createContext({});

// 기본값 — Supabase 로드 실패 시 모두 무료로 열어둠
const DEFAULTS = {
  inventory: true,
  hygiene:   true,
  aging:     true,
  ocr:       true,
  closing:   true,
  education: true,
  margin:    true,
  supplier:  true,
  temp:      true,
};

export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const loadFlags = async () => {
    try {
      const { data, error } = await supabase.from('feature_flags').select('feature_key, is_free');
      if (!error && data && data.length > 0) {
        const map = {};
        data.forEach(r => { map[r.feature_key] = r.is_free; });
        setFlags({ ...DEFAULTS, ...map });
      }
    } catch {}
    setLoaded(true);
  };

  useEffect(() => {
    loadFlags();

    // 실시간 변경 구독
    const channel = supabase
      .channel('feature_flags_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' }, () => {
        loadFlags();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const isFeatureFree = (key) => flags[key] !== false; // undefined도 무료로 처리

  return (
    <FeatureFlagsContext.Provider value={{ flags, loaded, isFeatureFree, reload: loadFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
