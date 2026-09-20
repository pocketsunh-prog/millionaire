import React, {useCallback, useEffect, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {getCategories} from '../api/game';
import {getLocalCategories} from '../db/repository';
import {isOnline} from '../net';
import {playSfx} from '../audio/audioManager';
import {useBgm} from '../audio/useAudio';
import {ErrorView, Loading, Screen} from '../components/ui';
import {colors} from '../theme';
import type {Category, RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;

const EMOJIS: Record<string, string> = {
  Science: '🔬',
  History: '📜',
  Geography: '🌍',
  Entertainment: '🎬',
  Sports: '⚽',
  Technology: '💻',
  Literature: '📚',
  'General Knowledge': '🧠',
  Chinese: '🀄',
  English: '🔤',
  Maths: '📐',
  Physics: '⚛️',
  Chemistry: '🧪',
  Biology: '🧬',
  IS: '🖥️',
  'Chin History': '🏯',
};

export default function CategoryScreen({navigation}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useBgm('menu');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Skip the network attempt when the device is known-offline.
      if (!(await isOnline())) {
        throw new Error('offline');
      }
      // Server now returns only enabled categories by default.
      setCategories(await getCategories());
    } catch {
      // Offline → use the locally synced categories (enabled ones only).
      const local = getLocalCategories().filter(c => c.enabled !== false);
      if (local.length > 0) {
        setCategories(local);
      } else {
        setError(
          'Server unreachable and no offline data saved. Open the Home screen and tap "Sync offline data" first.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading categories…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  // Disabled categories are hidden from the chooser.
  const visible = categories.filter(c => c.enabled !== false);

  return (
    <Screen>
      <Text style={styles.title}>CHOOSE A CATEGORY</Text>
      <FlatList
        data={visible}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              playSfx('click');
              navigation.navigate('Game', {category: item.name});
            }}>
            <Text style={styles.itemEmoji}>
              {EMOJIS[item.name] ?? '❓'}
            </Text>
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName}>{item.name}</Text>
              {!!item.description && (
                <Text style={styles.itemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.item, styles.mixed]}
            onPress={() => {
              playSfx('click');
              navigation.navigate('MixCategory');
            }}>
            <Text style={styles.itemEmoji}>🎲</Text>
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName}>Mixed Categories</Text>
              <Text style={styles.itemDesc}>Pick categories to mix</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  mixed: {
    borderColor: colors.gold,
  },
  itemEmoji: {
    fontSize: 26,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  itemDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: colors.gold,
    fontSize: 24,
  },
});
