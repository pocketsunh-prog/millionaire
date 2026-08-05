import React, {useCallback, useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {api} from '../api/client';
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrl,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../config';
import {Card, GhostButton, GoldButton, Screen} from '../components/ui';
import {colors} from '../theme';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen(_props: Props) {
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ok: boolean; text: string} | null>(
    null,
  );

  const load = useCallback(async () => {
    const current = await getApiBaseUrl();
    setUrl(current);
    setSavedUrl(current);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setMessage({
        ok: false,
        text: 'URL must start with http:// or https://',
      });
      return;
    }
    setBusy(true);
    try {
      await setApiBaseUrl(trimmed);
      setSavedUrl(trimmed);
      setMessage({ok: true, text: `Saved. New server URL: ${trimmed}`});
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const target = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(target)) {
      setMessage({ok: false, text: 'Enter a valid URL first (http://…)'});
      return;
    }
    setBusy(true);
    setMessage(null);
    const start = Date.now();
    try {
      await api.get<unknown[]>('/api/categories');
      const ms = Date.now() - start;
      setMessage({ok: true, text: `✅ Connected in ${ms} ms`});
    } catch (err) {
      setMessage({
        ok: false,
        text: `❌ ${err instanceof Error ? err.message : 'Connection failed'}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    await resetApiBaseUrl();
    const def = DEFAULT_API_BASE_URL;
    setUrl(def);
    setSavedUrl(def);
    setMessage({ok: true, text: 'Reset to default URL.'});
  };

  const isDirty = url.trim().replace(/\/+$/, '') !== savedUrl;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.help}>
            Set the server address of the Millionaire backend. Useful when your
            PC's IP changes or you move to a different network.
          </Text>

          <Text style={styles.label}>SERVER URL</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.50:8080"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={t => {
              setUrl(t);
              setMessage(null);
            }}
          />

          <GoldButton
            label={busy ? 'Working…' : 'Save URL'}
            onPress={save}
            disabled={busy || !isDirty}
          />
          <GhostButton label="Test Connection" onPress={test} disabled={busy} />
          <GhostButton label="Reset to Default" onPress={reset} />

          {message && (
            <Text
              style={[styles.message, !message.ok && styles.messageError]}>
              {message.text}
            </Text>
          )}

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Current server</Text>
            <Text style={styles.cardUrl}>{savedUrl || DEFAULT_API_BASE_URL}</Text>
            <Text style={styles.cardHint}>
              Default: {DEFAULT_API_BASE_URL}
            </Text>
            <Text style={styles.cardHint}>
              Android emulator: use http://10.0.2.2:8080 to reach your PC's
              localhost.
            </Text>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {
    flex: 1,
    gap: 12,
  },
  help: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
  },
  message: {
    color: colors.green,
    fontSize: 13,
    textAlign: 'center',
  },
  messageError: {
    color: colors.red,
  },
  card: {
    marginTop: 8,
  },
  cardTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardUrl: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
