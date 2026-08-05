import React from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export function Screen({
  children,
  scroll,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const content = (
    <View style={styles.screenInner}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Loading({label = 'Loading…'}: {label?: string}) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.gold} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.loading}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <GoldButton label="Retry" onPress={onRetry} />
      )}
    </View>
  );
}

export function GoldButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.goldButton,
        (pressed || disabled) && {opacity: 0.7},
        disabled && {backgroundColor: colors.disabled},
        style,
      ]}>
      <Text style={styles.goldButtonText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.ghostButton,
        (pressed || disabled) && {opacity: 0.6},
        style,
      ]}>
      <Text style={styles.ghostButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Card({children, style}: {children: ReactNode; style?: object}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({children}: {children: ReactNode}) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenInner: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    padding: 16,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  errorTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  goldButton: {
    backgroundColor: colors.gold,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  goldButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 30,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
});
