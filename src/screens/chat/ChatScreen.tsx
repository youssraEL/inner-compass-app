import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../lib/constants';
import { getSystemPrompt } from '../../lib/systemPrompts';
import { ChatContext, ChatMessage } from '../../types';

type ChatRouteParams = {
  Chat: {
    context: ChatContext;
    title: string;
  };
};

// Claude API calls go through a Supabase Edge Function (supabase/functions/chat/).
// The ANTHROPIC_API_KEY is stored as an EAS/Supabase secret — never in the app bundle.
const CHAT_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/chat`;

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ChatRouteParams, 'Chat'>>();
  const { context, title } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<boolean>(false);

  const buildExtraContext = useCallback(async (): Promise<string> => {
    if (!user) return '';
    const parts: string[] = [];

    // Always load principles
    const { data: principles } = await supabase
      .from('principles')
      .select('text')
      .eq('user_id', user.id)
      .order('order_index');

    if (principles?.length) {
      parts.push('User\'s principles:\n' + principles.map((p, i) => `${i + 1}. ${p.text}`).join('\n'));
    }

    if (context === 'evening_checkin' || context === 'weekly_review') {
      const today = new Date().toISOString().split('T')[0];
      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('habits_completed, reflection')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (checkin) {
        const { data: habits } = await supabase
          .from('habits')
          .select('id, name, category')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (habits && checkin.habits_completed) {
          const doneHabits = habits.filter(h => checkin.habits_completed[h.id]);
          const notDone = habits.filter(h => !checkin.habits_completed[h.id]);
          if (doneHabits.length)
            parts.push('Habits completed today:\n' + doneHabits.map(h => `- ${h.name}`).join('\n'));
          if (notDone.length)
            parts.push('Habits not completed today:\n' + notDone.map(h => `- ${h.name}`).join('\n'));
        }
        if (checkin.reflection) {
          parts.push(`User's written reflection: "${checkin.reflection}"`);
        }
      }
    }

    if (context === 'weekly_review') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('date, habits_completed')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date');

      if (checkins?.length) {
        const { data: habits } = await supabase
          .from('habits')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (habits) {
          const summary = checkins.map(c => {
            const done = habits.filter(h => c.habits_completed?.[h.id]).length;
            return `${c.date}: ${done}/${habits.length} habits`;
          }).join('\n');
          parts.push('Last 7 days habit summary:\n' + summary);
        }
      }
    }

    return parts.join('\n\n');
  }, [user, context]);

  useEffect(() => {
    let cancelled = false;
    buildExtraContext().then(extra => {
      if (cancelled) return;
      setContextLoaded(true);
      // Send a gentle opening from the assistant
      const opener = getOpeningMessage(context);
      if (opener) {
        setMessages([{ role: 'assistant', content: opener }]);
      }
    });
    return () => { cancelled = true; };
  }, [buildExtraContext, context]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setInput('');
    setMessages(prev => [...prev, userMessage]);
    setStreaming(true);
    abortRef.current = false;

    try {
      const extra = await buildExtraContext();
      const systemPrompt = getSystemPrompt(context, extra);
      const allMessages = [...messages, userMessage];

      // Get the current session JWT to authenticate against the edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({
          systemPrompt,
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        // Do not surface raw server errors — they may contain internal details
        throw new Error(`Request failed (${response.status})`);
      }

      // Append empty assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (abortRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const chunk = parsed.delta.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + chunk };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (!abortRef.current) {
        Alert.alert('Error', 'Could not reach the AI service. Please check your connection and try again.');
        // Remove the empty assistant message if streaming failed before any content
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.content === '') {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          abortRef.current = true;
          navigation.goBack();
        }} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 60 }} />
      </View>

      {!contextLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.teal} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || streaming) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || streaming}
            >
              {streaming ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.sendIcon}>↑</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
          {message.content}
          {message.content === '' && (
            <Text style={styles.cursorDot}>●</Text>
          )}
        </Text>
      </View>
    </View>
  );
}

function getOpeningMessage(context: ChatContext): string {
  switch (context) {
    case 'evening_checkin':
      return "Good evening. How did today go? I'll ask you one question at a time — take your time with each one.";
    case 'struggling':
      return "I'm here. Take a breath. What's happening right now?";
    case 'principles':
      return "Let's explore what you genuinely believe. What's a recent decision or moment you felt really proud of?";
    case 'weekly_review':
      return "Let's look at your week honestly. I'll walk through what I see and ask a few questions. Ready?";
    case 'habits_help':
      return "Let's find the right habits for where you are right now. What feels most off-track in your life lately?";
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  bubbleWrapper: {
    marginBottom: 4,
  },
  bubbleLeft: {
    alignItems: 'flex-start',
  },
  bubbleRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: COLORS.teal,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: COLORS.white,
  },
  bubbleTextAssistant: {
    color: COLORS.text,
  },
  cursorDot: {
    fontSize: 10,
    opacity: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  sendIcon: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: '700',
  },
});
