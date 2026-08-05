import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, formatMoney, PRIZE_LEVELS, SAFETY_NETS} from '../theme';

/**
 * The 15-step prize ladder. `currentIndex` is the 0-based index of the
 * question currently being played (-1 before the first question).
 */
export function PrizeLadder({
  currentIndex,
  compact,
}: {
  currentIndex: number;
  compact?: boolean;
}) {
  return (
    <View style={[styles.ladder, compact && styles.ladderCompact]}>
      {PRIZE_LEVELS.map((level, idx) => {
        const position = idx + 1; // 1-based question number
        const isCurrent = idx === currentIndex;
        const isDone = idx < currentIndex;
        const isSafe = SAFETY_NETS.includes(position);
        return (
          <View
            key={level}
            style={[
              styles.row,
              isCurrent && styles.rowCurrent,
              isDone && styles.rowDone,
            ]}>
            <Text
              style={[
                styles.pos,
                isCurrent && styles.textCurrent,
                isDone && styles.textDone,
              ]}>
              {position}
            </Text>
            <View style={styles.safeMark}>
              {isSafe && <Text style={styles.safeText}>▲</Text>}
            </View>
            <Text
              style={[
                styles.amount,
                isCurrent && styles.textCurrent,
                isDone && styles.textDone,
              ]}>
              {formatMoney(level)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: {
    width: 130,
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  ladderCompact: {
    width: 110,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginVertical: 1,
  },
  rowCurrent: {
    backgroundColor: colors.gold,
  },
  rowDone: {
    opacity: 0.45,
  },
  pos: {
    color: colors.textMuted,
    fontSize: 11,
    width: 16,
  },
  safeMark: {
    width: 14,
  },
  safeText: {
    color: colors.goldDark,
    fontSize: 9,
  },
  amount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  textCurrent: {
    color: colors.background,
    fontWeight: '800',
  },
  textDone: {
    color: colors.text,
  },
});
