import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme';

const KEYS = ['A', 'B', 'C', 'D'];

/**
 * Audience poll bars shown after the "Ask the Audience" lifeline.
 */
export function AudiencePoll({percentages}: {percentages: Record<string, number>}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Audience Poll</Text>
      {KEYS.map(key => {
        const pct = percentages[key] ?? 0;
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.key}>{key}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, {width: `${pct}%`}]} />
            </View>
            <Text style={styles.pct}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  title: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  key: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 14,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 6,
  },
  pct: {
    color: colors.textMuted,
    fontSize: 11,
    width: 36,
    textAlign: 'right',
  },
});
