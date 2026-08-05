import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import {ApiError} from '../api/client';
import {Screen, GoldButton} from '../components/ui';
import {colors} from '../theme';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({navigation}: Props) {
  const {login, loginOffline, loginAsGuest} = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const enterHome = () =>
    navigation.reset({index: 0, routes: [{name: 'Home'}]});

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your username/email and password.');
      return;
    }
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await login(identifier.trim(), password);
      enterHome();
    } catch (err) {
      // Server unreachable → try verifying against locally cached credentials.
      if (err instanceof ApiError && err.status === 0) {
        const cached = await loginOffline(identifier.trim(), password);
        if (cached) {
          setInfo(
            `Logged in offline as ${cached.username}. Stats will sync when you sign in online.`,
          );
          enterHome();
          return;
        }
        setError(
          'Offline: cannot verify these credentials. Sign in once while connected to enable offline login, or use guest mode.',
        );
        return;
      }
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.logo}>💎</Text>
          <Text style={styles.title}>WHO WANTS TO BE</Text>
          <Text style={styles.subtitle}>A MILLIONAIRE</Text>
          <Text style={styles.tagline}>Sign in to play</Text>

          <TextInput
            style={styles.input}
            placeholder="Username or email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!info && <Text style={styles.info}>{info}</Text>}

          <GoldButton label={busy ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={busy} />
          <Text style={styles.hint} onPress={() => navigation.navigate('Register')}>
            New player? <Text style={styles.link}>Create an account</Text>
          </Text>
          <View style={styles.serverRow}>
            <Text
              style={styles.serverLink}
              onPress={() => navigation.navigate('Settings')}>
              ⚙️ Server Settings
            </Text>
            <Text
              style={styles.offlineLink}
              onPress={async () => {
                await loginAsGuest();
                enterHome();
              }}>
              📴 Play offline (guest)
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 40,
  },
  logo: {fontSize: 48, textAlign: 'center'},
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tagline: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 8,
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
  error: {
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
  },
  info: {
    color: colors.green,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  hint: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  link: {
    color: colors.gold,
    fontWeight: '700',
  },
  serverRow: {
    marginTop: 18,
    alignItems: 'center',
    gap: 6,
  },
  serverLink: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
    padding: 8,
  },
  offlineLink: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
    padding: 8,
  },
});
