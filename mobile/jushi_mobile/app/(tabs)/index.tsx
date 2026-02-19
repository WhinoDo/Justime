import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TaskDecompositionView, TaskDecomposition, TaskItem, AddTaskResult, TaskSchedulePreview } from '@/components/chat/TaskDecompositionView';
import { ThinkingBubble } from '@/components/chat/ThinkingBubble';
import { isManualApiBaseUrlEnabled } from '@/constants/app-config';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedEvents?: SuggestedEvent[];
  taskDecomposition?: TaskDecomposition | null;
  multiTaskDecompositions?: TaskDecomposition[] | null;
};

type ChatSessionSummary = {
  id: string;
  title: string;
  preview?: string;
  updatedAt?: string;
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
  resources?: {
    title?: string;
    url?: string;
    type?: string;
  }[];
  conflicts?: {
    _id?: string;
    title?: string;
    start?: string;
    end?: string;
  }[];
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Simple time format, could be improved with date-fns
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatHistoryTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '');

const toLegacyDecomposition = (decomposition: TaskDecomposition): TaskDecomposition => ({
  ...decomposition,
  project_name: decomposition.project_name || decomposition.project?.name || '任务规划',
  start_date: decomposition.start_date || decomposition.project?.start_date,
  total_days: decomposition.total_days || decomposition.project?.total_days,
  subtasks: Array.isArray(decomposition.subtasks) ? decomposition.subtasks : [],
});

const getMessageDecompositions = (message: ChatMessage): TaskDecomposition[] => {
  if (Array.isArray(message.multiTaskDecompositions) && message.multiTaskDecompositions.length > 0) {
    return message.multiTaskDecompositions.map(toLegacyDecomposition);
  }

  if (message.taskDecomposition) {
    return [toLegacyDecomposition(message.taskDecomposition)];
  }

  return [];
};

const buildEventKey = (event: SuggestedEvent) => `${event.title}-${event.start}-${event.end}`;
const normalizeResources = (
  resources?: { title?: string; url?: string; type?: string }[]
) => (resources || [])
  .filter((resource) => Boolean(resource?.url))
  .map((resource) => ({
    title: resource?.title?.trim() || '相关链接',
    url: (resource?.url || '').trim(),
    type: resource?.type,
  }));

const toChatMessage = (raw: any): ChatMessage => {
  const rawRole = String(raw?.role || '').toLowerCase();
  const role: 'user' | 'assistant' = rawRole === 'user' ? 'user' : 'assistant';
  const timestampValue = raw?.timestamp ? String(raw.timestamp) : new Date().toISOString();
  const date = new Date(timestampValue);

  return {
    id: String(raw?._id || raw?.id || `${Date.now()}-${Math.random()}`),
    role,
    content: String(raw?.content || ''),
    timestamp: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    suggestedEvents: Array.isArray(raw?.suggestedEvents) ? raw.suggestedEvents : undefined,
    taskDecomposition: raw?.taskDecomposition || null,
    multiTaskDecompositions: Array.isArray(raw?.multiTaskDecompositions) ? raw.multiTaskDecompositions : null,
  };
};

