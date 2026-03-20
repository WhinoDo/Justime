import React from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { formatHistoryTime } from '@/hooks/useChatScreenLogic';
import type { ChatSessionSummary } from '@/types/chat';

interface HistorySessionModalProps {
  visible: boolean;
  sessions: ChatSessionSummary[];
  sessionId: string | null;
  sessionsLoading: boolean;
  creatingSession: boolean;
  loadingSessionId: string | null;
  onClose: () => void;
  onCreateSession: () => void;
  onSelectSession: (session: ChatSessionSummary) => void;
}

export default function HistorySessionModal({
  visible,
  sessions,
  sessionId,
  sessionsLoading,
  creatingSession,
  loadingSessionId,
  onClose,
  onCreateSession,
  onSelectSession,
}: HistorySessionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.historyOverlay}>
        <View style={styles.historyDrawer}>
          <View style={styles.historyHeader}>
            <ThemedText type="defaultSemiBold">对话记录</ThemedText>
            <Button title="关闭" variant="ghost" size="sm" onPress={onClose} style={styles.closeButton} />
          </View>

          <Button
            title="新建对话"
            variant="secondary"
            size="sm"
            onPress={onCreateSession}
            loading={creatingSession}
            style={styles.createButton}
            icon={<IconSymbol name="plus" size={14} color={Colors.light.primary} />}
          />

          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
            renderItem={({ item }) => {
              const active = item.id === sessionId;
              const isLoadingItem = loadingSessionId === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onSelectSession(item)}
                  disabled={isLoadingItem}
                  style={[styles.historyItem, active && styles.historyItemActive]}
                >
                  <View style={styles.historyItemMain}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                      {item.title || '未命名对话'}
                    </ThemedText>
                    {item.preview ? (
                      <ThemedText type="caption" style={styles.historyPreview} numberOfLines={2}>
                        {item.preview}
                      </ThemedText>
                    ) : null}
                    {item.updatedAt ? (
                      <ThemedText type="caption" style={styles.historyTime}>
                        {formatHistoryTime(item.updatedAt)}
                      </ThemedText>
                    ) : null}
                  </View>
                  {isLoadingItem ? <ActivityIndicator size="small" color={Colors.light.primary} /> : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              sessionsLoading ? (
                <View style={styles.historyEmpty}>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                  <ThemedText type="caption" style={styles.emptyText}>
                    正在加载会话...
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.historyEmpty}>
                  <ThemedText type="caption" style={styles.emptyText}>
                    暂无历史对话
                  </ThemedText>
                </View>
              )
            }
          />
        </View>
        <TouchableOpacity style={styles.historyBackdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  historyOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  historyDrawer: {
    width: '78%',
    maxWidth: 340,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
  },
  historyBackdrop: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  closeButton: {
    paddingHorizontal: 0,
  },
  createButton: {
    marginBottom: Spacing.sm,
  },
  content: {
    paddingBottom: Spacing.md,
  },
  historyItem: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyItemActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '12',
  },
  historyItemMain: {
    flex: 1,
  },
  historyPreview: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  historyTime: {
    color: Colors.light.textSecondary,
    marginTop: 4,
    fontSize: 10,
  },
  historyEmpty: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: Spacing.xs,
    color: Colors.light.textSecondary,
  },
});
