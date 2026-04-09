import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 알림 수신 시 표시 방식 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── 권한 요청 ──────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── 일일 위생일지 알림 (매일 오전 9시) ──────────────────
export async function scheduleDailyHygieneReminder() {
  // 기존 알림 취소 후 재설정
  await Notifications.cancelScheduledNotificationAsync('daily-hygiene').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-hygiene',
    content: {
      title: '📋 위생일지 작성 알림',
      body: '오늘의 위생 점검을 기록해주세요. 위생 점수를 유지하세요!',
      sound: true,
      badge: 1,
    },
    trigger: {
      type: 'calendar',
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

// ─── 숙성 완료 알림 (n일 후, 0이면 즉시) ───────────────
export async function scheduleAgingCompleteAlert(traceNo, cutName, daysUntilDone) {
  const id = `aging-${traceNo}`;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  // daysUntilDone <= 0 이면 즉시(5초 후) 알림
  const seconds = daysUntilDone > 0 ? daysUntilDone * 24 * 60 * 60 : 5;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: '🥩 숙성 완료',
      body: `${cutName} (${traceNo}) 숙성이 완료되었습니다. 확인해주세요!`,
      sound: true,
    },
    trigger: { seconds, repeats: false },
  });
}

// ─── 보건증 만료 알림 (앱 시작 시 체크) ─────────────────
export async function scheduleHealthCertExpiry(staffName, daysLeft) {
  if (daysLeft <= 0) return;
  const id = `health-cert-${staffName}`;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  if (daysLeft <= 30) {
    // 30일 이하면 즉시 표시
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: '⚠️ 보건증 만료 임박',
        body: `${staffName}의 보건증이 ${daysLeft}일 후 만료됩니다. 미리 갱신해주세요.`,
        sound: true,
      },
      trigger: { seconds: 5, repeats: false },
    });
  }
}

// ─── 소비기한 임박 알림 (매일 오전 8시) ─────────────────
export async function scheduleDailyExpiryReminder() {
  await Notifications.cancelScheduledNotificationAsync('daily-expiry').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-expiry',
    content: {
      title: '⚠️ 소비기한 확인',
      body: '소비기한 임박 재고가 있을 수 있습니다. 재고 화면에서 확인하세요.',
      sound: true,
      badge: 1,
    },
    trigger: { type: 'calendar', hour: 8, minute: 0, repeats: true },
  });
}

// ─── 개별 알림 취소 ─────────────────────────────────────
export async function cancelHygieneReminder() {
  await Notifications.cancelScheduledNotificationAsync('daily-hygiene').catch(() => {});
}

export async function cancelExpiryReminder() {
  await Notifications.cancelScheduledNotificationAsync('daily-expiry').catch(() => {});
}

export async function cancelAgingAlert(traceNo) {
  await Notifications.cancelScheduledNotificationAsync(`aging-${traceNo}`).catch(() => {});
}

// ─── 모든 예약 알림 취소 ─────────────────────────────────
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