export default function ChatScreen() {
  const { token, user, baseUrl, loading, signIn, signUp, signOut, setBaseUrl } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');
  const manualApiBaseUrlEnabled = isManualApiBaseUrlEnabled();

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
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [eventActionKey, setEventActionKey] = useState<string | null>(null);
  const [activePlanIndexes, setActivePlanIndexes] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
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
      const resolvedBaseUrl = manualApiBaseUrlEnabled ? baseUrlInput : baseUrl;
      await setBaseUrl(resolvedBaseUrl);
      if (mode === 'login') {
        await signIn(identifier.trim(), password, resolvedBaseUrl);
      } else {
        await signUp(email.trim(), password, displayName.trim(), resolvedBaseUrl);
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

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || '获取会话列表失败');
      }

      const rawSessions = Array.isArray(result?.sessions) ? result.sessions : [];
      const mapped = rawSessions.map((item: any) => ({
        id: String(item?._id || item?.id || ''),
        title: String(item?.title || item?.preview || '未命名对话'),
        preview: item?.preview ? String(item.preview) : undefined,
        updatedAt: item?.updatedAt ? String(item.updatedAt) : undefined,
      })).filter((item: ChatSessionSummary) => !!item.id);
      setSessions(mapped);
    } catch (e) {
      console.error('加载会话列表失败:', e);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('登录已过期')) {
        signOut();
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [baseUrl, signOut, token]);

  const handleOpenHistory = () => {
    setHistoryVisible(true);
    void loadSessions();
  };

  const handleCreateSession = async () => {
    if (!token) return;
    setCreatingSession(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/v1/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: '新会话' }),
      });
      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }
      const result = await response.json();
      if (!response.ok || !result?.sessionId) {
        throw new Error(result?.detail || result?.message || '创建会话失败');
      }

      setSessionId(String(result.sessionId));
      setMessages([]);
      setActivePlanIndexes({});
      setHistoryVisible(false);
      void loadSessions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '创建会话失败';
      setError(msg);
      if (msg.includes('登录已过期')) {
        signOut();
      }
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSelectSession = async (targetSession: ChatSessionSummary) => {
    if (!token) return;
    setLoadingSessionId(targetSession.id);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/v1/chat/sessions/${targetSession.id}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || '加载会话消息失败');
      }

      const rawMessages = Array.isArray(result?.messages) ? result.messages : [];
      const mappedMessages = rawMessages.map((item: any) => toChatMessage(item));
      setMessages(mappedMessages);
      setSessionId(targetSession.id);
      setActivePlanIndexes({});
      setHistoryVisible(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载会话消息失败';
      setError(msg);
      if (msg.includes('登录已过期')) {
        signOut();
      }
    } finally {
      setLoadingSessionId(null);
    }
  };

  useEffect(() => {
    if (!token) {
      setSessions([]);
      setSessionId(null);
      setMessages([]);
      return;
    }
    void loadSessions();
  }, [loadSessions, token]);

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
        id: data.messageId || `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response || '（无内容）',
        timestamp: new Date().toISOString(),
        suggestedEvents: Array.isArray(data.suggestedEvents) ? data.suggestedEvents : undefined,
        taskDecomposition: data.taskDecomposition || null,
        multiTaskDecompositions: Array.isArray(data.multiTaskDecompositions) ? data.multiTaskDecompositions : null,
      };

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) => [...prev, assistantMessage]);
      void loadSessions();
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

  const persistMessageInteractiveState = async (
    messageId: string,
    updates: {
      suggestedEvents?: SuggestedEvent[] | null;
      taskDecomposition?: TaskDecomposition | null;
      multiTaskDecompositions?: TaskDecomposition[] | null;
    }
  ) => {
    if (!token || !messageId || messageId.includes('-assistant') || messageId.includes('-system')) {
      return;
    }

    await fetch(`${baseUrl}/api/v1/chat/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
  };

  const removeEventFromMessage = (messageId: string, event: SuggestedEvent) => {
    let remainingEvents: SuggestedEvent[] = [];
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        remainingEvents = (msg.suggestedEvents || []).filter((item) => buildEventKey(item) !== buildEventKey(event));
        return {
          ...msg,
          suggestedEvents: remainingEvents.length > 0 ? remainingEvents : undefined,
        };
      })
    );
    return remainingEvents;
  };

  const handleAddEvent = async (event: SuggestedEvent, messageId: string) => {
    if (!token) return;
    setError(null);
    const actionKey = `${messageId}-${buildEventKey(event)}`;
    setEventActionKey(actionKey);

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
          resources: normalizeResources(event.resources),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || '添加日程失败');
      }

      const remainingEvents = removeEventFromMessage(messageId, event);
      try {
        await persistMessageInteractiveState(messageId, {
          suggestedEvents: remainingEvents.length > 0 ? remainingEvents : null,
        });
      } catch (persistError) {
        console.error('同步日程建议状态失败:', persistError);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加日程失败');
    } finally {
      setEventActionKey(null);
    }
  };

  const handleDismissEvent = async (event: SuggestedEvent, messageId: string) => {
    const remainingEvents = removeEventFromMessage(messageId, event);
    try {
      await persistMessageInteractiveState(messageId, {
        suggestedEvents: remainingEvents.length > 0 ? remainingEvents : null,
      });
    } catch (persistError) {
      console.error('同步日程建议状态失败:', persistError);
    }
  };

  const calculateTaskSchedules = (decomposition: TaskDecomposition): { startTime: Date; endTime: Date }[] => {
    const startDate = decomposition.start_date ? new Date(decomposition.start_date) : new Date();
    const cursor = new Date(startDate);
    cursor.setHours(9, 0, 0, 0);

    const schedules: { startTime: Date; endTime: Date }[] = [];

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
      schedules.push({ startTime, endTime });
      cursor.setTime(endTime.getTime());
    }

    return schedules;
  };

  const getTaskSchedulePreview = (
    decomposition: TaskDecomposition,
    index: number
  ): TaskSchedulePreview | null => {
    const schedules = calculateTaskSchedules(decomposition);
    const target = schedules[index];
    if (!target) return null;
    return {
      start: target.startTime.toISOString(),
      end: target.endTime.toISOString(),
    };
  };

  const handleAddTask = async (
    task: TaskItem,
    index: number,
    decomposition: TaskDecomposition
  ): Promise<AddTaskResult> => {
    if (!token) return { success: false };

    try {
      const schedule = getTaskSchedulePreview(decomposition, index);
      if (!schedule) {
        return { success: false };
      }

      const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description || `来自项目「${decomposition.project_name || '任务规划'}」`,
          start: schedule.start,
          end: schedule.end,
          type: 'task',
          priority: 'medium',
          allDay: false,
          aiGenerated: true,
          resources: normalizeResources(task.resources),
        })
      });

      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          start: schedule.start,
          end: schedule.end,
        };
      }

      return { success: false };

    } catch (e) {
      console.error("Failed to add individual task", e);
      return { success: false };
    }
  };

  const handleDismissDecomposition = async (messageId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, taskDecomposition: undefined, multiTaskDecompositions: undefined }
          : msg
      )
    );

    setActivePlanIndexes((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });

    try {
      await persistMessageInteractiveState(messageId, {
        taskDecomposition: null,
        multiTaskDecompositions: null,
      });
    } catch (persistError) {
      console.error('同步任务分解状态失败:', persistError);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const decompositions = getMessageDecompositions(item);
    const hasTaskDecomposition = !isUser && decompositions.length > 0;
    const activePlanIndex = hasTaskDecomposition
      ? Math.min(activePlanIndexes[item.id] || 0, decompositions.length - 1)
      : 0;
    const currentDecomposition = hasTaskDecomposition ? decompositions[activePlanIndex] : null;
    const currentTaskSchedules: TaskSchedulePreview[] = currentDecomposition
      ? calculateTaskSchedules(currentDecomposition).map((schedule) => ({
          start: schedule.startTime.toISOString(),
          end: schedule.endTime.toISOString(),
        }))
      : [];

    return (
      <View style={styles.messageBlock}>
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

        {!isUser && item.suggestedEvents && item.suggestedEvents.length > 0 ? (
          <View style={styles.inlineSuggestionBox}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm }}>
              AI 日程建议
            </ThemedText>
            {item.suggestedEvents.map((event, index) => {
              const actionKey = `${item.id}-${buildEventKey(event)}`;
              const isEventProcessing = eventActionKey === actionKey;
              return (
                <Card key={`${buildEventKey(event)}-${index}`} variant="outlined" style={styles.eventCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold">{event.title}</ThemedText>
                      <ThemedText type="caption" style={{ color: Colors.light.textSecondary, marginTop: 2 }}>
                        {formatTime(event.start)} - {formatTime(event.end)}
                      </ThemedText>
                      {event.location ? (
                        <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                          📍 {event.location}
                        </ThemedText>
                      ) : null}
                      {event.conflicts?.length ? (
                        <ThemedText type="caption" style={{ color: Colors.light.error, marginTop: Spacing.xs }}>
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
                        void handleDismissEvent(event, item.id);
                      }}
                      disabled={isEventProcessing}
                      style={styles.eventActionButton}
                    />
                    <Button
                      title="确认写入"
                      size="sm"
                      onPress={() => {
                        void handleAddEvent(event, item.id);
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
                    onPress={() =>
                      setActivePlanIndexes((prev) => ({
                        ...prev,
                        [item.id]: idx,
                      }))
                    }
                    style={styles.planSwitcherButton}
                  />
                ))}
              </View>
            ) : null}

            <TaskDecompositionView
              decomposition={currentDecomposition}
              onCancel={() => {
                void handleDismissDecomposition(item.id);
              }}
              onAddTask={(task, index) => handleAddTask(task, index, currentDecomposition)}
              taskSchedules={currentTaskSchedules}
            />
          </View>
        ) : null}
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
            {manualApiBaseUrlEnabled ? (
              <>
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
              </>
            ) : (
              <View style={styles.connectionLockedRow}>
                <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                  后端地址已从配置读取
                </ThemedText>
              </View>
            )}

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
      <Modal
        visible={historyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.historyOverlay}>
          <View style={styles.historyDrawer}>
            <View style={styles.historyHeader}>
              <ThemedText type="defaultSemiBold">对话记录</ThemedText>
              <Button
                title="关闭"
                variant="ghost"
                size="sm"
                onPress={() => setHistoryVisible(false)}
                style={{ paddingHorizontal: 0 }}
              />
            </View>

            <Button
              title="新建对话"
              variant="secondary"
              size="sm"
              onPress={() => {
                void handleCreateSession();
              }}
              loading={creatingSession}
              style={{ marginBottom: Spacing.sm }}
              icon={<IconSymbol name="plus" size={14} color={Colors.light.primary} />}
            />

            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: Spacing.md }}
              renderItem={({ item }) => {
                const active = item.id === sessionId;
                const isLoadingItem = loadingSessionId === item.id;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      void handleSelectSession(item);
                    }}
                    disabled={isLoadingItem}
                    style={[styles.historyItem, active && styles.historyItemActive]}
                  >
                    <View style={{ flex: 1 }}>
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
                    {isLoadingItem ? (
                      <ActivityIndicator size="small" color={Colors.light.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                sessionsLoading ? (
                  <View style={styles.historyEmpty}>
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                    <ThemedText type="caption" style={{ marginTop: Spacing.xs, color: Colors.light.textSecondary }}>
                      正在加载会话...
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.historyEmpty}>
                    <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                      暂无历史对话
                    </ThemedText>
                  </View>
                )
              }
            />
          </View>
          <TouchableOpacity style={styles.historyBackdrop} onPress={() => setHistoryVisible(false)} />
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.historyEntryButton} onPress={handleOpenHistory} activeOpacity={0.8}>
            <IconSymbol name="list.bullet" size={20} color={Colors.light.primary} />
          </TouchableOpacity>
          <View>
            <ThemedText type="heading">{headerTitle}</ThemedText>
            <ThemedText type="caption" style={{ color: Colors.light.success }}>• 在线</ThemedText>
          </View>
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
            size="sm"
            title=""
            icon={<IconSymbol name="globe" size={22} color={useWebSearch ? Colors.light.primary : Colors.light.textSecondary} />}
            onPress={() => setUseWebSearch(!useWebSearch)}
            style={{ width: 44, height: 44, paddingHorizontal: 0, paddingVertical: 0 }}
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
            size="sm"
            title=""
            icon={<IconSymbol name="paperplane.fill" size={18} color="#d6cbcbff" />}
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
  connectionLockedRow: {
    marginBottom: Spacing.md,
  },
  inlineSuggestionBox: {
    marginBottom: Spacing.md,
    marginLeft: 34,
  },
  eventCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceHighlight,
    borderWidth: 0,
    marginBottom: Spacing.sm,
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
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
