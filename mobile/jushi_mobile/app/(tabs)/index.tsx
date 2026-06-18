import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthOverlay from '@/components/chat/AuthOverlay';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInputBox from '@/components/chat/ChatInputBox';
import ChatMessageList from '@/components/chat/ChatMessageList';
import HistorySessionModal from '@/components/chat/HistorySessionModal';
import ModelPickerModal from '@/components/chat/ModelPickerModal';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useChatScreenLogic } from '@/hooks/useChatScreenLogic';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ChatScreen() {
  const logic = useChatScreenLogic();
  const backgroundColor = useThemeColor({}, 'background');
  const tabBarHeight = useBottomTabBarHeight();
  const bottomOffset = logic.isKeyboardVisible
    ? Spacing.sm
    : Math.max(Spacing.lg, tabBarHeight - 25);

  if (logic.loading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>正在加载...</ThemedText>
      </View>
    );
  }

  if (!logic.isLoggedIn) {
    return (
      <AuthOverlay
        mode={logic.auth.mode}
        error={logic.error}
        baseUrlInput={logic.auth.baseUrlInput}
        identifier={logic.auth.identifier}
        email={logic.auth.email}
        displayName={logic.auth.displayName}
        password={logic.auth.password}
        connectionStatus={logic.auth.connectionStatus}
        testingConnection={logic.auth.testingConnection}
        manualApiBaseUrlEnabled={logic.auth.manualApiBaseUrlEnabled}
        onModeChange={logic.auth.setMode}
        onBaseUrlChange={(value) => {
          logic.auth.setBaseUrlInput(value);
        }}
        onIdentifierChange={logic.auth.setIdentifier}
        onEmailChange={logic.auth.setEmail}
        onDisplayNameChange={logic.auth.setDisplayName}
        onPasswordChange={logic.auth.setPassword}
        onSubmit={() => {
          void logic.auth.handleAuth();
        }}
        onTestConnection={() => {
          void logic.auth.handleTestConnection();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <HistorySessionModal {...logic.historyModal} />
      <ModelPickerModal {...logic.modelModal} />

      <ChatHeader {...logic.header} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <ChatMessageList {...logic.list} />

        {logic.error ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{logic.error}</ThemedText>
          </View>
        ) : null}

        <ChatInputBox
          {...logic.input}
          bottomOffset={bottomOffset}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    color: Colors.light.error,
    textAlign: 'center',
  },
});
