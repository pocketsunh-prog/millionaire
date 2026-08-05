import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {startGame} from '../api/game';
import {saveResultOfflineSafe} from '../db/sync';
import {getLocalQuestions} from '../db/repository';
import {useAuth} from '../context/AuthContext';
import {AudiencePoll} from '../components/AudiencePoll';
import {PrizeLadder} from '../components/PrizeLadder';
import {ErrorView, Loading, Screen} from '../components/ui';
import {colors, formatMoney, PRIZE_LEVELS, SAFETY_NETS} from '../theme';
import type {Question, RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const ANSWER_KEYS = ['A', 'B', 'C', 'D'] as const;

function lostPrize(position: number): number {
  // position = 1-based number of the question answered wrong.
  if (position >= 10) return PRIZE_LEVELS[9]; // $32,000
  if (position >= 5) return PRIZE_LEVELS[4]; // $1,000
  return 0;
}

function walkPrize(answered: number): number {
  // answered = number of questions answered correctly.
  if (answered >= 10) return PRIZE_LEVELS[9];
  if (answered >= 5) return PRIZE_LEVELS[4];
  return 0;
}

type LifelineKey = '5050' | 'audience' | 'phone';

export default function GameScreen({route, navigation}: Props) {
  const {category} = route.params;
  const {user} = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  const [index, setIndex] = useState(0); // 0-based index of displayed question
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]); // 50:50 removed answers
  const [audience, setAudience] = useState<Record<string, number> | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [lifelines, setLifelines] = useState<Record<LifelineKey, boolean>>({
    '5050': true,
    audience: true,
    phone: true,
  });

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await startGame(category);
      if (!data.questions.length) {
        throw new Error('No questions available for this category yet.');
      }
      setQuestions(data.questions);
      setOffline(false);
    } catch {
      // Network unreachable → fall back to the local SQLite bank.
      const local = getLocalQuestions(category);
      if (local.length > 0) {
        setQuestions(local);
        setOffline(true);
      } else {
        setError(
          'Server unreachable and no offline data saved. Open the Home screen and tap "Sync offline data" first.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const finish = useCallback(
    async (
      title: string,
      amount: number,
      message: string,
      status: 'won' | 'lost' | 'quit',
      questionNo: number,
      isRecord: boolean,
    ) => {
      if (finished.current) return;
      finished.current = true;
      clearTimers();
      try {
        await saveResultOfflineSafe({
          playerName: user?.username,
          score: amount,
          currentQuestion: questionNo,
          status,
          category,
        });
      } catch {
        // saving is best-effort; still show the result
      }
      navigation.replace('Result', {
        title,
        amount,
        message,
        category,
        isNewRecord: isRecord,
      });
    },
    [category, navigation, user?.username],
  );

  const handleCorrect = useCallback(() => {
    const next = index + 1;
    const currentPrize = PRIZE_LEVELS[index];
    const isRecord = !!user && currentPrize > (user.best_score || 0);
    if (next >= questions.length) {
      finish(
        'CONGRATULATIONS!',
        PRIZE_LEVELS[14],
        'You are a MILLIONAIRE!',
        'won',
        questions.length,
        isRecord,
      );
      return;
    }
    setIndex(next);
    setSelected(null);
    setRevealed(false);
    setRemoved([]);
    setAudience(null);
    setPhoneMsg(null);
  }, [finish, index, questions.length, user]);

  const handleWrong = useCallback(() => {
    const position = index + 1; // 1-based
    const prize = lostPrize(position);
    const correct = questions[index]?.correct_answer ?? '';
    finish(
      'GAME OVER',
      prize,
      `The correct answer was: ${correct}`,
      'lost',
      position,
      false,
    );
  }, [finish, index, questions]);

  const answer = useCallback(
    (key: string) => {
      if (selected || revealed || !questions[index]) return;
      setSelected(key);
      const correct = questions[index].correct_answer;

      // reveal phase
      timers.current.push(
        setTimeout(() => setRevealed(true), 1200),
        setTimeout(() => {
          if (key === correct) {
            handleCorrect();
          } else {
            handleWrong();
          }
        }, 2400),
      );
    },
    [handleCorrect, handleWrong, index, questions, revealed, selected],
  );

  const walkAway = useCallback(() => {
    Alert.alert(
      'Walk away?',
      `You can take ${formatMoney(walkPrize(index))} and quit.`,
      [
        {text: 'Keep playing', style: 'cancel'},
        {
          text: 'Walk away',
          style: 'destructive',
          onPress: () =>
            finish(
              'YOU WALKED AWAY',
              walkPrize(index),
              'Thanks for playing!',
              'quit',
              index + 1,
              false,
            ),
        },
      ],
    );
  }, [finish, index]);

  const applyLifeline = useCallback(
    (type: LifelineKey) => {
      if (!lifelines[type] || selected || revealed || !questions[index]) return;
      setLifelines(l => ({...l, [type]: false}));

      if (type === '5050') {
        const correct = questions[index].correct_answer;
        const wrong = ANSWER_KEYS.filter(k => k !== correct)
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);
        setRemoved(wrong);
      } else if (type === 'audience') {
        const correct = questions[index].correct_answer;
        const pct: Record<string, number> = {};
        let remaining = 100;
        const correctPct = 40 + Math.floor(Math.random() * 35);
        pct[correct] = correctPct;
        remaining -= correctPct;
        const wrong = ANSWER_KEYS.filter(k => k !== correct);
        wrong.forEach((ans, i) => {
          if (i === wrong.length - 1) {
            pct[ans] = remaining;
          } else {
            const part = Math.floor(Math.random() * remaining * 0.6);
            pct[ans] = part;
            remaining -= part;
          }
        });
        setAudience(pct);
      } else {
        const correct = questions[index].correct_answer;
        const confidence = 60 + Math.floor(Math.random() * 30);
        const wrong = ANSWER_KEYS.filter(k => k !== correct);
        const suggestion =
          Math.random() * 100 < confidence
            ? correct
            : wrong[Math.floor(Math.random() * wrong.length)];
        setPhoneMsg(
          `"I'm about ${confidence}% sure the answer is ${suggestion}. That's my best guess!"`,
        );
      }
    },
    [index, lifelines, questions, revealed, selected],
  );

  if (loading) {
    return (
      <Screen>
        <Loading label="Starting game…" />
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

  const q = questions[index];
  const isSafeQuestion = SAFETY_NETS.includes(index + 1);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.category}>{category.toUpperCase()}</Text>
            <Text style={styles.progress}>
              Question {index + 1} of {questions.length} ·{' '}
              <Text style={styles.prize}>{formatMoney(PRIZE_LEVELS[index])}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={walkAway} style={styles.walkBtn}>
            <Text style={styles.walkText}>Walk Away</Text>
          </TouchableOpacity>
        </View>

        {offline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              📴 OFFLINE MODE — playing from saved data. Results will be synced
              when you're back online.
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <PrizeLadder currentIndex={index} />
          <View style={styles.main}>
            <View style={[styles.questionCard, isSafeQuestion && styles.safeCard]}>
              <Text style={styles.questionText}>{q.question}</Text>
              {isSafeQuestion && (
                <Text style={styles.safeBadge}>
                  ▲ Safe level — ${formatMoney(PRIZE_LEVELS[index])}
                </Text>
              )}
            </View>

            {ANSWER_KEYS.map(key => {
              const option = q.options[key];
              const isCorrect = revealed && key === q.correct_answer;
              const isWrongPick = revealed && selected === key && key !== q.correct_answer;
              const isRemoved = removed.includes(key);
              const disabled = isRemoved || !!selected;
              return (
                <TouchableOpacity
                  key={key}
                  disabled={disabled}
                  onPress={() => answer(key)}
                  style={[
                    styles.answer,
                    isCorrect && styles.answerCorrect,
                    isWrongPick && styles.answerWrong,
                    isRemoved && styles.answerRemoved,
                    selected === key && !revealed && styles.answerSelected,
                  ]}>
                  <Text
                    style={[
                      styles.answerKey,
                      isCorrect && styles.answerKeyInverted,
                      isWrongPick && styles.answerKeyInverted,
                    ]}>
                    {key}
                  </Text>
                  <Text
                    style={[
                      styles.answerText,
                      isRemoved && styles.answerTextRemoved,
                    ]}>
                    {isRemoved ? '—' : option}
                  </Text>
                  {isCorrect && <Text style={styles.resultMark}>✓</Text>}
                  {isWrongPick && <Text style={styles.resultMark}>✗</Text>}
                </TouchableOpacity>
              );
            })}

            {audience && <AudiencePoll percentages={audience} />}
            {phoneMsg && (
              <View style={styles.phoneBox}>
                <Text style={styles.phoneTitle}>📞 Phone a Friend</Text>
                <Text style={styles.phoneText}>{phoneMsg}</Text>
              </View>
            )}

            <View style={styles.lifelines}>
              <LifelineBtn
                label="50:50"
                used={!lifelines['5050']}
                onPress={() => applyLifeline('5050')}
              />
              <LifelineBtn
                label="👥 Audience"
                used={!lifelines.audience}
                onPress={() => applyLifeline('audience')}
              />
              <LifelineBtn
                label="📞 Friend"
                used={!lifelines.phone}
                onPress={() => applyLifeline('phone')}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function LifelineBtn({
  label,
  used,
  onPress,
}: {
  label: string;
  used: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={used}
      style={[styles.lifeline, used && styles.lifelineUsed]}>
      <Text style={[styles.lifelineText, used && styles.lifelineTextUsed]}>
        {used ? '✖' : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
  },
  category: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  prize: {
    color: colors.text,
    fontWeight: '800',
  },
  walkBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  walkText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '700',
  },
  offlineBanner: {
    backgroundColor: '#3a3a1a',
    borderColor: colors.goldDark,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  offlineBannerText: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 17,
  },
  body: {
    flexDirection: 'row',
    gap: 10,
  },
  main: {
    flex: 1,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  safeCard: {
    borderColor: colors.goldDark,
  },
  questionText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  safeBadge: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  answerSelected: {
    borderColor: colors.blue,
    backgroundColor: '#1c2a63',
  },
  answerCorrect: {
    borderColor: colors.green,
    backgroundColor: colors.greenDark,
  },
  answerWrong: {
    borderColor: colors.red,
    backgroundColor: colors.redDark,
  },
  answerRemoved: {
    opacity: 0.25,
  },
  answerKey: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
    width: 22,
  },
  answerKeyInverted: {
    color: colors.text,
  },
  answerText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  answerTextRemoved: {
    color: colors.disabled,
  },
  resultMark: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  phoneBox: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  phoneTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  phoneText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  lifelines: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  lifeline: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldDark,
    borderRadius: 18,
    paddingVertical: 9,
  },
  lifelineUsed: {
    borderColor: colors.cardBorder,
    backgroundColor: colors.disabled,
  },
  lifelineText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  lifelineTextUsed: {
    color: colors.background,
  },
});
