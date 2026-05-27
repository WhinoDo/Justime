import React from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import type { ChatModelOption } from '@/types/chat';

interface ModelPickerModalProps {
  visible: boolean;
  modelsLoading: boolean;
  modelError: string | null;
  availableModels: ChatModelOption[];
  selectedModelId: string | null;
  onClose: () => void;
  onSelectModel: (modelId: string) => void;
}

export default function ModelPickerModal({
  visible,
  modelsLoading,
  modelError,
  availableModels,
  selectedModelId,
  onClose,
  onSelectModel,
}: ModelPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modelPickerOverlay}>
        <TouchableOpacity activeOpacity={1} style={styles.modelPickerBackdrop} onPress={onClose} />
        <View style={styles.modelPickerContainer}>
          <View style={styles.modelPickerHeader}>
            <ThemedText type="defaultSemiBold">选择对话模型</ThemedText>
            <Button title="关闭" variant="ghost" size="sm" onPress={onClose} style={styles.closeButton} />
          </View>

          {modelsLoading ? (
            <View style={styles.modelPickerLoading}>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <ThemedText type="caption" style={styles.loadingText}>
                正在加载模型...
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={availableModels}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedModelId;
                return (
                  <TouchableOpacity
                    style={[styles.modelPickerItem, isSelected && styles.modelPickerItemActive]}
                    activeOpacity={0.85}
                    onPress={() => onSelectModel(item.id)}
                  >
                    <View style={styles.modelPickerItemMain}>
                      <ThemedText type="defaultSemiBold" style={styles.modelPickerItemText}>
                        {item.name}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.modelPickerItemMeta} numberOfLines={1}>
                        {item.capabilities && item.capabilities.length > 0
                          ? item.capabilities.join(' · ')
                          : item.id}
                      </ThemedText>
                    </View>
                    {isSelected ? (
                      <IconSymbol name="checkmark.circle.fill" size={18} color={Colors.light.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modelPickerEmpty}>
                  <ThemedText type="caption" style={styles.emptyText}>
                    {modelError || '暂无可用模型'}
                  </ThemedText>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modelPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modelPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modelPickerContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '60%',
  },
  modelPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  closeButton: {
    paddingHorizontal: 0,
  },
  modelPickerLoading: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.xs,
    color: Colors.light.textSecondary,
  },
  modelPickerItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelPickerItemActive: {
    backgroundColor: Colors.light.primary + '10',
  },
  modelPickerItemMain: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  modelPickerItemText: {
    fontSize: 16,
  },
  modelPickerItemMeta: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modelPickerEmpty: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.light.textSecondary,
  },
});
