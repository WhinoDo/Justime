import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';

interface ChatInputBoxProps {
  sending: boolean;
  useWebSearch: boolean;
  bottomOffset: number;
  onToggleWebSearch: () => void;
  onSend: (content: string) => Promise<boolean> | boolean;
}

export default function ChatInputBox({
  sending,
  useWebSearch,
  bottomOffset,
  onToggleWebSearch,
  onSend,
}: ChatInputBoxProps) {
  const [input, setInput] = useState('');

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    const ok = await onSend(content);
    if (!ok) {
      setInput(content);
    }
  };

  return (
    <View style={[styles.inputBar, { marginBottom: bottomOffset }]}>
      <Button
        variant="ghost"
        size="sm"
        title=""
        icon={
          <IconSymbol
            name="globe"
            size={22}
            color={useWebSearch ? Colors.light.primary : Colors.light.textSecondary}
          />
        }
        onPress={onToggleWebSearch}
        style={styles.toggleButton}
      />
      <Input
        value={input}
        onChangeText={setInput}
        placeholder={useWebSearch ? '深度思考模式...' : '告诉 AI 你的安排...'}
        style={styles.chatInput}
        containerStyle={styles.inputContainer}
        multiline
      />
      <Button
        size="sm"
        title=""
        icon={<IconSymbol name="paperplane.fill" size={18} color="#d6cbcbff" />}
        onPress={() => {
          void handleSend();
        }}
        disabled={!input.trim() || sending}
        loading={sending}
        style={styles.sendButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: Spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: Colors.light.surface,
    borderRadius: 32,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  toggleButton: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  inputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
