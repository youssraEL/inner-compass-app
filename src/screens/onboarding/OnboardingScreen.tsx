import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
  COLORS,
  DEFAULT_PRINCIPLES,
  DEFAULT_LIFE_HABITS,
  DEFAULT_SPIRITUAL_HABITS,
} from '../../lib/constants';

type Step = 'welcome' | 'principles' | 'habits' | 'done';

interface HabitItem {
  name: string;
  subtitle: string | null;
  isActive: boolean;
  isPreset: boolean;
}

export default function OnboardingScreen() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [saving, setSaving] = useState(false);

  // Principles state
  const [principles, setPrinciples] = useState<string[]>(DEFAULT_PRINCIPLES.map(p => p));
  const [newPrinciple, setNewPrinciple] = useState('');

  // Habits state
  const [lifeHabits, setLifeHabits] = useState<HabitItem[]>(
    DEFAULT_LIFE_HABITS.map(h => ({ ...h, isActive: true, isPreset: true }))
  );
  const [spiritualHabits, setSpiritualHabits] = useState<HabitItem[]>(
    DEFAULT_SPIRITUAL_HABITS.map(h => ({ ...h, isActive: true, isPreset: true }))
  );
  const [newLifeHabit, setNewLifeHabit] = useState('');
  const [newSpiritualHabit, setNewSpiritualHabit] = useState('');

  function addPrinciple() {
    if (newPrinciple.trim()) {
      setPrinciples([...principles, newPrinciple.trim()]);
      setNewPrinciple('');
    }
  }

  function removePrinciple(index: number) {
    setPrinciples(principles.filter((_, i) => i !== index));
  }

  function updatePrinciple(index: number, text: string) {
    const updated = [...principles];
    updated[index] = text;
    setPrinciples(updated);
  }

  function addLifeHabit() {
    if (newLifeHabit.trim()) {
      setLifeHabits([...lifeHabits, { name: newLifeHabit.trim(), subtitle: null, isActive: true, isPreset: false }]);
      setNewLifeHabit('');
    }
  }

  function addSpiritualHabit() {
    if (newSpiritualHabit.trim()) {
      setSpiritualHabits([...spiritualHabits, { name: newSpiritualHabit.trim(), subtitle: null, isActive: true, isPreset: false }]);
      setNewSpiritualHabit('');
    }
  }

  async function finish() {
    if (!user) return;
    setSaving(true);

    try {
      // Save principles
      const principleRows = principles
        .filter(p => p.trim())
        .map((text, i) => ({
          user_id: user.id,
          text,
          order_index: i,
        }));
      await supabase.from('principles').insert(principleRows);

      // Save habits
      const allHabits = [
        ...lifeHabits.map((h, i) => ({
          user_id: user.id,
          name: h.name,
          subtitle: h.subtitle,
          category: 'life' as const,
          is_preset: h.isPreset,
          is_active: h.isActive,
          order_index: i,
        })),
        ...spiritualHabits.map((h, i) => ({
          user_id: user.id,
          name: h.name,
          subtitle: h.subtitle,
          category: 'spiritual' as const,
          is_preset: h.isPreset,
          is_active: h.isActive,
          order_index: i,
        })),
      ];
      await supabase.from('habits').insert(allHabits);

      // Mark onboarding complete
      await supabase
        .from('users')
        .update({ onboarding_complete: true })
        .eq('id', user.id);

      await refreshUser();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save. Please try again.');
      setSaving(false);
    }
  }

  if (step === 'welcome') return <WelcomeStep onNext={() => setStep('principles')} />;
  if (step === 'principles') {
    return (
      <PrinciplesStep
        principles={principles}
        newPrinciple={newPrinciple}
        onNewPrincipleChange={setNewPrinciple}
        onAdd={addPrinciple}
        onRemove={removePrinciple}
        onUpdate={updatePrinciple}
        onNext={() => setStep('habits')}
        onBack={() => setStep('welcome')}
      />
    );
  }
  if (step === 'habits') {
    return (
      <HabitsStep
        lifeHabits={lifeHabits}
        spiritualHabits={spiritualHabits}
        onToggleLife={(i) => {
          const updated = [...lifeHabits];
          updated[i].isActive = !updated[i].isActive;
          setLifeHabits(updated);
        }}
        onToggleSpiritual={(i) => {
          const updated = [...spiritualHabits];
          updated[i].isActive = !updated[i].isActive;
          setSpiritualHabits(updated);
        }}
        newLifeHabit={newLifeHabit}
        newSpiritualHabit={newSpiritualHabit}
        onNewLifeHabitChange={setNewLifeHabit}
        onNewSpiritualHabitChange={setNewSpiritualHabit}
        onAddLife={addLifeHabit}
        onAddSpiritual={addSpiritualHabit}
        onNext={() => setStep('done')}
        onBack={() => setStep('principles')}
      />
    );
  }
  return <DoneStep onFinish={finish} saving={saving} />;
}

