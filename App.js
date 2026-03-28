import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from './src/theme';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScanScreen from './src/screens/ScanScreen';
import AgingScreen from './src/screens/AgingScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import DocumentScreen from './src/screens/DocumentScreen';
import HygieneScreen from './src/screens/HygieneScreen';
import ClosingScreen from './src/screens/ClosingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UploadScreen from './src/screens/UploadScreen';
import { TempScreen, StaffScreen } from './src/screens/OtherScreens';
import { requestNotificationPermission, scheduleDailyHygieneReminder } from './src/utils/notifications';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 테마 반응형 헤더 옵션 — isDark state를 직접 읽어 색상 결정
function useHeaderOpts() {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : lightColors;
  return {
    headerStyle: { backgroundColor: palette.s1 },
    headerShadowVisible: false,
    headerTintColor: palette.tx,
    headerTitleStyle: { fontWeight: '800', fontSize: fontSize.md },
    headerBackTitleVisible: false,
    headerBackTitle: ' ',            // iOS @react-navigation/stack 뒤로가기 텍스트 제거
    contentStyle: { backgroundColor: palette.bg },
  };
}

// ── Tab 1: 홈 ────────────────────────────────────────────
function HomeStack() {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ── Tab 2: 이력관리 (숙성 → 스캔) ───────────────────────
function TraceStack() {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Aging" component={AgingScreen} options={{ title: '🥩 숙성 관리' }} />
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: '🏷️ 이력번호 조회' }} />
    </Stack.Navigator>
  );
}

// ── Tab 3: 재고·수율 ─────────────────────────────────────
function InventoryStack() {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: '📦 재고·수율' }} />
    </Stack.Navigator>
  );
}

// ── Tab 4: 서류·출력 ─────────────────────────────────────
function DocsStack() {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Documents" component={DocumentScreen} options={{ title: '🖨️ 서류·출력' }} />
      <Stack.Screen name="Hygiene" component={HygieneScreen} options={{ title: '🧼 위생 일지' }} />
      <Stack.Screen name="Temp" component={TempScreen} options={{ title: '🌡️ 온도·습도 기록' }} />
      <Stack.Screen name="Closing" component={ClosingScreen} options={{ title: '💰 마감 정산' }} />
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: '📷 서류 스캔·AI OCR' }} />
      <Stack.Screen name="Staff" component={StaffScreen} options={{ title: '👥 직원 보건증 현황' }} />
    </Stack.Navigator>
  );
}

// ── Tab 5: 설정 ──────────────────────────────────────────
function SettingsStack({ bizData }) {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Settings" options={{ title: '⚙️ 설정' }}>
        {() => <SettingsScreen route={{ params: { biz: bizData } }} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// ── 탭 아이콘 + 레이블 ───────────────────────────────────
function TabIcon({ emoji, label, focused, tabColor, pal }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
      <Text style={{
        fontSize: 13,
        fontWeight: focused ? '800' : '600',
        color: focused ? tabColor : pal.t3,
        textAlign: 'center',
      }}>
        {label}
      </Text>
    </View>
  );
}

// ── 메인 탭 네비게이터 ───────────────────────────────────
function MainTabs({ bizData }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: pal.s1,
          borderTopColor: pal.bd,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="홈" focused={focused} tabColor={pal.ac} pal={pal} /> }}
      />
      <Tab.Screen
        name="TraceTab"
        component={TraceStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🥩" label="숙성" focused={focused} tabColor={pal.a2} pal={pal} /> }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📦" label="재고" focused={focused} tabColor={pal.gn} pal={pal} /> }}
      />
      <Tab.Screen
        name="DocsTab"
        component={DocsStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🖨️" label="서류" focused={focused} tabColor={pal.pu} pal={pal} /> }}
      />
      <Tab.Screen
        name="SettingsTab"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="설정" focused={focused} tabColor={pal.cyan} pal={pal} /> }}
      >
        {() => <SettingsStack bizData={bizData} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ── 앱 내부 (테마 컨텍스트 안에서 렌더링) ───────────────
function AppInner() {
  const { isDark } = useTheme();
  const [phase, setPhase] = useState('splash');
  const [bizData, setBizData] = useState(null);

  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) await scheduleDailyHygieneReminder();
    })();
  }, []);

  const handleSplashDone = async () => {
    try {
      const onboarded = await AsyncStorage.getItem('@meatbig_onboarded');
      const biz = await AsyncStorage.getItem('@meatbig_biz');
      if (onboarded === 'true' && biz) {
        setBizData(JSON.parse(biz));
        setPhase('main');
      } else {
        setPhase('onboarding');
      }
    } catch {
      setPhase('onboarding');
    }
  };

  const handleOnboardingDone = ({ biz }) => {
    setBizData(biz);
    setPhase('main');
  };

  if (phase === 'splash') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <SplashScreen onDone={handleSplashDone} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (phase === 'onboarding') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <OnboardingScreen onDone={handleOnboardingDone} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <MainTabs bizData={bizData} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ── 앱 루트 ──────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({
  tabBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: colors.rd, borderRadius: 10,
    width: 17, height: 17, alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tabLabel: { fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});
