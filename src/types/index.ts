export type HabitCategory = 'life' | 'spiritual';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

export interface Principle {
  id: string;
  user_id: string;
  text: string;
  order_index: number;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  subtitle: string | null;
  category: HabitCategory;
  is_preset: boolean;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  date: string;
  habits_completed: Record<string, boolean>;
  reflection: string | null;
  created_at: string;
}

export type ChatContext =
  | 'evening_checkin'
  | 'struggling'
  | 'principles'
  | 'weekly_review'
  | 'habits_help';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