// ── Welcome Step ──────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepEmoji}>◎</Text>
          <Text style={styles.stepTitle}>Welcome to Inner Compass</Text>
          <Text style={styles.stepSubtitle}>
            This app helps you build a strong, self-validated identity — one day at a time.
          </Text>
        </View>

        <View style={styles.welcomePoints}>
          <WelcomePoint
            title="Define your principles"
            desc="The non-negotiable beliefs that guide your decisions"
          />
          <WelcomePoint
            title="Build daily habits"
            desc="Small consistent actions that compound into character"
          />
          <WelcomePoint
            title="Reflect honestly"
            desc="Evening check-ins with an AI coach to track your alignment"
          />
          <WelcomePoint
            title="Own your growth"
            desc="No approval needed — your compass points inward"
          />
        </View>

        <View style={styles.stepFooter}>
          <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryButtonText}>Let's set you up →</Text>
          </TouchableOpacity>
          <Text style={styles.stepCount}>Step 1 of 3</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function WelcomePoint({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={styles.welcomePoint}>
      <View style={styles.welcomeDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.welcomePointTitle}>{title}</Text>
        <Text style={styles.welcomePointDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ── Principles Step ───────────────────────────────────────────────────────────

function PrinciplesStep({
  principles,
  newPrinciple,
  onNewPrincipleChange,
  onAdd,
  onRemove,
  onUpdate,
  onNext,
  onBack,
}: {
  principles: string[];
  newPrinciple: string;
  onNewPrincipleChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.stepTitle}>Your Principles</Text>
          <Text style={styles.stepSubtitle}>
            These are the beliefs you live by. Edit, remove, or add your own.
          </Text>

          {principles.map((p, i) => (
            <View key={i} style={styles.principleRow}>
              <TextInput
                style={styles.principleInput}
                value={p}
                onChangeText={(v) => onUpdate(i, v)}
                multiline
                placeholder="Your principle..."
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity onPress={() => onRemove(i)} style={styles.removeButton}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addRow}>
            <TextInput
              style={[styles.principleInput, { flex: 1 }]}
              value={newPrinciple}
              onChangeText={onNewPrincipleChange}
              placeholder="Add a new principle..."
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={onAdd}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={onAdd}
              style={[styles.addButton, !newPrinciple.trim() && styles.addButtonDisabled]}
              disabled={!newPrinciple.trim()}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.stepFooter, { marginTop: 32 }]}>
            <TouchableOpacity
              style={[styles.primaryButton, principles.length === 0 && styles.primaryButtonDisabled]}
              onPress={onNext}
              disabled={principles.length === 0}
            >
              <Text style={styles.primaryButtonText}>Continue →</Text>
            </TouchableOpacity>
            <Text style={styles.stepCount}>Step 2 of 3</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Habits Step ───────────────────────────────────────────────────────────────

interface HabitItem {
  name: string;
  subtitle: string | null;
  isActive: boolean;
  isPreset: boolean;
}

function HabitsStep({
  lifeHabits,
  spiritualHabits,
  onToggleLife,
  onToggleSpiritual,
  newLifeHabit,
  newSpiritualHabit,
  onNewLifeHabitChange,
  onNewSpiritualHabitChange,
  onAddLife,
  onAddSpiritual,
  onNext,
  onBack,
}: {
  lifeHabits: HabitItem[];
  spiritualHabits: HabitItem[];
  onToggleLife: (i: number) => void;
  onToggleSpiritual: (i: number) => void;
  newLifeHabit: string;
  newSpiritualHabit: string;
  onNewLifeHabitChange: (v: string) => void;
  onNewSpiritualHabitChange: (v: string) => void;
  onAddLife: () => void;
  onAddSpiritual: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.stepTitle}>Daily Habits</Text>
          <Text style={styles.stepSubtitle}>
            Choose the habits you want to track every day. Toggle off any you don't want right now.
          </Text>

          <HabitSection
            title="Life Habits"
            accent={COLORS.teal}
            accentLight={COLORS.tealLight}
            habits={lifeHabits}
            onToggle={onToggleLife}
            newHabit={newLifeHabit}
            onNewHabitChange={onNewLifeHabitChange}
            onAdd={onAddLife}
          />

          <HabitSection
            title="Spiritual Habits"
            accent={COLORS.amber}
            accentLight={COLORS.amberLight}
            habits={spiritualHabits}
            onToggle={onToggleSpiritual}
            newHabit={newSpiritualHabit}
            onNewHabitChange={onNewSpiritualHabitChange}
            onAdd={onAddSpiritual}
          />

          <View style={[styles.stepFooter, { marginTop: 32 }]}>
            <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
              <Text style={styles.primaryButtonText}>Continue →</Text>
            </TouchableOpacity>
            <Text style={styles.stepCount}>Step 3 of 3</Text>
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
  onToggle,
  newHabit,
  onNewHabitChange,
  onAdd,
}: {
  title: string;
  accent: string;
  accentLight: string;
  habits: HabitItem[];
  onToggle: (i: number) => void;
  newHabit: string;
  onNewHabitChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.habitSection}>
      <Text style={[styles.habitSectionTitle, { color: accent }]}>{title}</Text>
      {habits.map((h, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.habitRow, h.isActive && { backgroundColor: accentLight }]}
          onPress={() => onToggle(i)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, h.isActive && { backgroundColor: accent, borderColor: accent }]}>
            {h.isActive && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.habitName, !h.isActive && styles.habitNameInactive]}>
              {h.name}
            </Text>
            {h.subtitle && (
              <Text style={styles.habitSubtitle}>{h.subtitle}</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.habitAddInput, { flex: 1 }]}
          value={newHabit}
          onChangeText={onNewHabitChange}
          placeholder="Add custom habit..."
          placeholderTextColor={COLORS.textMuted}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={onAdd}
          style={[styles.addButton, !newHabit.trim() && styles.addButtonDisabled]}
          disabled={!newHabit.trim()}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Done Step ─────────────────────────────────────────────────────────────────

function DoneStep({ onFinish, saving }: { onFinish: () => void; saving: boolean }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepEmoji}>✦</Text>
          <Text style={styles.stepTitle}>You're all set</Text>
          <Text style={styles.stepSubtitle}>
            Your principles and habits are saved. Start checking in daily to build your compass.
          </Text>
        </View>

        <View style={styles.donePoints}>
          <Text style={styles.donePoint}>✓ Principles defined</Text>
          <Text style={styles.donePoint}>✓ Daily habits selected</Text>
          <Text style={styles.donePoint}>✓ Evening check-ins ready</Text>
        </View>

        <View style={styles.stepFooter}>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={onFinish}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Let's start →</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    paddingTop: 16,
  },
  backButton: {
    marginBottom: 20,
  },
  backText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  stepHeader: {
    marginTop: 60,
    alignItems: 'center',
  },
  stepEmoji: {
    fontSize: 48,
    color: COLORS.teal,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  welcomePoints: {
    gap: 20,
    paddingHorizontal: 8,
  },
  welcomePoint: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  welcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.teal,
    marginTop: 5,
  },
  welcomePointTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  welcomePointDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  principleInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    lineHeight: 20,
  },
  removeButton: {
    padding: 12,
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  habitAddInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  addButtonText: {
    fontSize: 22,
    color: COLORS.white,
    lineHeight: 26,
  },
  stepFooter: {
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  stepCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  habitSection: {
    marginBottom: 28,
  },
  habitSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
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
  habitNameInactive: {
    color: COLORS.textMuted,
  },
  habitSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  donePoints: {
    gap: 16,
    alignItems: 'center',
  },
  donePoint: {
    fontSize: 16,
    color: COLORS.teal,
    fontWeight: '500',
  },
});
