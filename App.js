import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { colors } from './src/theme';
import DashboardScreen from './src/screens/DashboardScreen';
import AgingScreen from './src/screens/AgingScreen';
import UploadScreen from './src/screens/UploadScreen';
import ScanScreen from './src/screens/ScanScreen';
import {
  HygieneScreen,
  TempScreen,
  DocsScreen,
  StaffScreen,
  InventoryScreen,
} from './src/screens/OtherScreens';
import { requestNotificationPermission, scheduleDailyHygieneReminder } from './src/utils/notifications';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const STACK_HEADER_OPTS = {
  headerStyle: { backgroundColor: colors.s1 },
  headerShadowVisible: false,
  headerTintColor: colors.tx,
  headerTitleStyle: { fontWeight: '800', fontSize: 15 },
  contentStyle: { backgroundColor: colors.bg },
};

// ─── 대시보드 스택 ───────────────────────────────────────
function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={STACK_HEADER_OPTS}>
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{ title: '📊 대시보드' }}
      />
    </Stack.Navigator>
  );
}

// ─── 숙성 스택 ──────────────────────────────────────────
function AgingStack() {
  return (
    <Stack.Navigator screenOptions={STACK_HEADER_OPTS}>
      <Stack.Screen name="AgingMain" component={AgingScreen} options={{ title: '🥩 숙성 관리' }} />
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: '🏷️ 이력번호 스캔' }} />
    </Stack.Navigator>
  );
}

// ─── 위생·서류 허브 ──────────────────────────────────────
function DocsHub({ navigation }) {
  const menus = [
    { screen: 'Hygiene', icon: '🧼', title: '위생 일지', sub: '일일 위생 점검 기록', badge: null, badgeColor: null },
    { screen: 'Temp', icon: '🌡️', title: '온도·습도 기록', sub: '숙성실 환경 모니터링', badge: '정상', badgeColor: colors.gn },
    { screen: 'Docs', icon: '📁', title: '서류 체크리스트', sub: '위생점검 대비 서류 현황', badge: '2', badgeColor: colors.rd },
    { screen: 'Staff', icon: '👥', title: '직원 서류 관리', sub: '보건증·위생교육 이수증', badge: '1', badgeColor: colors.rd },
    { screen: 'Upload', icon: '📷', title: '서류 스캔 · AI OCR', sub: '촬영 → AI 자동 추출 → 저장', badge: 'AI', badgeColor: colors.pu },
    { screen: 'ScanDoc', icon: '🏷️', title: '이력번호 스캔', sub: '바코드로 도축·등급 정보 즉시 조회', badge: '신규', badgeColor: colors.a2 },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      {menus.map(m => (
        <TouchableOpacity
          key={m.screen}
          style={styles.hubCard}
          onPress={() => navigation.navigate(m.screen)}
          activeOpacity={0.82}
        >
          <Text style={styles.hubIcon}>{m.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.hubTitle}>{m.title}</Text>
            <Text style={styles.hubSub}>{m.sub}</Text>
          </View>
          {m.badge && (
            <View style={[styles.hubBadge, { backgroundColor: m.badgeColor }]}>
              <Text style={styles.hubBadgeText}>{m.badge}</Text>
            </View>
          )}
          <Text style={{ color: colors.t3, fontSize: 18, marginLeft: 4 }}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── 위생·서류 스택 ──────────────────────────────────────
function DocsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_HEADER_OPTS}>
      <Stack.Screen name="DocsHub" component={DocsHub} options={{ title: '📄 위생·서류 관리' }} />
      <Stack.Screen name="Hygiene" component={HygieneScreen} options={{ title: '🧼 위생 일지' }} />
      <Stack.Screen name="Temp" component={TempScreen} options={{ title: '🌡️ 온도·습도 기록' }} />
      <Stack.Screen name="Docs" component={DocsScreen} options={{ title: '📁 서류 체크리스트' }} />
      <Stack.Screen name="Staff" component={StaffScreen} options={{ title: '👥 직원 서류 관리' }} />
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: '📷 서류 스캔 · AI OCR' }} />
      <Stack.Screen name="ScanDoc" component={ScanScreen} options={{ title: '🏷️ 이력번호 스캔' }} />
    </Stack.Navigator>
  );
}

// ─── 재고 스택 ──────────────────────────────────────────
function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={STACK_HEADER_OPTS}>
      <Stack.Screen name="InventoryMain" component={InventoryScreen} options={{ title: '📦 재고·구매 관리' }} />
    </Stack.Navigator>
  );
}

// ─── 탭 아이콘 ───────────────────────────────────────────
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

// ─── 루트 탭 ────────────────────────────────────────────
function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.s1,
          borderTopColor: colors.bd,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 82 : 62,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="대시보드" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AgingTab"
        component={AgingStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🥩" label="숙성관리" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="DocsTab"
        component={DocsStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📄" label="위생·서류" focused={focused} badge="3" />,
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📦" label="재고" focused={focused} badge="!" />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── 앱 루트 ────────────────────────────────────────────
function App() {
  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) await scheduleDailyHygieneReminder();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({
  hubCard: {
    backgroundColor: colors.s1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bd,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  hubIcon: { fontSize: 26, marginRight: 14 },
  hubTitle: { fontSize: 14, fontWeight: '700', color: colors.tx, marginBottom: 3 },
  hubSub: { fontSize: 11, color: colors.t3 },
  hubBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  hubBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.rd,
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
