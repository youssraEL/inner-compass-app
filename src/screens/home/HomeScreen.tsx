import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../lib/constants';
import { Habit, DailyCheckin } from '../../types';

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [lifeHabits, setLifeHabits] = useState<Habit[]>([]);
  const [spiritualHabits, setSpiritualHabits] = useState<Habit[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const today = getTodayDate();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('order_index');

      const life = (habits ?? []).filter(h => h.category === 'life');
      const spiritual = (habits ?? []).filter(h => h.category === 'spiritual');
      setLifeHabits(life);
      setSpiritualHabits(spiritual);

      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (checkin) {
        setCheckinId(checkin.id);
        setCompleted(checkin.habits_completed ?? {});
        setReflection(checkin.reflection ?? '');
      } else {
        setCheckinId(null);
        setCompleted({});
        setReflection('');
      }
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Focus listener to reload when coming back to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  async function toggleHabit(habitId: string) {
    const newCompleted = { ...completed, [habitId]: !completed[habitId] };
    setCompleted(newCompleted);
    await saveCheckin(newCompleted, reflection);
  }

  async function saveCheckin(habits: Record<string, boolean>, ref: string) {
    if (!user) return;
    setSaving(true);
    try {
      if (checkinId) {
        await supabase
          .from('daily_checkins')
          .update({ habits_completed: habits, reflection: ref })
          .eq('id', checkinId);
      } else {
        const { data } = await supabase
          .from('daily_checkins')
          .insert({ user_id: user.id, date: today, habits_completed: habits, reflection: ref })
          .select()
          .single();
        if (data) setCheckinId(data.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReflectionBlur() {
    if (reflection !== '') {
      await saveCheckin(completed, reflection);
    }
  }

  const lifeCompleted = lifeHabits.filter(h => completed[h.id]).length;
  const spiritualCompleted = spiritualHabits.filter(h => completed[h.id]).length;
  const totalCompleted = lifeCompleted + spiritualCompleted;
  const totalHabits = lifeHabits.length + spiritualHabits.length;

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.greeting}>
              {getGreeting()}, {firstName}
            </Text>
            <Text style={styles.date}>{formatDate(today)}</Text>
          </View>

          {/* Total score */}
          {totalHabits > 0 && (
            <View style={styles.scoreCard}>
              <Text style={styles.scoreText}>
                {totalCompleted}/{totalHabits} habits completed
              </Text>
              <View style={styles.totalBar}>
                <View
                  style={[
                    styles.totalBarFill,
                    { width: `${totalHabits ? (totalCompleted / totalHabits) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Life Habits */}
          {lifeHabits.length > 0 && (
            <HabitSection
              title="Life Habits"
              accent={COLORS.teal}
              accentLight={COLORS.tealLight}
              habits={lifeHabits}
              completed={completed}
              onToggle={toggleHabit}
              completedCount={lifeCompleted}
            />
          )}

          {/* Spiritual Habits */}
          {spiritualHabits.length > 0 && (
            <HabitSection
              title="Spiritual Habits"
              accent={COLORS.amber}
              accentLight={COLORS.amberLight}
              habits={spiritualHabits}
              completed={completed}
              onToggle={toggleHabit}
              completedCount={spiritualCompleted}
            />
          )}

          {/* Evening Reflection */}
          <View style={styles.reflectionSection}>
            <Text style={styles.sectionTitle}>Evening Reflection</Text>
            <Text style={styles.reflectionPrompt}>
              Did I act in line with my principles today?
            </Text>
            <TextInput
              style={styles.reflectionInput}
              value={reflection}
              onChangeText={setReflection}
              onBlur={handleReflectionBlur}
              placeholder="Write your honest reflection..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
            />
            {saving && (
              <Text style={styles.savingText}>Saving...</Text>
            )}
          </View>

          {/* AI Buttons */}
          <View style={styles.aiButtons}>
            <TouchableOpacity
              style={[styles.aiButton, styles.aiButtonPrimary]}
              onPress={() =>
                navigation.navigate('Chat', {
                  context: 'evening_checkin',
                  title: 'Evening Check-in',
                })
              }
            >
              <Text style={styles.aiButtonPrimaryText}>Evening check-in with Claude</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.aiButton, styles.aiButtonSecondary]}
              onPress={() =>
                navigation.navigate('Chat', {
                  context: 'struggling',
                  title: "I'm struggling",
                })
              }
            >
              <Text style={styles.aiButtonSecondaryText}>I'm struggling right now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HabitSection({
  title,
  accent,
  accentLight,
  habits,
  completed,
  onToggle,
  completedCount,
}: {
  title: string;
  accent: string;
  accentLight: string;
  habits: Habit[];
  completed: Record<string, boolean>;
  onToggle: (id: string) => void;
  completedCount: number;
}) {
  return (
    <View style={styles.habitSection}>
      <View style={styles.habitSectionHeader}>
        <Text style={[styles.habitSectionTitle, { color: accent }]}>{title}</Text>
        <Text style={[styles.habitSectionCount, { color: accent }]}>
          {completedCount}/{habits.length}
        </Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: accent,
              width: `${habits.length ? (completedCount / habits.length) * 100 : 0}%`,
            },
          ]}
        />
      </View>

      {habits.map(habit => (
        <TouchableOpacity
          key={habit.id}
          style={[
            styles.habitRow,
            completed[habit.id] && { backgroundColor: accentLight },
          ]}
          onPress={() => onToggle(habit.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              completed[habit.id] && { backgroundColor: accent, borderColor: accent },
            ]}
          >
            {completed[habit.id] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.habitName,
                completed[habit.id] && styles.habitNameCompleted,
              ]}
            >
              {habit.name}
            </Text>
            {habit.subtitle && (
              <Text style={styles.habitSubtitle}>{habit.subtitle}</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  date: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scoreText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: 8,
  },
  totalBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  totalBarFill: {
    height: '100%',
    backgroundColor: COLORS.teal,
    borderRadius: 3,
  },
  habitSection: {
    marginBottom: 24,
  },
  habitSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  habitSectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '700',
  },
  habitName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  habitNameCompleted: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  habitSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  reflectionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  reflectionPrompt: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  reflectionInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
    lineHeight: 20,
  },
  savingText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  aiButtons: {
    gap: 10,
  },
  aiButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  aiButtonPrimary: {
    backgroundColor: COLORS.teal,
  },
  aiButtonSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  aiButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  aiButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
});
