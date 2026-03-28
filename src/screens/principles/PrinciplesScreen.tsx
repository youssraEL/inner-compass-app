import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../lib/constants';
import { Principle } from '../../types';

export default function PrinciplesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('principles')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index');
    setPrinciples((data ?? []) as Principle[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function addPrinciple() {
    if (!newText.trim() || !user) return;
    setSaving(true);
    const orderIndex = principles.length;
    const { data, error } = await supabase
      .from('principles')
      .insert({ user_id: user.id, text: newText.trim(), order_index: orderIndex })
      .select()
      .single();
    if (!error && data) {
      setPrinciples(prev => [...prev, data as Principle]);
      setNewText('');
    }
    setSaving(false);
  }

  async function startEdit(p: Principle) {
    setEditingId(p.id);
    setEditText(p.text);
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    await supabase.from('principles').update({ text: editText.trim() }).eq('id', id);
    setPrinciples(prev =>
      prev.map(p => (p.id === id ? { ...p, text: editText.trim() } : p))
    );
    setEditingId(null);
  }

  async function deletePrinciple(id: string) {
    Alert.alert('Delete principle?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('principles').delete().eq('id', id);
          const updated = principles.filter(p => p.id !== id);
          setPrinciples(updated);
          // Reindex
          for (let i = 0; i < updated.length; i++) {
            await supabase.from('principles').update({ order_index: i }).eq('id', updated[i].id);
          }
        },
      },
    ]);
  }

  async function moveUp(index: number) {
    if (index === 0) return;
    const updated = [...principles];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setPrinciples(updated);
    await supabase.from('principles').update({ order_index: index - 1 }).eq('id', updated[index - 1].id);
    await supabase.from('principles').update({ order_index: index }).eq('id', updated[index].id);
  }

  async function moveDown(index: number) {
    if (index === principles.length - 1) return;
    const updated = [...principles];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setPrinciples(updated);
    await supabase.from('principles').update({ order_index: index }).eq('id', updated[index].id);
    await supabase.from('principles').update({ order_index: index + 1 }).eq('id', updated[index + 1].id);
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
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Principles</Text>
          <Text style={styles.screenSubtitle}>{principles.length} guiding beliefs</Text>
        </View>

        <FlatList
          data={principles}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No principles yet. Add your first one below.</Text>
          }
          renderItem={({ item, index }) => (
            <PrincipleCard
              principle={item}
              index={index}
              total={principles.length}
              isEditing={editingId === item.id}
              editText={editText}
              onEditTextChange={setEditText}
              onStartEdit={() => startEdit(item)}
              onSaveEdit={() => saveEdit(item.id)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => deletePrinciple(item.id)}
              onMoveUp={() => moveUp(index)}
              onMoveDown={() => moveDown(index)}
            />
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.addInput, { flex: 1 }]}
                  value={newText}
                  onChangeText={setNewText}
                  placeholder="Add a new principle..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  returnKeyType="done"
                  onSubmitEditing={addPrinciple}
                />
                <TouchableOpacity
                  onPress={addPrinciple}
                  disabled={!newText.trim() || saving}
                  style={[styles.addButton, (!newText.trim() || saving) && styles.addButtonDisabled]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.addButtonText}>+</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.aiButton}
                onPress={() =>
                  navigation.navigate('Chat', {
                    context: 'principles',
                    title: 'Define a Principle',
                  })
                }
              >
                <Text style={styles.aiButtonText}>✦ Help me define a new principle</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrincipleCard({
  principle,
  index,
  total,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  principle: Principle;
  index: number;
  total: number;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardNumber}>{index + 1}</Text>
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={index === 0}
            style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
          >
            <Text style={styles.reorderText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={index === total - 1}
            style={[styles.reorderBtn, index === total - 1 && styles.reorderBtnDisabled]}
          >
            <Text style={styles.reorderText}>↓</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardBody}>
        {isEditing ? (
          <>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={onEditTextChange}
              multiline
              autoFocus
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={onSaveEdit} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancelEdit} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={onStartEdit} activeOpacity={0.7}>
            <Text style={styles.principleText}>{principle.text}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isEditing && (
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
    gap: 10,
  },
  cardLeft: {
    alignItems: 'center',
    gap: 4,
  },
  cardNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.teal,
    width: 20,
    textAlign: 'center',
  },
  reorderButtons: {
    gap: 2,
  },
  reorderBtn: {
    padding: 2,
  },
  reorderBtnDisabled: {
    opacity: 0.2,
  },
  reorderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cardBody: {
    flex: 1,
  },
  principleText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  editInput: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelButtonText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  footer: {
    marginTop: 16,
    gap: 12,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  addInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    lineHeight: 20,
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
  aiButton: {
    backgroundColor: COLORS.tealLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.teal + '40',
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.teal,
  },
});
