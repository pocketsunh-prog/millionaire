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
import { playSfx } from '../audio/audioManager';
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
      onPress={() => {
        // Every button in the app gets the same UI tick; muted when effects are off.
        playSfx('click');
        onPress();
      }}
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
      onPress={() => {
        playSfx('click');
        onPress();
      }}
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

/** Gold pill switch used for on/off preferences (music, effects, categories). */
export function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        playSfx('click');
        onValueChange(!value);
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{checked: value, disabled: !!disabled}}
      style={({pressed}) => [
        styles.toggle,
        value ? styles.toggleOn : styles.toggleOff,
        (pressed || disabled) && {opacity: 0.6},
      ]}>
      <View
        style={[
          styles.toggleThumb,
          value ? styles.toggleThumbOn : styles.toggleThumbOff,
        ]}
      />
    </Pressable>
  );
}

/** Dependency-free volume picker: −/+ buttons around a filled bar. */
export function VolumeControl({
  value,
  onChange,
  disabled,
  steps = 10,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  steps?: number;
}) {
  const step = 1 / steps;
  const round = (n: number) => Math.round(n * 100) / 100;
  const decrease = () => onChange(round(Math.max(0, value - step)));
  const increase = () => onChange(round(Math.min(1, value + step)));

  return (
    <View style={[styles.volumeRow, disabled && styles.volumeRowDisabled]}>
      <Pressable
        onPress={decrease}
        disabled={disabled || value <= 0}
        hitSlop={6}
        accessibilityLabel="Decrease volume"
        style={styles.volumeButton}>
        <Text style={styles.volumeButtonText}>−</Text>
      </Pressable>
      <View style={styles.volumeTrack}>
        {value > 0 && <View style={[styles.volumeFill, {flex: value}]} />}
        {value < 1 && <View style={{flex: 1 - value}} />}
      </View>
      <Pressable
        onPress={increase}
        disabled={disabled || value >= 1}
        hitSlop={6}
        accessibilityLabel="Increase volume"
        style={styles.volumeButton}>
        <Text style={styles.volumeButtonText}>+</Text>
      </Pressable>
      <Text style={styles.volumeValue}>{Math.round(value * 100)}%</Text>
    </View>
  );
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
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: colors.gold,
  },
  toggleOff: {
    backgroundColor: colors.disabled,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  toggleThumbOn: {
    backgroundColor: colors.goldPale,
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    backgroundColor: colors.textMuted,
    alignSelf: 'flex-start',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  volumeRowDisabled: {
    opacity: 0.45,
  },
  volumeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeButtonText: {
    color: colors.gold,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 22,
  },
  volumeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.disabled,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  volumeFill: {
    backgroundColor: colors.gold,
  },
  volumeValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
});
