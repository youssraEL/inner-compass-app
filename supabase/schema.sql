-- Inner Compass — Supabase Schema
-- Run this in your Supabase SQL Editor

-- ────────────────────────────────────────
-- 1. Users
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users: select own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users: insert own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users: update own" ON public.users
  FOR UPDATE USING (auth.uid() = id);


-- ────────────────────────────────────────
-- 2. Principles
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Principles: select own" ON public.principles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Principles: insert own" ON public.principles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Principles: update own" ON public.principles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Principles: delete own" ON public.principles
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS principles_user_id_idx ON public.principles(user_id);


-- ────────────────────────────────────────
-- 3. Habits
-- ────────────────────────────────────────
CREATE TYPE IF NOT EXISTS habit_category AS ENUM ('life', 'spiritual');

CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subtitle TEXT,
  category habit_category NOT NULL,
  is_preset BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Habits: select own" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Habits: insert own" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Habits: update own" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Habits: delete own" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits(user_id);


-- ────────────────────────────────────────
-- 4. Daily Check-ins
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  habits_completed JSONB NOT NULL DEFAULT '{}',
  reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checkins: select own" ON public.daily_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Checkins: insert own" ON public.daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Checkins: update own" ON public.daily_checkins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Checkins: delete own" ON public.daily_checkins
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checkins_user_date_idx ON public.daily_checkins(user_id, date DESC);
