import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../lib/constants';
import { DailyCheckin, Habit } from '../../types';

interface DayData {
  date: string;
  lifeTotal: number;
  lifeDone: number;
  spiritualTotal: number;
  spiritualDone: number;
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function computeStreak(days: DayData[], category: 'life' | 'spiritual'): number {
  let streak = 0;
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  for (const day of sorted) {
    const total = category === 'life' ? day.lifeTotal : day.spiritualTotal;
    const done = category === 'life' ? day.lifeDone : day.spiritualDone;
    if (total > 0 && done === total) streak++;
    else break;
  }
  return streak;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Last 35 days (5 weeks grid)
    const startDate = getDateStr(34);
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('date, habits_completed')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .order('date');

    const { data: habits } = await supabase
      .from('habits')
      .select('id, category')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!habits) { setLoading(false); return; }

    const lifeHabits = habits.filter(h => h.category === 'life');
    const spiritualHabits = habits.filter(h => h.category === 'spiritual');

    const checkinMap: Record<string, DailyCheckin['habits_completed']> = {};
    for (const c of checkins ?? []) {
      checkinMap[c.date] = c.habits_completed ?? {};
    }

    const result: DayData[] = [];
    for (let i = 34; i >= 0; i--) {
      const date = getDateStr(i);
      const hc = checkinMap[date] ?? {};
      result.push({
        date,
        lifeTotal: lifeHabits.length,
        lifeDone: lifeHabits.filter(h => hc[h.id]).length,
        spiritualTotal: spiritualHabits.length,
        spiritualDone: spiritualHabits.filter(h => hc[h.id]).length,
      });
    }

    setDays(result);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const lifeStreak = computeStreak(days, 'life');
  const spiritualStreak = computeStreak(days, 'spiritual');
  const last7 = days.slice(-7).reverse();

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>History</Text>
        </View>

        {/* Streak counters */}
        <View style={styles.streakRow}>
          <StreakCard
            label="Life streak"
            streak={lifeStreak}
            accent={COLORS.teal}
            accentLight={COLORS.tealLight}
          />
          <StreakCard
            label="Spiritual streak"
            streak={spiritualStreak}
            accent={COLORS.amber}
            accentLight={COLORS.amberLight}
          />
        </View>

        {/* Weekly dot grid */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionLabel}>Last 5 Weeks</Text>
          <DotGrid days={days} />
          <View style={styles.gridLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.teal }]} />
              <Text style={styles.legendText}>Life</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.amber }]} />
              <Text style={styles.legendText}>Spiritual</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.border }]} />
              <Text style={styles.legendText}>None</Text>
            </View>
          </View>
        </View>

        {/* Last 7 days list */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionLabel}>Last 7 Days</Text>
          {last7.map(day => (
            <DayRow key={day.date} day={day} />
          ))}
        </View>

        {/* Review button */}
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() =>
            navigation.navigate('Chat', { context: 'weekly_review', title: 'Weekly Review' })
          }
        >
          <Text style={styles.reviewButtonText}>✦ Review my week with Claude</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StreakCard({
  label,
  streak,
  accent,
  accentLight,
}: {
  label: string;
  streak: number;
  accent: string;
  accentLight: string;
}) {
  return (
    <View style={[styles.streakCard, { backgroundColor: accentLight, borderColor: accent + '30' }]}>
      <Text style={[styles.streakNumber, { color: accent }]}>{streak}</Text>
      <Text style={styles.streakDays}>{streak === 1 ? 'day' : 'days'}</Text>
      <Text style={styles.streakLabel}>{label}</Text>
    </View>
  );
}

function DotGrid({ days }: { days: DayData[] }) {
  // 5 rows x 7 cols
  const weeks: DayData[][] = [];
  for (let i = 0; i < 5; i++) {
    weeks.push(days.slice(i * 7, i * 7 + 7));
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.grid}>
      <View style={styles.gridDayRow}>
        {dayLabels.map(d => (
          <Text key={d} style={styles.gridDayLabel}>{d[0]}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.gridRow}>
          {week.map((day, di) => {
            const lifeRatio = day.lifeTotal ? day.lifeDone / day.lifeTotal : 0;
            const spiritRatio = day.spiritualTotal ? day.spiritualDone / day.spiritualTotal : 0;
            const lifeFull = lifeRatio === 1 && day.lifeTotal > 0;
            const spiritFull = spiritRatio === 1 && day.spiritualTotal > 0;
            const lifePartial = lifeRatio > 0 && lifeRatio < 1;
            const spiritPartial = spiritRatio > 0 && spiritRatio < 1;

            return (
              <View key={di} style={styles.dotCell}>
                <DotPair
                  lifeColor={lifeFull ? COLORS.teal : lifePartial ? COLORS.teal + '60' : COLORS.border}
                  spiritColor={spiritFull ? COLORS.amber : spiritPartial ? COLORS.amber + '60' : COLORS.border}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DotPair({ lifeColor, spiritColor }: { lifeColor: string; spiritColor: string }) {
  return (
    <View style={styles.dotPair}>
      <View style={[styles.dot, { backgroundColor: lifeColor }]} />
      <View style={[styles.dot, { backgroundColor: spiritColor }]} />
    </View>
  );
}

function DayRow({ day }: { day: DayData }) {
  const lifeScore = day.lifeTotal ? `${day.lifeDone}/${day.lifeTotal}` : '—';
  const spiritScore = day.spiritualTotal ? `${day.spiritualDone}/${day.spiritualTotal}` : '—';

  return (
    <View style={styles.dayRow}>
      <Text style={styles.dayRowDate}>{formatShortDate(day.date)}</Text>
      <View style={styles.dayRowScores}>
        <View style={[styles.scoreChip, { backgroundColor: COLORS.tealLight }]}>
          <Text style={[styles.scoreChipText, { color: COLORS.teal }]}>{lifeScore}</Text>
        </View>
        <View style={[styles.scoreChip, { backgroundColor: COLORS.amberLight }]}>
          <Text style={[styles.scoreChipText, { color: COLORS.amber }]}>{spiritScore}</Text>
        </View>
      </View>
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
  scrollContent: {
    paddingBottom: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
  },
  streakCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  streakDays: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -2,
  },
  streakLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  gridSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  grid: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridDayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  gridDayLabel: {
    flex: 1,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dotCell: {
    flex: 1,
    alignItems: 'center',
  },
  dotPair: {
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gridLegend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayRowDate: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  dayRowScores: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reviewButton: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
});
