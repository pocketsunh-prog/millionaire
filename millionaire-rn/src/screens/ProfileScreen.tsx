import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {getHistory} from '../api/game';
import {useAuth} from '../context/AuthContext';
import {Card, ErrorView, GhostButton, Loading, Screen} from '../components/ui';
import {colors, formatMoney} from '../theme';
import type {GameHistoryEntry, RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const STATUS_ICON: Record<string, string> = {
  won: '🏆',
  lost: '❌',
  quit: '🚪',
  active: '▶️',
};

export default function ProfileScreen({navigation}: Props) {
  const {user, isGuest, isOffline, logout} = useAuth();
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || isGuest || isOffline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setHistory(await getHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [user, isGuest, isOffline]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={history}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.avatar}>{user.avatar}</Text>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.role}>
                {user.role === 'admin' ? '👑 Admin' : 'Player'}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <Stat label="Best Score" value={formatMoney(user.best_score)} />
              <Stat label="Games" value={String(user.total_games)} />
              <Stat label="Wins" value={String(user.total_wins)} />
              <Stat label="Best Question" value={`Q${user.best_question}`} />
            </View>

            <Text style={styles.historyTitle}>GAME HISTORY</Text>
            {(isGuest || isOffline) && (
              <Text style={styles.guestNote}>
                {isGuest
                  ? 'Guest mode — history and online stats need a server connection. Your offline results are uploaded when you sync.'
                  : 'Offline session — history and stats will appear after you sign in while connected. Offline results are uploaded when you sync.'}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading label="Loading history…" />
          ) : error ? (
            <ErrorView message={error} onRetry={load} />
          ) : (
            <Text style={styles.empty}>No games played yet.</Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyIcon}>
              {STATUS_ICON[item.status] ?? '❔'}
            </Text>
            <View style={styles.historyInfo}>
              <Text style={styles.historyName}>
                {item.category_played || 'Mixed'} · {formatMoney(item.score)}
              </Text>
              <Text style={styles.historySub}>
                Reached Q{item.current_question} ·{' '}
                {new Date(item.started_at).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.historyStatus}>{item.status.toUpperCase()}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <GhostButton
          label="Back to Home"
          onPress={() => navigation.navigate('Home')}
        />
        <GhostButton
          label="Log out"
          onPress={async () => {
            await logout();
            navigation.reset({index: 0, routes: [{name: 'Login'}]});
          }}
        />
      </View>
    </Screen>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 10,
  },
  avatar: {
    fontSize: 52,
  },
  username: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  role: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  historyTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 10,
  },
  guestNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  historyRow: {
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
  historyIcon: {
    fontSize: 20,
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  historySub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  historyStatus: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    gap: 10,
    paddingTop: 8,
  },
});
