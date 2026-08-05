import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import {GhostButton, GoldButton, Screen} from '../components/ui';
import {flushPendingResults, getLastSync, syncOfflineData} from '../db/sync';
import {getLocalStats, pendingResultCount} from '../db/repository';
import {colors, formatMoney} from '../theme';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({navigation}: Props) {
  const {user, isGuest, logout} = useAuth();

  const [stats, setStats] = useState({categories: 0, questions: 0});
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ok: boolean; text: string} | null>(
    null,
  );

  const refreshOffline = useCallback(() => {
    setStats(getLocalStats());
    setLastSync(getLastSync());
    setPending(pendingResultCount());
  }, []);

  const doSync = useCallback(
    async (silent = false) => {
      setSyncing(true);
      if (!silent) setSyncMsg(null);
      try {
        const result = await syncOfflineData();
        const flushed = await flushPendingResults();
        refreshOffline();
        setSyncMsg({
          ok: true,
          text: `✅ Synced ${result.categories} categories / ${result.questions} questions${
            flushed.flushed
              ? ` · uploaded ${flushed.flushed} pending result(s)`
              : ''
          }.`,
        });
      } catch (err) {
        refreshOffline();
        setSyncMsg({
          ok: false,
          text: `❌ Sync failed: ${
            err instanceof Error ? err.message : 'server unreachable'
          }`,
        });
      } finally {
        setSyncing(false);
      }
    },
    [refreshOffline],
  );

  // First launch convenience: sync once if the local bank is empty and the
  // server is reachable, so offline play works right away.
  useEffect(() => {
    if (stats.questions === 0) {
      doSync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtSync = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : 'never';

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.avatar}>{user?.avatar ?? '🎮'}</Text>
        <Text style={styles.welcome}>Welcome, {user?.username ?? 'Player'}!</Text>
        <Text style={styles.sub}>
          {isGuest
            ? 'Guest mode — offline play, stats stay on this device'
            : user
            ? `Best score: ${formatMoney(user.best_score)} · Games: ${user.total_games}`
            : 'Sign in to track your stats'}
        </Text>

        <View style={styles.menu}>
          <GoldButton
            label="▶  PLAY"
            onPress={() => navigation.navigate('Category')}
          />
          <GhostButton
            label="🏆  Leaderboard"
            onPress={() => navigation.navigate('Leaderboard')}
          />
          <GhostButton
            label="👤  My Profile"
            onPress={() => navigation.navigate('Profile')}
          />
        </View>

        <View style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>📦 Offline data</Text>
          <Text style={styles.offlineText}>
            {stats.questions > 0
              ? `${stats.questions} questions in ${stats.categories} categories · last sync: ${fmtSync(lastSync)}`
              : 'No offline data yet — sync to play without internet.'}
          </Text>
          {pending > 0 && (
            <Text style={styles.offlinePending}>
              ⏳ {pending} result(s) waiting to upload
            </Text>
          )}
          <GhostButton
            label={syncing ? 'Syncing…' : '🔄 Sync offline data'}
            onPress={() => doSync()}
            disabled={syncing}
            style={styles.syncBtn}
          />
          {syncMsg && (
            <Text
              style={[
                styles.syncMsg,
                !syncMsg.ok && styles.syncMsgError,
              ]}>
              {syncMsg.text}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.rulesTitle}>How to win</Text>
          <Text style={styles.rules}>
            Answer 15 questions to reach $1,000,000. Safety nets lock in
            $1,000 after question 5 and $32,000 after question 10. Use your
            lifelines wisely!
          </Text>
        </View>

        <View style={styles.logoutRow}>
          <GhostButton
            label="Log out"
            onPress={async () => {
              await logout();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  avatar: {
    fontSize: 64,
    textAlign: 'center',
  },
  welcome: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 26,
  },
  menu: {
    gap: 12,
  },
  offlineCard: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  offlineTitle: {
    color: colors.gold,
    fontWeight: '700',
    marginBottom: 6,
  },
  offlineText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  offlinePending: {
    color: colors.gold,
    fontSize: 12,
    marginTop: 4,
  },
  syncBtn: {
    marginTop: 12,
  },
  syncMsg: {
    color: colors.green,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  syncMsgError: {
    color: colors.red,
  },
  footer: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rulesTitle: {
    color: colors.gold,
    fontWeight: '700',
    marginBottom: 6,
  },
  rules: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  logoutRow: {
    marginTop: 18,
  },
});
