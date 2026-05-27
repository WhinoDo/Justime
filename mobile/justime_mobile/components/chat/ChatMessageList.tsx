import React, { useMemo, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { ThinkingBubble } from '@/components/chat/ThinkingBubble';
import { TaskDecompositionView } from '@/components/chat/TaskDecompositionView';
import { formatTime, getMessageDecompositions } from '@/hooks/useChatScreenLogic';
import type {
  ChatMessage,
  SuggestedEvent,
  TaskDecomposition,
  TaskItem,
  TaskSchedulePreview,
} from '@/types/chat';

interface ChatMessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  sendingPrompt: string;
  eventActionKey: string | null;
  activePlanIndexes: Record<string, number>;
  onDismissEvent: (event: SuggestedEvent, messageId: string) => void | Promise<void>;
  onAddEvent: (event: SuggestedEvent, messageId: string) => void | Promise<void>;
  onDismissDecomposition: (messageId: string) => void | Promise<void>;
  onAddTask: (
    task: TaskItem,
    index: number,
    decomposition: TaskDecomposition
  ) => Promise<{ success: boolean; start?: string; end?: string }>;
  onSetActivePlanIndex: (messageId: string, index: number) => void;
}

const buildEventKey = (event: SuggestedEvent) => `${event.title}-${event.start}-${event.end}`;

const calculateTaskSchedules = (decomposition: TaskDecomposition): TaskSchedulePreview[] => {
  const startDate = decomposition.start_date ? new Date(decomposition.start_date) : new Date();
  const cursor = new Date(startDate);
  cursor.setHours(9, 0, 0, 0);

  const schedules: TaskSchedulePreview[] = [];

  for (const task of decomposition.subtasks) {
    const durationHours = Math.max(task.duration_hours || 1, 0.5);
    const durationMs = durationHours * 60 * 60 * 1000;

    const dayEnd = new Date(cursor);
    dayEnd.setHours(18, 0, 0, 0);

    if (cursor.getTime() >= dayEnd.getTime() || cursor.getTime() + durationMs > dayEnd.getTime()) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
    }

    const startTime = new Date(cursor);
    const endTime = new Date(startTime.getTime() + durationMs);
    schedules.push({
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });
    cursor.setTime(endTime.getTime());
  }

  return schedules;
};

