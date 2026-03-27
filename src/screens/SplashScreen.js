import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, fontSize, spacing } from '../theme';

export default function SplashScreen({ onDone }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          onDone();
        });
      }, 1600);
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* 배경 패턴 */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* 로고 아이콘 */}
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🥩</Text>
        </View>

        {/* 앱명 */}
        <Text style={styles.appName}>MeatBig</Text>
        <Text style={styles.appNameKo}>미트빅</Text>

        {/* 슬로건 */}
        <View style={styles.sloganBox}>
          <Text style={styles.slogan}>"사장님은 고기만 써세요"</Text>
        </View>
      </Animated.View>

      {/* 하단 */}
      <Animated.Text style={[styles.version, { opacity: fadeAnim }]}>v1.0.0</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: colors.ac + '18',
    top: -100,
    right: -100,
  },
  bgCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.a2 + '10',
    bottom: -80,
    left: -80,
  },
  content: {
    alignItems: 'center',
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: colors.ac,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.ac,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  logoEmoji: { fontSize: 60 },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.tx,
    letterSpacing: 1,
  },
  appNameKo: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.t2,
    letterSpacing: 6,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  sloganBox: {
    backgroundColor: colors.s1,
    borderRadius: 30,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.bd,
  },
  slogan: {
    fontSize: fontSize.sm,
    color: colors.a2,
    fontWeight: '700',
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: fontSize.xxs,
    color: colors.t3,
  },
});
