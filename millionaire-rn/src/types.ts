export interface User {
  id: number;
  username: string;
  email: string | null;
  avatar: string;
  role: string;
  total_games: number;
  total_wins: number;
  best_score: number;
  best_question: number;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at?: string;
}

export interface Question {
  id: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: 'A' | 'B' | 'C' | 'D';
  difficulty: 'easy' | 'medium' | 'hard' | string;
  category: string;
}

export interface LeaderboardEntry {
  id: number;
  username: string;
  avatar: string;
  total_games: number;
  total_wins: number;
  best_score: number;
  best_question: number;
  win_rate: number | null;
}

export interface GameHistoryEntry {
  id: number;
  score: number;
  current_question: number;
  status: 'won' | 'lost' | 'quit' | 'active' | string;
  category_played: string;
  started_at: string;
}

export interface SaveGamePayload {
  playerName?: string;
  score: number;
  currentQuestion: number;
  status: 'won' | 'lost' | 'quit';
  category: string;
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Category: undefined;
  Game: { category: string };
  Result: {
    title: string;
    amount: number;
    message: string;
    category: string;
    isNewRecord?: boolean;
  };
  Leaderboard: undefined;
  Profile: undefined;
  Settings: undefined;
};
