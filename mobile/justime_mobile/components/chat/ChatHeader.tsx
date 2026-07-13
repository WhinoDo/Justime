import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';

interface ChatHeaderProps {
  title: string;
  selectedModelLabel: string;
  modelsLoading: boolean;
  modelError: string | null;
  onOpenHistory: () => void;
  onOpenModelPicker: () => void;
  onSignOut: () => void | Promise<void>;
}

export default function ChatHeader({
  title,
  selectedModelLabel,
  modelsLoading,
  modelError,
  onOpenHistory,
  onOpenModelPicker,
  onSignOut,
}: ChatHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity style={styles.historyEntryButton} onPress={onOpenHistory} activeOpacity={0.8}>
          <IconSymbol name="list.bullet" size={20} color={Colors.light.primary} />
        </TouchableOpacity>
        <View>
          <ThemedText type="heading">{title}</ThemedText>
          <TouchableOpacity style={styles.modelSelectBadge} activeOpacity={0.85} onPress={onOpenModelPicker}>
            <ThemedText type="caption" style={styles.modelSelectBadgeText} numberOfLines={1}>
              {selectedModelLabel}
            </ThemedText>
            {modelsLoading ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <IconSymbol
                name="chevron.down"
                size={12}
                color={modelError ? Colors.light.error : Colors.light.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Button title="退出" variant="ghost" size="sm" onPress={onSignOut} style={styles.signOutButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyEntryButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modelSelectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: Colors.light.primary + '1A',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modelSelectBadgeText: {
    color: Colors.light.primary,
    maxWidth: 180,
    marginRight: 4,
  },
  signOutButton: {
    paddingHorizontal: 0,
  },
});
