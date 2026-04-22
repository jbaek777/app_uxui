// 화이트 테마 전용 — 다크 모드 완전 제거.
// 기존 useTheme()/toggleTheme() 호출부 호환을 위해 Context 는 유지.
// isDark 는 항상 false, toggleTheme 은 no-op.
import React, { createContext, useContext } from 'react';
import { setTheme } from '../theme';

const ThemeContext = createContext({ isDark: false, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  // 앱 시작 시 1회 라이트 팔레트 주입 (상호 호환용)
  setTheme(false);

  return (
    <ThemeContext.Provider value={{ isDark: false, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
