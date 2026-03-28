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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../lib/constants';
import { Habit, HabitCategory } from '../../types';

export default function HabitsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [lifeHabits, setLifeHabits] = useState<Habit[]>([]);
  const [spiritualHabits, setSpiritualHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLifeName, setNewLifeName] = useState('');
  const [newLifeSubtitle, setNewLifeSubtitle] = useState('');
  const [newSpiritualName, setNewSpiritualName] = useState('');
  const [newSpiritualSubtitle, setNewSpiritualSubtitle] = useState('');
  const [showAddLife, setShowAddLife] = useState(false);
  const [showAddSpiritual, setShowAddSpiritual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index');

    const all = (data ?? []) as Habit[];
    setLifeHabits(all.filter(h => h.category === 'life'));
    setSpiritualHabits(all.filter(h => h.category === 'spiritual'));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function toggleHabit(habit: Habit) {
    const updated = !habit.is_active;
    await supabase.from('habits').update({ is_active: updated }).eq('id', habit.id);
    const update = (list: Habit[]) =>
      list.map(h => (h.id === habit.id ? { ...h, is_active: updated } : h));
    if (habit.category === 'life') setLifeHabits(update);
    else setSpiritualHabits(update);
  }

  async function addHabit(category: HabitCategory) {
    if (!user) return;
    const name = category === 'life' ? newLifeName : newSpiritualName;
    const subtitle = category === 'life' ? newLifeSubtitle : newSpiritualSubtitle;
    if (!name.trim()) return;

    const list = category === 'life' ? lifeHabits : spiritualHabits;
    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        name: name.trim(),
        subtitle: subtitle.trim() || null,
        category,
        is_preset: false,
        is_active: true,
        order_index: list.length,
      })
      .select()
      .single();

    if (!error && data) {
      if (category === 'life') {
        setLifeHabits(prev => [...prev, data as Habit]);
        setNewLifeName('');
        setNewLifeSubtitle('');
        setShowAddLife(false);
      } else {
        setSpiritualHabits(prev => [...prev, data as Habit]);
        setNewSpiritualName('');
        setNewSpiritualSubtitle('');
        setShowAddSpiritual(false);
      }
    }
  }

  async function deleteHabit(habit: Habit) {
    if (habit.is_preset) {
      Alert.alert('Cannot delete', 'Built-in habits can be toggled off but not deleted.');
      return;
    }
    Alert.alert('Delete habit?', `"${habit.name}" will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('habits').delete().eq('id', habit.id);
          if (habit.category === 'life') {
            setLifeHabits(prev => prev.filter(h => h.id !== habit.id));
          } else {
            setSpiritualHabits(prev => prev.filter(h => h.id !== habit.id));
          }
        },
      },
    ]);
  }

  async function saveEdit(habit: Habit) {
    if (!editName.trim()) return;
    await supabase.from('habits').update({ name: editName.trim() }).eq('id', habit.id);
    const update = (list: Habit[]) =>
      list.map(h => (h.id === habit.id ? { ...h, name: editName.trim() } : h));
    if (habit.category === 'life') setLifeHabits(update);
    else setSpiritualHabits(update);
    setEditingId(null);
  }

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
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Manage Habits</Text>
            <Text style={styles.screenSubtitle}>Toggle, edit, or add habits to your daily routine</Text>
          </View>

          <HabitSectionBlock
            title="Life Habits"
            accent={COLORS.teal}
            accentLight={COLORS.tealLight}
            habits={lifeHabits}
            editingId={editingId}
            editName={editName}
            onEditNameChange={setEditName}
            onStartEdit={(h) => { setEditingId(h.id); setEditName(h.name); }}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onToggle={toggleHabit}
            onDelete={deleteHabit}
            showAdd={showAddLife}
            newName={newLifeName}
            newSubtitle={newLifeSubtitle}
            onNewNameChange={setNewLifeName}
            onNewSubtitleChange={setNewLifeSubtitle}
            onShowAdd={() => setShowAddLife(true)}
            onAdd={() => addHabit('life')}
            onCancelAdd={() => { setShowAddLife(false); setNewLifeName(''); setNewLifeSubtitle(''); }}
          />

          <HabitSectionBlock
            title="Spiritual Habits"
            accent={COLORS.amber}
            accentLight={COLORS.amberLight}
            habits={spiritualHabits}
            editingId={editingId}
            editName={editName}
            onEditNameChange={setEditName}
            onStartEdit={(h) => { setEditingId(h.id); setEditName(h.name); }}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onToggle={toggleHabit}
            onDelete={deleteHabit}
            showAdd={showAddSpiritual}
            newName={newSpiritualName}
            newSubtitle={newSpiritualSubtitle}
            onNewNameChange={setNewSpiritualName}
            onNewSubtitleChange={setNewSpiritualSubtitle}
            onShowAdd={() => setShowAddSpiritual(true)}
            onAdd={() => addHabit('spiritual')}
            onCancelAdd={() => { setShowAddSpiritual(false); setNewSpiritualName(''); setNewSpiritualSubtitle(''); }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HabitSectionBlock({
  title, accent, accentLight, habits,
  editingId, editName, onEditNameChange, onStartEdit, onSaveEdit, onCancelEdit,
  onToggle, onDelete,
  showAdd, newName, newSubtitle, onNewNameChange, onNewSubtitleChange,
  onShowAdd, onAdd, onCancelAdd,
}: {
  title: string;
  accent: string;
  accentLight: string;
  habits: Habit[];
  editingId: string | null;
  editName: string;
  onEditNameChange: (v: string) => void;
  onStartEdit: (h: Habit) => void;
  onSaveEdit: (h: Habit) => void;
  onCancelEdit: () => void;
  onToggle: (h: Habit) => void;
  onDelete: (h: Habit) => void;
  showAdd: boolean;
  newName: string;
  newSubtitle: string;
  onNewNameChange: (v: string) => void;
  onNewSubtitleChange: (v: string) => void;
  onShowAdd: () => void;
  onAdd: () => void;
  onCancelAdd: () => void;
}) {
  const activeCount = habits.filter(h => h.is_active).length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: accent }]}>{title}</Text>
        <Text style={[styles.sectionCount, { color: accent }]}>{activeCount} active</Text>
      </View>

      {habits.map(habit => (
        <HabitRow
          key={habit.id}
          habit={habit}
          accent={accent}
          accentLight={accentLight}
          isEditing={editingId === habit.id}
          editName={editName}
          onEditNameChange={onEditNameChange}
          onStartEdit={() => onStartEdit(habit)}
          onSaveEdit={() => onSaveEdit(habit)}
          onCancelEdit={onCancelEdit}
          onToggle={() => onToggle(habit)}
          onDelete={() => onDelete(habit)}
        />
      ))}

      {showAdd ? (
        <View style={styles.addForm}>
          <TextInput
            style={styles.addInput}
            value={newName}
            onChangeText={onNewNameChange}
            placeholder="Habit name *"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          <TextInput
            style={styles.addInput}
            value={newSubtitle}
            onChangeText={onNewSubtitleChange}
            placeholder="Subtitle (optional)"
            placeholderTextColor={COLORS.textMuted}
          />
          <View style={styles.addFormActions}>
            <TouchableOpacity
              onPress={onAdd}
              disabled={!newName.trim()}
              style={[styles.saveButton, !newName.trim() && styles.saveButtonDisabled, { backgroundColor: accent }]}
            >
              <Text style={styles.saveButtonText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancelAdd} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={onShowAdd} style={[styles.addRowButton, { borderColor: accent + '40' }]}>
          <Text style={[styles.addRowText, { color: accent }]}>+ Add custom habit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HabitRow({
  habit, accent, accentLight,
  isEditing, editName, onEditNameChange,
  onStartEdit, onSaveEdit, onCancelEdit,
  onToggle, onDelete,
}: {
  habit: Habit;
  accent: string;
  accentLight: string;
  isEditing: boolean;
  editName: string;
  onEditNameChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.habitRow, habit.is_active && { backgroundColor: accentLight }]}>
      <Switch
        value={habit.is_active}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: accent + '60' }}
        thumbColor={habit.is_active ? accent : '#ccc'}
        style={styles.switch}
      />
      <View style={{ flex: 1 }}>
        {isEditing ? (
          <>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={onEditNameChange}
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={onSaveEdit} style={[styles.saveButton, { backgroundColor: accent }]}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancelEdit} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={onStartEdit} activeOpacity={0.7}>
            <Text style={[styles.habitName, !habit.is_active && styles.habitNameInactive]}>
              {habit.name}
            </Text>
            {habit.subtitle && (
              <Text style={styles.habitSubtitle}>{habit.subtitle}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!habit.is_preset && !isEditing && (
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      )}
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
  screenSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
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
  editInput: {
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    padding: 6,
  },
  deleteText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  addRowButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addForm: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addFormActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
