import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Screen, Toggle} from '../components/ui';
import {
  deleteCategory,
  getLocalCategories,
  getQuestionCountByCategory,
  setCategoryEnabled,
} from '../db/repository';
import {playSfx} from '../audio/audioManager';
import {useBgm} from '../audio/useAudio';
import {colors} from '../theme';
import type {Category, RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryManagement'>;

export default function CategoryManagementScreen({navigation}: Props) {
  useBgm('menu');

  const [categories, setCategories] = useState<Category[]>(() =>
    getLocalCategories(),
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const toggleEnabled = useCallback(
    async (category: Category, nextEnabled: boolean) => {
      setBusyId(category.id);
      try {
        setCategoryEnabled(category.id, nextEnabled);
        setCategories(prev =>
          prev.map(c =>
            c.id === category.id ? {...c, enabled: nextEnabled} : c,
          ),
        );
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const confirmDelete = useCallback((category: Category) => {
    const count = getQuestionCountByCategory(category.id);
    playSfx('click');
    Alert.alert(
      'Delete Category',
      `Delete "${category.name}" and its ${count} question(s) from offline data? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            playSfx('click');
            deleteCategory(category.id);
            setCategories(prev => prev.filter(c => c.id !== category.id));
          },
        },
      ],
    );
  }, []);

  const enabledCount = categories.filter(c => c.enabled).length;
  const disabledCount = categories.filter(c => !c.enabled).length;
  const totalCount = categories.length;

  const renderItem = ({item}: {item: Category}) => {
    const count = getQuestionCountByCategory(item.id);
    const isBusy = busyId === item.id;
    return (
      <View style={styles.item}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {!!item.description && (
            <Text style={styles.itemDesc} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          <Text style={styles.itemCount}>{count} question(s)</Text>
        </View>
        <View style={styles.itemActions}>
          <Toggle
            value={!!item.enabled}
            onValueChange={next => toggleEnabled(item, next)}
            disabled={isBusy}
          />
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => confirmDelete(item)}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
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
          <Text style={styles.title}>📋 Manage Categories</Text>
          <Text style={styles.subtitle}>
            Enable, disable, or delete offline categories
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{enabledCount}</Text>
          <Text style={styles.statLabel}>Enabled</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.statValueDisabled]}>
            {disabledCount}
          </Text>
          <Text style={styles.statLabel}>Disabled</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {totalCount === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No offline categories</Text>
          <Text style={styles.emptyText}>
            Sync offline data from the Home screen to download categories.
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          💡 Disabled categories won't appear in the category picker or mixed
          game. Deleted categories will be re-downloaded on the next sync.
        </Text>
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
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    color: colors.green,
    fontSize: 20,
    fontWeight: '800',
  },
  statValueDisabled: {
    color: colors.red,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
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
  itemInfo: {flex: 1},
  itemName: {color: colors.text, fontSize: 16, fontWeight: '700'},
  itemDesc: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  itemCount: {color: colors.gold, fontSize: 12, marginTop: 4, fontWeight: '600'},
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyIcon: {fontSize: 48},
  emptyTitle: {color: colors.text, fontSize: 18, fontWeight: '700'},
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  footer: {
    marginTop: 8,
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