function ChatMessageItem({
  item,
  eventActionKey,
  activePlanIndexes,
  onDismissEvent,
  onAddEvent,
  onDismissDecomposition,
  onAddTask,
  onSetActivePlanIndex,
}: Omit<ChatMessageListProps, 'messages' | 'sending' | 'sendingPrompt'> & { item: ChatMessage }) {
  const isUser = item.role === 'user';
  const decompositions = useMemo(() => getMessageDecompositions(item), [item]);
  const hasTaskDecomposition = !isUser && decompositions.length > 0;
  const activePlanIndex = hasTaskDecomposition
    ? Math.min(activePlanIndexes[item.id] || 0, decompositions.length - 1)
    : 0;
  const currentDecomposition = hasTaskDecomposition ? decompositions[activePlanIndex] : null;
  const currentTaskSchedules = currentDecomposition ? calculateTaskSchedules(currentDecomposition) : [];

  return (
    <View style={styles.messageBlock}>
      <View style={[styles.messageRow, isUser ? styles.messageRight : styles.messageLeft]}>
        {!isUser ? (
          <View style={styles.avatar}>
            <IconSymbol name="sparkles" size={16} color="#FFF" />
          </View>
        ) : null}
        <View style={[styles.messageColumn, isUser ? styles.messageColumnRight : styles.messageColumnLeft]}>
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleAssistant,
              !isUser ? styles.assistantBubbleSurface : null,
            ]}
          >
            <ThemedText style={isUser ? styles.messageTextUser : styles.messageTextAssistant}>
              {item.content}
            </ThemedText>
          </View>
          <ThemedText type="caption" style={[styles.messageTime, isUser ? styles.messageTimeRight : styles.messageTimeLeft]}>
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>
      </View>

      {!isUser && item.suggestedEvents && item.suggestedEvents.length > 0 ? (
        <View style={styles.inlineSuggestionBox}>
          <ThemedText type="defaultSemiBold" style={styles.suggestionTitle}>
            AI 日程建议
          </ThemedText>
          {item.suggestedEvents.map((event, index) => {
            const actionKey = `${item.id}-${buildEventKey(event)}`;
            const isEventProcessing = eventActionKey === actionKey;
            return (
              <Card key={`${buildEventKey(event)}-${index}`} variant="outlined" style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventMain}>
                    <ThemedText type="defaultSemiBold">{event.title}</ThemedText>
                    <ThemedText type="caption" style={styles.eventMeta}>
                      {formatTime(event.start)} - {formatTime(event.end)}
                    </ThemedText>
                    {event.location ? (
                      <ThemedText type="caption" style={styles.eventMeta}>
                        📍 {event.location}
                      </ThemedText>
                    ) : null}
                    {event.conflicts?.length ? (
                      <ThemedText type="caption" style={styles.eventConflict}>
                        ⚠️ 存在冲突日程
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <View style={styles.eventActions}>
                  <Button
                    title="忽略"
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      void onDismissEvent(event, item.id);
                    }}
                    disabled={isEventProcessing}
                    style={styles.eventActionButton}
                  />
                  <Button
                    title="确认写入"
                    size="sm"
                    onPress={() => {
                      void onAddEvent(event, item.id);
                    }}
                    loading={isEventProcessing}
                    disabled={isEventProcessing}
                    style={styles.eventActionButton}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {!isUser && currentDecomposition ? (
        <View style={styles.inlineSuggestionBox}>
          {decompositions.length > 1 ? (
            <View style={styles.planSwitcher}>
              {decompositions.map((_, idx) => (
                <Button
                  key={`${item.id}-plan-${idx}`}
                  title={`方案 ${idx + 1}`}
                  size="sm"
                  variant={idx === activePlanIndex ? 'primary' : 'secondary'}
                  onPress={() => onSetActivePlanIndex(item.id, idx)}
                  style={styles.planSwitcherButton}
                />
              ))}
            </View>
          ) : null}

          <TaskDecompositionView
            decomposition={currentDecomposition}
            onCancel={() => {
              void onDismissDecomposition(item.id);
            }}
            onAddTask={(task, index) => onAddTask(task, index, currentDecomposition)}
            taskSchedules={currentTaskSchedules}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function ChatMessageList(props: ChatMessageListProps) {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  return (
    <FlatList
      ref={listRef}
      data={props.messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ChatMessageItem item={item} {...props} />}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.messageList}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      ListFooterComponent={props.sending ? <ThinkingBubble input={props.sendingPrompt} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
  },
  messageBlock: {
    marginBottom: Spacing.sm,
  },
  messageRow: {
    marginVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
    marginBottom: 4,
  },
  messageColumn: {
    maxWidth: '80%',
  },
  messageColumnLeft: {
    alignItems: 'flex-start',
  },
  messageColumnRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.light.primary,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  assistantBubbleSurface: {
    backgroundColor: Colors.light.surface,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextAssistant: {
    color: Colors.light.text,
  },
  messageTime: {
    marginTop: 2,
    opacity: 0.6,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  messageTimeLeft: {
    marginLeft: 2,
  },
  messageTimeRight: {
    marginRight: 2,
  },
  inlineSuggestionBox: {
    marginBottom: Spacing.md,
    marginLeft: 34,
  },
  suggestionTitle: {
    marginBottom: Spacing.sm,
  },
  eventCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceHighlight,
    borderWidth: 0,
    marginBottom: Spacing.sm,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventMain: {
    flex: 1,
  },
  eventMeta: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  eventConflict: {
    color: Colors.light.error,
    marginTop: Spacing.xs,
  },
  eventActions: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  eventActionButton: {
    minWidth: 96,
    marginLeft: Spacing.sm,
  },
  planSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  planSwitcherButton: {
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
