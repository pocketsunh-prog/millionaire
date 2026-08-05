import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import {Screen, GoldButton} from '../components/ui';
import {colors} from '../theme';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({navigation}: Props) {
  const {register} = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigation.reset({index: 0, routes: [{name: 'Home'}]});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>CREATE ACCOUNT</Text>
          <Text style={styles.tagline}>
            Track your best scores on the global leaderboard
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Username (3-50 chars)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Email (optional)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 4 chars)"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <GoldButton label={busy ? 'Creating account…' : 'Create Account'} onPress={submit} disabled={busy} />
          <Text style={styles.hint} onPress={() => navigation.goBack()}>
            Already have an account? <Text style={styles.link}>Sign in</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 40,
  },
  title: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  tagline: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 10,
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
  hint: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  link: {
    color: colors.gold,
    fontWeight: '700',
  },
});
