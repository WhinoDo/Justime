import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TaskDecompositionView, TaskDecomposition, TaskItem } from '@/components/chat/TaskDecompositionView';
import { ThinkingBubble } from '@/components/chat/ThinkingBubble';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

type SuggestedEvent = {
  title: string;
  description?: string;
  start: string;
  end: string;
  type?: string;
  priority?: string;
  location?: string;
  allDay?: boolean;
  conflicts?: Array<{
    _id?: string;
    title?: string;
    start?: string;
    end?: string;
  }>;
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Simple time format, could be improved with date-fns
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '');

export default function ChatScreen() {
  const { token, user, baseUrl, loading, signIn, signUp, signOut, setBaseUrl } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  const tabBarHeight = useBottomTabBarHeight();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardVisible(true);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [suggestedEvents, setSuggestedEvents] = useState<SuggestedEvent[]>([]);
  const [taskDecomposition, setTaskDecomposition] = useState<TaskDecomposition | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [processingTask, setProcessingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    setBaseUrlInput(baseUrl);
  }, [baseUrl]);

  const isLoggedIn = !!token;

  const headerTitle = useMemo(() => {
    if (!user) return '聚时智能助手';
    return `你好，${user.displayName || user.email?.split('@')[0]}`;
  }, [user]);

  const handleAuth = async () => {
    setError(null);
    try {
      await setBaseUrl(baseUrlInput);
      if (mode === 'login') {
        await signIn(identifier.trim(), password, baseUrlInput);
      } else {
        await signUp(email.trim(), password, displayName.trim(), baseUrlInput);
      }
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '认证失败');
    }
  };

  const handleTestConnection = async () => {
    const targetBaseUrl = normalizeUrl(baseUrlInput);
    if (!targetBaseUrl) {
      setConnectionStatus({ type: 'error', message: '请输入后端地址' });
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${targetBaseUrl}/api/v1/health/`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`服务不可用（${response.status}）`);
      }

      const result = await response.json();
      if (result?.status === 'healthy') {
        setConnectionStatus({ type: 'success', message: '连接成功' });
      } else {
        setConnectionStatus({ type: 'error', message: result?.message || '服务状态异常' });
      }
    } catch (e) {
      const message =
        e instanceof Error && e.name === 'AbortError'
          ? '连接超时'
          : e instanceof Error
            ? e.message
            : '连接失败';
      setConnectionStatus({ type: 'error', message });
    } finally {
      clearTimeout(timeout);
      setTestingConnection(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !token) return;
    const content = input.trim();

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setInput('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          sessionId,
          useWebSearch: useWebSearch
        }),
      });

      // ... existing 401 check ...
      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error?.message || '请求失败');
      }

      const data = result.data || {};
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response || '（无内容）',
        timestamp: new Date().toISOString(),
      };

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestedEvents(Array.isArray(data.suggestedEvents) ? data.suggestedEvents : []);

      // Handle Task Decomposition
      if (data.taskDecomposition) {
        setTaskDecomposition(data.taskDecomposition);
      } else {
        setTaskDecomposition(null); // Clear previous if any
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : '发送失败';
      setError(msg);
      if (msg.includes('登录已过期')) {
        signOut();
      }
    } finally {
      setSending(false);
    }
  };

  const handleAddEvent = async (event: SuggestedEvent) => {
    // ... existing implementation ...
    if (!token) return;
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: event.title,
          description: event.description || '',
          start: event.start,
          end: event.end,
          type: event.type || 'other',
          priority: event.priority || 'medium',
          location: event.location || '',
          allDay: event.allDay || false,
          aiGenerated: true,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || '添加日程失败');
      }

      setSuggestedEvents((prev) => prev.filter((item) => item !== event));
      // Could add a toast here
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加日程失败');
    }
  };

  const handleAddTask = async (task: TaskItem, index: number): Promise<boolean> => {
    if (!token || !taskDecomposition) return false;

    try {
      const startDate = taskDecomposition.start_date ? new Date(taskDecomposition.start_date) : new Date();
      const startHour = 9;

      // Simple logic: Schedule at 9am + index hours, moving to next day if needed
      // This is a simplified version of the batch logic for a single item
      // To be consistent with batch, we should calculate 'true' start time, but for single add
      // we can just place it relative to the start date based on its order (index)

      let targetDate = new Date(startDate);
      let offsetHours = index; // simplistic offset

      // Adjust for day boundaries (assuming 9 hour work day: 9-18)
      const workHoursPerDay = 9;
      const daysToAdd = Math.floor(offsetHours / workHoursPerDay);
      const hoursIntoDay = offsetHours % workHoursPerDay;

      targetDate.setDate(targetDate.getDate() + daysToAdd);
      targetDate.setHours(startHour + hoursIntoDay, 0, 0, 0);

      const durationHours = task.duration_hours || 1;
      const endTime = new Date(targetDate);
      endTime.setHours(targetDate.getHours() + durationHours, 0, 0, 0);

      const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description || `来自项目「${taskDecomposition.project_name}」`,
          start: targetDate.toISOString(),
          end: endTime.toISOString(),
          type: 'task',
          priority: 'medium',
          allDay: false,
          aiGenerated: true
        })
      });

      const result = await response.json();
      return result.success;

    } catch (e) {
      console.error("Failed to add individual task", e);
      return false;
    }
  };

  const handleConfirmDecomposition = async () => {
    if (!token || !taskDecomposition) return;
    setProcessingTask(true);
    setError(null);

    try {
      const startDate = taskDecomposition.start_date ? new Date(taskDecomposition.start_date) : new Date();
      let currentDate = new Date(startDate);
      let currentHour = 9; // Start at 9 AM

      let successCount = 0;

      for (const task of taskDecomposition.subtasks) {
        const durationHours = task.duration_hours || 1;

        // Move to next day if past 18:00
        if (currentHour + durationHours > 18) {
          currentDate.setDate(currentDate.getDate() + 1);
          currentHour = 9;
        }

        const startTime = new Date(currentDate);
        startTime.setHours(currentHour, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setHours(currentHour + durationHours, 0, 0, 0);

        // Call API to create event
        const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: task.title,
            description: task.description || `来自项目「${taskDecomposition.project_name}」`,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            type: 'task',
            priority: 'medium',
            allDay: false,
            aiGenerated: true
          })
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        }

        currentHour += durationHours;
      }

      // Add success message
      setMessages(prev => [...prev, {
        id: `${Date.now()}-system`,
        role: 'assistant',
        content: `✅ 已成功将 ${successCount} 个子任务添加到日历！`,
        timestamp: new Date().toISOString()
      }]);

      setTaskDecomposition(null);

    } catch (e) {
      setError('批量添加任务失败，请重试');
    } finally {
      setProcessingTask(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRight : styles.messageLeft]}>
        {!isUser && (
          <View style={styles.avatar}>
            <IconSymbol name="sparkles" size={16} color="#FFF" />
          </View>
        )}
        <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
          <View style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            !isUser ? { backgroundColor: Colors.light.surface } : {}
          ]}>
            <ThemedText style={isUser ? styles.messageTextUser : styles.messageTextAssistant}>
              {item.content}
            </ThemedText>
          </View>
          <ThemedText type="caption" style={[styles.messageTime, isUser ? { marginRight: 2 } : { marginLeft: 2 }]}>
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>正在加载...</ThemedText>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.authContainer}>
          <ThemedText type="title" style={{ textAlign: 'center', marginBottom: Spacing.sm }}>
            聚时
          </ThemedText>
          <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: Spacing.xl, color: Colors.light.textSecondary }}>
            你的智能时间管家
          </ThemedText>

          <Card variant="elevated">
            <Input
              label="后端地址"
              value={baseUrlInput}
              onChangeText={(value) => {
                setBaseUrlInput(value);
                setConnectionStatus(null);
              }}
              placeholder="http://127.0.0.1:8080"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.connectionRow}>
              <Button
                title="测试连接"
                variant="secondary"
                size="sm"
                onPress={handleTestConnection}
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

            {mode === 'login' ? (
              <>
                <Input
                  label="账号"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  placeholder="邮箱或用户名"
                />
              </>
            ) : (
              <>
                <Input
                  label="邮箱"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  placeholder="name@example.com"
                />
                <Input
                  label="显示名称"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="你的名字"
                />
              </>
            )}

            <Input
              label="密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="至少 6 位"
            />

            {error ? (
              <ThemedText style={{ color: Colors.light.error, marginBottom: Spacing.md }}>{error}</ThemedText>
            ) : null}

            <Button
              title={mode === 'login' ? '登录' : '注册'}
              onPress={handleAuth}
              disabled={!password}
              style={{ marginTop: Spacing.sm }}
            />

            <Button
              title={mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
              variant="ghost"
              onPress={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View>
          <ThemedText type="heading">{headerTitle}</ThemedText>
          <ThemedText type="caption" style={{ color: Colors.light.success }}>• 在线</ThemedText>
        </View>
        <Button
          title="退出"
          variant="ghost"
          size="sm"
          onPress={signOut}
          style={{ paddingHorizontal: 0 }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View>
              {taskDecomposition ? (
                <View style={styles.suggestionBox}>
                  <TaskDecompositionView
                    decomposition={taskDecomposition}
                    onConfirm={handleConfirmDecomposition}
                    onCancel={() => setTaskDecomposition(null)}
                    onAddTask={handleAddTask}
                    loading={processingTask}
                  />
                </View>
              ) : null}

              {suggestedEvents.length > 0 ? (
                <View style={styles.suggestionBox}>
                  <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm }}>AI 日程建议</ThemedText>
                  {suggestedEvents.map((event, index) => (
                    <Card key={`${event.title}-${index}`} variant="outlined" style={styles.eventCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="defaultSemiBold">{event.title}</ThemedText>
                          <ThemedText type="caption" style={{ color: Colors.light.textSecondary, marginTop: 2 }}>
                            {formatTime(event.start)} - {formatTime(event.end)}
                          </ThemedText>
                          {event.location && (
                            <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>📍 {event.location}</ThemedText>
                          )}
                        </View>
                        <Button
                          title="添加"
                          size="sm"
                          onPress={() => handleAddEvent(event)}
                        />
                      </View>
                      {event.conflicts?.length ? (
                        <ThemedText type="caption" style={{ color: Colors.light.error, marginTop: Spacing.xs }}>
                          ⚠️ 存在冲突日程
                        </ThemedText>
                      ) : null}
                    </Card>
                  ))}
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            sending ? <ThinkingBubble /> : null
          }
        />

        {error ? (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <ThemedText style={{ color: Colors.light.error, textAlign: 'center' }}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={[styles.inputBar, { marginBottom: isKeyboardVisible ? Spacing.lg : Math.max(Spacing.lg, tabBarHeight - 25) }]}>
          <Button
            variant="ghost"
            title=""
            icon={<IconSymbol name="globe" size={30} color={useWebSearch ? Colors.light.primary : Colors.light.textSecondary} />}
            onPress={() => setUseWebSearch(!useWebSearch)}
            style={{ width: 44, height: 44, paddingHorizontal: 0 }}
          />
          <Input
            value={input}
            onChangeText={setInput}
            placeholder={useWebSearch ? "深度思考模式..." : "告诉 AI 你的安排..."}
            style={styles.chatInput}
            containerStyle={{ flex: 1, marginBottom: 0 }}
            multiline
          />
          <Button
            title=""
            icon={
              <View style={{ marginLeft: 1, marginRight: 1, marginTop: 1 }}>
                <IconSymbol name="paperplane.fill" size={24} color="#d6cbcbff" />
              </View>
            }
            onPress={handleSend}
            disabled={!input.trim() || sending}
            loading={sending}
            style={styles.sendButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
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
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextAssistant: {
    color: Colors.light.text,
  },
  // ...
  messageTime: {
    marginTop: 2,
    opacity: 0.6,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  connectionStatus: {
    marginLeft: Spacing.sm,
  },
  suggestionBox: {
    marginBottom: Spacing.md,
  },
  eventCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceHighlight,
    borderWidth: 0,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: Spacing.lg,
    // marginBottom handled dynamically
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: Colors.light.surface,
    borderRadius: 32, // Capsule shape
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
