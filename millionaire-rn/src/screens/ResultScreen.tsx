import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {GhostButton, GoldButton, Screen} from '../components/ui';
import {colors, formatMoney} from '../theme';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({route, navigation}: Props) {
  const {title, amount, message, category, isNewRecord} = route.params;

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.emoji}>
          {title === 'CONGRATULATIONS!'
            ? '🏆'
            : title === 'GAME OVER'
            ? '💔'
            : '🚪'}
        </Text>
        <Text
          style={[
            styles.title,
            title === 'GAME OVER' && {color: colors.red},
            title === 'CONGRATULATIONS!' && {color: colors.gold},
          ]}>
          {title}
        </Text>
        <Text style={styles.amount}>{formatMoney(amount)}</Text>
        <Text style={styles.message}>{message}</Text>
        {isNewRecord && (
          <Text style={styles.record}>🎉 NEW PERSONAL BEST!</Text>
        )}

        <View style={styles.actions}>
          <GoldButton
            label="Play Again"
            onPress={() =>
              navigation.replace('Game', {category})
            }
          />
          <GhostButton
            label="Change Category"
            onPress={() => navigation.popTo('Category')}
          />
          <GhostButton
            label="Home"
            onPress={() => navigation.popTo('Home')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 12,
    textAlign: 'center',
  },
  amount: {
    color: colors.gold,
    fontSize: 40,
    fontWeight: '900',
    marginTop: 8,
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  record: {
    color: colors.green,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  actions: {
    marginTop: 34,
    width: '100%',
    gap: 12,
  },
});
