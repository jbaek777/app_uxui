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

import { colors, fontSize, spacing, radius, shadow } from './src/theme';
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
import { TempScreen } from './src/screens/OtherScreens';
import { requestNotificationPermission, scheduleDailyHygieneReminder } from './src/utils/notifications';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HEADER_OPTS = {
  headerStyle: { backgroundColor: colors.s1 },
  headerShadowVisible: false,
  headerTintColor: colors.tx,
  headerTitleStyle: { fontWeight: '800', fontSize: fontSize.md },
  contentStyle: { backgroundColor: colors.bg },
};

// ── Tab 1: 홈 ────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ── Tab 2: 이력관리 (스캔 → 숙성) ───────────────────────
function TraceStack() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS}>
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: '🏷️ 이력번호 조회' }} />
      <Stack.Screen name="Aging" component={AgingScreen} options={{ title: '🥩 숙성 관리' }} />
    </Stack.Navigator>
  );
}

// ── Tab 3: 재고·수율 ─────────────────────────────────────
function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS}>
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: '📦 재고·수율' }} />
    </Stack.Navigator>
  );
}

// ── Tab 4: 서류·출력 ─────────────────────────────────────
function DocsStack() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS}>
      <Stack.Screen name="Documents" component={DocumentScreen} options={{ title: '🖨️ 서류·출력' }} />
      <Stack.Screen name="Hygiene" component={HygieneScreen} options={{ title: '🧼 위생 일지' }} />
      <Stack.Screen name="Temp" component={TempScreen} options={{ title: '🌡️ 온도·습도 기록' }} />
      <Stack.Screen name="Closing" component={ClosingScreen} options={{ title: '💰 마감 정산' }} />
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: '📷 서류 스캔·AI OCR' }} />
    </Stack.Navigator>
  );
}

// ── Tab 5: 설정 ──────────────────────────────────────────
function SettingsStack({ bizData }) {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS}>
      <Stack.Screen name="Settings" options={{ title: '⚙️ 설정' }}>
        {() => <SettingsScreen route={{ params: { biz: bizData } }} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// ── 탭 아이콘 ────────────────────────────────────────────
function TabIcon({ emoji, label, focused, badge }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <View>
        <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
        {badge ? (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, { color: focused ? colors.ac : colors.t3 }]}>{label}</Text>
    </View>
  );
}

// ── 메인 탭 네비게이터 ───────────────────────────────────
function MainTabs({ bizData }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.s1,
          borderTopColor: colors.bd,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="홈" focused={focused} /> }}
      />
      <Tab.Screen
        name="TraceTab"
        component={TraceStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📦" label="이력관리" focused={focused} /> }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="재고·수율" focused={focused} /> }}
      />
      <Tab.Screen
        name="DocsTab"
        component={DocsStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🖨️" label="서류·출력" focused={focused} /> }}
      />
      <Tab.Screen
        name="SettingsTab"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="설정" focused={focused} /> }}
      >
        {() => <SettingsStack bizData={bizData} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ── 앱 루트 ──────────────────────────────────────────────
function App() {
  const [phase, setPhase] = useState('splash'); // 'splash' | 'onboarding' | 'main'
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
          <StatusBar style="light" />
          <SplashScreen onDone={handleSplashDone} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (phase === 'onboarding') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingScreen onDone={handleOnboardingDone} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <MainTabs bizData={bizData} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
  tabLabel: { fontSize: fontSize.xxs, fontWeight: '700', marginTop: 2 },
});
