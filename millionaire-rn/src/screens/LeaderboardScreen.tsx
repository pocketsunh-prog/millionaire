import React, {useCallback, useEffect, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {getLeaderboard} from '../api/game';
import {ErrorView, Loading, Screen} from '../components/ui';
import {colors, formatMoney} from '../theme';
import type {LeaderboardEntry, RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;
type SortType = 'score' | 'wins';

export default function LeaderboardScreen(_props: Props) {
  const [type, setType] = useState<SortType>('score');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEntries(await getLeaderboard(type));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const medal = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;

  return (
    <Screen>
      <Text style={styles.title}>🏆 LEADERBOARD</Text>
      <View style={styles.tabs}>
        {(['score', 'wins'] as SortType[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setType(t)}
            style={[styles.tab, type === t && styles.tabActive]}>
            <Text style={[styles.tabText, type === t && styles.tabTextActive]}>
              {t === 'score' ? 'Top Scores' : 'Most Wins'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <Loading label="Loading leaderboard…" />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No games played yet. Be the first on the board!
            </Text>
          }
          renderItem={({item, index}) => (
            <View style={styles.row}>
              <Text style={styles.rank}>{medal(index + 1)}</Text>
              <Text style={styles.avatar}>{item.avatar}</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{item.username}</Text>
                <Text style={styles.sub}>
                  {item.total_games} games · {item.total_wins} wins ·{' '}
                  {item.win_rate != null ? `${item.win_rate}%` : '—'} win rate
                </Text>
              </View>
              <View style={styles.scoreWrap}>
                <Text style={styles.score}>{formatMoney(item.best_score)}</Text>
                <Text style={styles.sub}>Q{item.best_question}</Text>
              </View>
            </View>
          )}
        />
      )}
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
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.background,
  },
  list: {
    paddingBottom: 20,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  rank: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '800',
    width: 30,
  },
  avatar: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  scoreWrap: {
    alignItems: 'flex-end',
  },
  score: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
  },
});
