/**
 * NetworkContext.js — 오프라인 상태 전역 감지
 * fetch 기반 (NetInfo 패키지 불필요)
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const NetworkContext = createContext({ isOnline: true });

const CHECK_URL = 'https://www.google.com';
const CHECK_INTERVAL = 30000; // 30초마다 재확인

async function checkOnline() {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    await fetch(CHECK_URL, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(tid);
    return true;
  } catch {
    return false;
  }
}

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef(null);

  const run = async () => {
    const online = await checkOnline();
    setIsOnline(online);
  };

  useEffect(() => {
    run();
    intervalRef.current = setInterval(run, CHECK_INTERVAL);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });

    return () => {
      clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
