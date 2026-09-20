import React, {useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Screen, GoldButton} from '../components/ui';
import {playSfx} from '../audio/audioManager';
import {useBgm} from '../audio/useAudio';
import {colors} from '../theme';
import type {RootStackParamList, Category} from '../types';
import {
  getLocalCategories,
  getQuestionCountByCategory,
} from '../db/repository';

type Props = NativeStackScreenProps<RootStackParamList, 'MixCategory'>;

export default function MixCategoryScreen({navigation}: Props) {
  useBgm('menu');

  // Only enabled categories can be mixed into a game.
  const all = getLocalCategories().filter(c => c.enabled !== false);
  const [selected, setSelected] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    all.forEach(c => {
      initial[c.id] = true;
    });
    return initial;
  });

  const toggle = (id: number) => {
    playSfx('click');
    setSelected(prev => ({...prev, [id]: !prev[id]}));
  };

  const selectAll = () => {
    playSfx('click');
    const next: Record<number, boolean> = {};
    all.forEach(c => {
      next[c.id] = true;
    });
    setSelected(next);
  };

  const selectedIds = all.filter(c => selected[c.id]).map(c => c.id);
  const totalQuestions = selectedIds.reduce(
    (sum, id) => sum + getQuestionCountByCategory(id),
    0,
  );

  const start = () => {
    navigation.navigate('Game', {
      category: 'mixed',
      mixCategoryIds: selectedIds,
    });
  };

  const renderItem = ({item}: {item: Category}) => {
    const count = getQuestionCountByCategory(item.id);
    const isSelected = !!selected[item.id];
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => toggle(item.id)}>
        <View style={styles.checkbox}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.itemTextWrap}>
          <Text style={styles.itemName}>{item.name}</Text>
          {!!item.description && (
            <Text style={styles.itemDesc} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        <Text style={styles.count}>{count} Q</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>🎲 Mix Categories</Text>
          <Text style={styles.subtitle}>
            Pick the categories to mix into one game
          </Text>
        </View>
        <TouchableOpacity onPress={selectAll} style={styles.selectAll}>
          <Text style={styles.selectAllText}>All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={all}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
      />

      <View style={styles.footer}>
        <Text style={styles.footerInfo}>
          {selectedIds.length} selected · {totalQuestions} questions available
        </Text>
        <GoldButton
          label="▶  START MIXED GAME"
          onPress={start}
          disabled={selectedIds.length === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  back: {paddingVertical: 4},
  backText: {color: colors.gold, fontSize: 16, fontWeight: '700'},
  headerTitles: {flex: 1},
  title: {color: colors.text, fontSize: 18, fontWeight: '800'},
  subtitle: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  selectAll: {padding: 4},
  selectAllText: {color: colors.gold, fontSize: 14, fontWeight: '700'},
  list: {paddingBottom: 16},
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
  itemSelected: {borderColor: colors.gold},
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {color: colors.gold, fontSize: 16, fontWeight: '900'},
  itemTextWrap: {flex: 1},
  itemName: {color: colors.text, fontSize: 16, fontWeight: '700'},
  itemDesc: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  count: {color: colors.gold, fontSize: 13, fontWeight: '700'},
  footer: {gap: 8},
  footerInfo: {color: colors.textMuted, fontSize: 13, textAlign: 'center'},
});
