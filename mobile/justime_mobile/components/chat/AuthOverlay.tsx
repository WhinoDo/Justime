import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors, Spacing } from '@/constants/theme';
import { getApiBaseUrl } from '@/constants/app-config';
import { useThemeColor } from '@/hooks/use-theme-color';

type AuthMode = 'login' | 'register';

interface AuthOverlayProps {
  mode: AuthMode;
  error: string | null;
  baseUrlInput: string;
  identifier: string;
  email: string;
  displayName: string;
  password: string;
  connectionStatus: { type: 'success' | 'error'; message: string } | null;
  testingConnection: boolean;
  manualApiBaseUrlEnabled: boolean;
  onModeChange: (mode: AuthMode) => void;
  onBaseUrlChange: (value: string) => void;
  onIdentifierChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onTestConnection: () => void;
}

export default function AuthOverlay({
  mode,
  error,
  baseUrlInput,
  identifier,
  email,
  displayName,
  password,
  connectionStatus,
  testingConnection,
  manualApiBaseUrlEnabled,
  onModeChange,
  onBaseUrlChange,
  onIdentifierChange,
  onEmailChange,
  onDisplayNameChange,
  onPasswordChange,
  onSubmit,
  onTestConnection,
}: AuthOverlayProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.authContainer}>
        <ThemedText type="title" style={styles.title}>
          Justime
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          你的智能时间管家
        </ThemedText>

        <Card variant="elevated">
          <View style={styles.modeTabs}>
            <Button
              title="登录"
              size="sm"
              variant={mode === 'login' ? 'primary' : 'secondary'}
              onPress={() => onModeChange('login')}
              style={styles.modeTab}
            />
            <Button
              title="注册"
              size="sm"
              variant={mode === 'register' ? 'primary' : 'secondary'}
              onPress={() => onModeChange('register')}
              style={styles.modeTab}
            />
          </View>

          {manualApiBaseUrlEnabled ? (
            <>
              <Input
                label="后端地址"
                value={baseUrlInput}
                onChangeText={onBaseUrlChange}
                placeholder={getApiBaseUrl()}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.connectionRow}>
                <Button
                  title="测试连接"
                  variant="secondary"
                  size="sm"
                  onPress={onTestConnection}
                  loading={testingConnection}
                  disabled={!baseUrlInput.trim()}
                />
                {connectionStatus ? (
                  <ThemedText
                    type="caption"
                    style={[
                      styles.connectionStatus,
                      { color: connectionStatus.type === 'success' ? successColor : errorColor },
                    ]}
                  >
                    {connectionStatus.message}
                  </ThemedText>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.connectionLockedRow}>
              <ThemedText type="caption" style={styles.secondaryText}>
                后端地址已从配置读取
              </ThemedText>
            </View>
          )}

          {mode === 'login' ? (
            <Input
              label="账号"
              value={identifier}
              onChangeText={onIdentifierChange}
              autoCapitalize="none"
              placeholder="邮箱或用户名"
            />
          ) : (
            <>
              <Input
                label="邮箱"
                value={email}
                onChangeText={onEmailChange}
                autoCapitalize="none"
                placeholder="name@example.com"
              />
              <Input
                label="显示名称"
                value={displayName}
                onChangeText={onDisplayNameChange}
                placeholder="你的名字"
              />
            </>
          )}

          <Input
            label="密码"
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            placeholder="至少 6 位"
          />

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <Button
            title={mode === 'login' ? '登录' : '注册'}
            onPress={onSubmit}
            disabled={!password}
            style={styles.submitButton}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
    color: Colors.light.textSecondary,
  },
  modeTabs: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  modeTab: {
    flex: 1,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  connectionStatus: {
    marginLeft: Spacing.sm,
  },
  connectionLockedRow: {
    marginBottom: Spacing.md,
  },
  secondaryText: {
    color: Colors.light.textSecondary,
  },
  errorText: {
    color: Colors.light.error,
    marginBottom: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
});
