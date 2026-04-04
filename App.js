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
import { NetworkProvider, useNetwork } from './src/lib/NetworkContext';
import { RoleProvider, useRole, STAFF_ALLOWED_TABS } from './src/lib/RoleContext';
import { FeatureFlagsProvider } from './src/lib/FeatureFlagsContext';
import { SubscriptionProvider } from './src/lib/SubscriptionContext';
import PaywallScreen from './src/screens/PaywallScreen';
import TaxReportScreen from './src/screens/TaxReportScreen';
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
import EducationScreen from './src/screens/EducationScreen';
import { requestNotificationPermission, scheduleDailyHygieneReminder, scheduleDailyExpiryReminder } from './src/utils/notifications';
import { ensureAuth } from './src/lib/supabase';

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

// ── Tab 2: 조회/스캔 (이력번호 + 서류 OCR 통합) ──────────
function TraceStack() {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: '🔍 조회 · 스캔' }} />
      <Stack.Screen name="TraceOCR" component={UploadScreen} options={{ title: '📷 서류 스캔·AI OCR' }} />
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
      <Stack.Screen name="Aging" component={AgingScreen} options={{ title: '🥩 숙성 관리' }} />
      <Stack.Screen name="Education" component={EducationScreen} options={{ title: '📚 교육일지' }} />
      <Stack.Screen name="TaxReport" component={TaxReportScreen} options={{ title: '📊 세무 리포트' }} />
    </Stack.Navigator>
  );
}

// ── Tab 5: 설정 ──────────────────────────────────────────
function SettingsStack({ bizData }) {
  const headerOpts = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Settings" options={{ title: '⚙️ 설정' }}>
        {({ navigation }) => <SettingsScreen route={{ params: { biz: bizData } }} navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ title: '💎 구독 관리' }} />
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

// ── 사장 전환 탭 화면 (직원 모드 탭바 우측) ──────────────
function OwnerReturnScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { requestOwnerMode, staffName } = useRole();
  React.useEffect(() => { requestOwnerMode(); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
      <Text style={{ color: pal.tx, fontSize: 16, fontWeight: '700' }}>사장 모드로 전환</Text>
    </View>
  );
}

// ── 직원 모드 배너 ────────────────────────────────────────
function StaffModeBanner() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { role, staffName, requestOwnerMode } = useRole();
  if (role !== 'staff') return null;
  return (
    <TouchableOpacity
      style={{
        backgroundColor: '#E8950A',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 8,
      }}
      onPress={requestOwnerMode}
      activeOpacity={0.85}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
        👤 직원 모드 — {staffName || '직원'}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' }}>
        🔐 사장 전환 탭
      </Text>
    </TouchableOpacity>
  );
}

// ── 메인 탭 네비게이터 ───────────────────────────────────
function MainTabs({ bizData }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { role } = useRole();
  const isStaff = role === 'staff';

  return (
    <View style={{ flex: 1 }}>
      <StaffModeBanner />
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
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="스캔" focused={focused} tabColor={pal.a2} pal={pal} /> }}
        />
        {/* 재고 탭 — 사장만 */}
        {!isStaff && (
          <Tab.Screen
            name="InventoryTab"
            component={InventoryStack}
            options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📦" label="재고" focused={focused} tabColor={pal.gn} pal={pal} /> }}
          />
        )}
        <Tab.Screen
          name="DocsTab"
          component={DocsStack}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🖨️" label="서류" focused={focused} tabColor={pal.pu} pal={pal} /> }}
        />
        {/* 설정 탭 — 사장만 */}
        {!isStaff && (
          <Tab.Screen
            name="SettingsTab"
            options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="설정" focused={focused} tabColor={pal.cyan} pal={pal} /> }}
          >
            {() => <SettingsStack bizData={bizData} />}
          </Tab.Screen>
        )}
        {/* 직원 모드 — 설정 탭 대신 사장복귀 탭 */}
        {isStaff && (
          <Tab.Screen
            name="OwnerTab"
            component={OwnerReturnScreen}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon emoji="🔐" label="사장전환" focused={focused} tabColor="#E8950A" pal={pal} />,
            }}
            listeners={({ navigation }) => ({
              tabPress: (e) => {
                e.preventDefault();
              },
            })}
          />
        )}
      </Tab.Navigator>
    </View>
  );
}

// ── 앱 내부 (테마 컨텍스트 안에서 렌더링) ───────────────
function AppInner() {
  const { isDark } = useTheme();
  const [phase, setPhase] = useState('splash');
  const [bizData, setBizData] = useState(null);

  useEffect(() => {
    (async () => {
      // 익명 인증 먼저 — RLS가 auth.uid() 기준이므로 DB 접근 전 필수
      await ensureAuth();
      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleDailyHygieneReminder();
        await scheduleDailyExpiryReminder();
      }
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
          <OfflineBanner />
          <MainTabs bizData={bizData} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function OfflineBanner() {
  const { isOnline } = useNetwork();
  if (isOnline) return null;
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerText}>
        📡 오프라인 모드 — 변경사항은 인터넷 연결 시 자동 저장됩니다
      </Text>
    </View>
  );
}

// ── 앱 루트 ──────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <NetworkProvider>
        <RoleProvider>
          <FeatureFlagsProvider>
            <SubscriptionProvider>
              <AppInner />
            </SubscriptionProvider>
          </FeatureFlagsProvider>
        </RoleProvider>
      </NetworkProvider>
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
  offlineBanner: {
    backgroundColor: '#92400e',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '700',
  },
});
