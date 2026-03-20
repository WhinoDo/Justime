import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, LayoutAnimation, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { isManualApiBaseUrlEnabled } from '@/constants/app-config';
import type {
  AddTaskResult,
  ChatMessage,
  ChatModelOption,
  ChatSessionSummary,
  SuggestedEvent,
  TaskDecomposition,
  TaskItem,
  TaskSchedulePreview,
} from '@/types/chat';

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '');

const normalizeResources = (
  resources?: { title?: string; url?: string; type?: string }[]
) =>
  (resources || [])
    .filter((resource) => Boolean(resource?.url))
    .map((resource) => ({
      title: resource?.title?.trim() || '相关链接',
      url: (resource?.url || '').trim(),
      type: resource?.type,
    }));

const normalizeModelCapabilities = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const labels: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const value = item.trim().toLowerCase();
    if (!value || labels.includes(value)) continue;
    labels.push(value);
  }
  return labels;
};

const normalizeModelOptions = (rawItems: any[]): ChatModelOption[] => {
  const models: ChatModelOption[] = [];
  const seenIds = new Set<string>();

  for (const raw of rawItems) {
    if (!raw || raw.enabled === false) continue;
    const modelId = String(raw.modelId || raw.model_id || raw.id || '').trim();
    if (!modelId || seenIds.has(modelId)) continue;
    seenIds.add(modelId);

    const modelName = String(raw.name || raw.modelName || modelId).trim();
    models.push({
      id: modelId,
      name: modelName || modelId,
      capabilities: normalizeModelCapabilities(raw.capabilities),
      isDefault: Boolean(raw.is_default || raw.isDefault || raw.isActive),
    });
  }

  return models;
};

const toLegacyDecomposition = (decomposition: TaskDecomposition): TaskDecomposition => ({
  ...decomposition,
  project_name: decomposition.project_name || decomposition.project?.name || '任务规划',
  start_date: decomposition.start_date || decomposition.project?.start_date,
  total_days: decomposition.total_days || decomposition.project?.total_days,
  subtasks: Array.isArray(decomposition.subtasks) ? decomposition.subtasks : [],
});

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
    multiTaskDecompositions: Array.isArray(raw?.multiTaskDecompositions)
      ? raw.multiTaskDecompositions
      : null,
  };
};

const buildEventKey = (event: SuggestedEvent) => `${event.title}-${event.start}-${event.end}`;

export const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
};

export const formatHistoryTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

export const getMessageDecompositions = (message: ChatMessage): TaskDecomposition[] => {
  if (Array.isArray(message.multiTaskDecompositions) && message.multiTaskDecompositions.length > 0) {
    return message.multiTaskDecompositions.map(toLegacyDecomposition);
  }

  if (message.taskDecomposition) {
    return [toLegacyDecomposition(message.taskDecomposition)];
  }

  return [];
};

export function useChatScreenLogic() {
  const { token, user, baseUrl, loading, signIn, signUp, signOut, setBaseUrl } = useAuth();
  const manualApiBaseUrlEnabled = isManualApiBaseUrlEnabled();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingPrompt, setSendingPrompt] = useState('');
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
  const [availableModels, setAvailableModels] = useState<ChatModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isModelPickerVisible, setModelPickerVisible] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    activeSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates?.height || 0);
    };

    const handleKeyboardHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      handleKeyboardShow
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      handleKeyboardHide
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    setBaseUrlInput(baseUrl);
  }, [baseUrl]);

  const isLoggedIn = !!token;

  const headerTitle = useMemo(() => {
    if (!user) return '聚时智能助手';
    return `你好，${user.displayName || user.email?.split('@')[0]}`;
  }, [user]);

  const selectedModel = useMemo(
    () => availableModels.find((model) => model.id === selectedModelId) || null,
    [availableModels, selectedModelId]
  );

  const selectedModelLabel = useMemo(() => {
    if (selectedModel) return selectedModel.name;
    if (modelsLoading) return '加载模型中...';
    if (modelError) return '模型加载失败';
    if (availableModels.length === 0) return '暂无可用模型';
    return '选择模型';
  }, [availableModels.length, modelError, modelsLoading, selectedModel]);

  const changeAuthMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
  };

  const updateBaseUrlInput = (value: string) => {
    setBaseUrlInput(value);
    setConnectionStatus(null);
  };

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
      const mapped = rawSessions
        .map((item: any) => ({
          id: String(item?._id || item?.id || ''),
          title: String(item?.title || item?.preview || '未命名对话'),
          preview: item?.preview ? String(item.preview) : undefined,
          updatedAt: item?.updatedAt ? String(item.updatedAt) : undefined,
        }))
        .filter((item: ChatSessionSummary) => !!item.id);
      setSessions(mapped);
    } catch (e) {
      console.error('加载会话列表失败:', e);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('登录已过期')) {
        void signOut();
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [baseUrl, signOut, token]);

  const loadModels = useCallback(async () => {
    if (!token) return;
    setModelsLoading(true);
    setModelError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/llm-configs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }

      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.detail || result?.message || '加载模型配置失败');
      }

      const rawConfigs = Array.isArray(result?.data?.configs) ? result.data.configs : [];
      const fetchedModels = normalizeModelOptions(rawConfigs);

      setAvailableModels(fetchedModels);
      setSelectedModelId((prev) => {
        if (prev && fetchedModels.some((item) => item.id === prev)) {
          return prev;
        }
        const defaultModel = fetchedModels.find((item) => item.isDefault);
        return defaultModel?.id || fetchedModels[0]?.id || null;
      });
    } catch (e) {
      console.error('加载模型列表失败:', e);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('登录已过期')) {
        void signOut();
      }
      setAvailableModels([]);
      setSelectedModelId(null);
      setModelError(msg || '加载模型配置失败');
    } finally {
      setModelsLoading(false);
    }
  }, [baseUrl, signOut, token]);

  const openHistory = () => {
    setHistoryVisible(true);
    void loadSessions();
  };

  const closeHistory = () => setHistoryVisible(false);
  const openModelPicker = () => setModelPickerVisible(true);
  const closeModelPicker = () => setModelPickerVisible(false);
  const toggleWebSearch = () => setUseWebSearch((prev) => !prev);
  const selectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setModelPickerVisible(false);
  };

  const createSession = async () => {
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
        void signOut();
      }
    } finally {
      setCreatingSession(false);
    }
  };

  const selectSession = async (targetSession: ChatSessionSummary) => {
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
      setMessages(rawMessages.map((item: any) => toChatMessage(item)));
      setSessionId(targetSession.id);
      setActivePlanIndexes({});
      setHistoryVisible(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载会话消息失败';
      setError(msg);
      if (msg.includes('登录已过期')) {
        void signOut();
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
      setAvailableModels([]);
      setSelectedModelId(null);
      setModelPickerVisible(false);
      setModelError(null);
      setSendingPrompt('');
      return;
    }
    void loadSessions();
    void loadModels();
  }, [loadModels, loadSessions, token]);

  const sendMessage = async (rawContent: string) => {
    if (!rawContent.trim() || !token) return false;
    const content = rawContent.trim();
    const requestSessionId = sessionId;
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setSendingPrompt(content);
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
          useWebSearch,
          runtimeModelId: selectedModelId || undefined,
          targetModelId: selectedModelId || undefined,
        }),
      });

      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error?.message || '请求失败');
      }

      const data = result.data || {};
      const responseSessionId = data.sessionId ? String(data.sessionId) : requestSessionId;
      const activeSessionId = activeSessionIdRef.current;

      if (activeSessionId && responseSessionId && activeSessionId !== responseSessionId) {
        void loadSessions();
        return true;
      }

      const assistantMessage: ChatMessage = {
        id: data.messageId || `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response || '（无内容）',
        timestamp: new Date().toISOString(),
        suggestedEvents: Array.isArray(data.suggestedEvents) ? data.suggestedEvents : undefined,
        taskDecomposition: data.taskDecomposition || null,
        multiTaskDecompositions: Array.isArray(data.multiTaskDecompositions)
          ? data.multiTaskDecompositions
          : null,
      };

      if (responseSessionId) {
        setSessionId(responseSessionId);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) => [...prev, assistantMessage]);
      void loadSessions();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '发送失败';
      setError(msg);
      if (msg.includes('登录已过期')) {
        void signOut();
      }
      return false;
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
        remainingEvents = (msg.suggestedEvents || []).filter(
          (item) => buildEventKey(item) !== buildEventKey(event)
        );
        return {
          ...msg,
          suggestedEvents: remainingEvents.length > 0 ? remainingEvents : undefined,
        };
      })
    );
    return remainingEvents;
  };

  const addEvent = async (event: SuggestedEvent, messageId: string) => {
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

  const dismissEvent = async (event: SuggestedEvent, messageId: string) => {
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

  const addTask = async (
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
        }),
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
      console.error('Failed to add individual task', e);
      return { success: false };
    }
  };

  const dismissDecomposition = async (messageId: string) => {
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

  const setActivePlanIndex = (messageId: string, index: number) => {
    setActivePlanIndexes((prev) => ({
      ...prev,
      [messageId]: index,
    }));
  };

  return {
    loading,
    error,
    isLoggedIn,
    isKeyboardVisible,
    keyboardHeight,
    sending,
    sendingPrompt,
    useWebSearch,
    messages,
    eventActionKey,
    activePlanIndexes,
    headerTitle,
    selectedModelLabel,
    modelsLoading,
    modelError,
    historyVisible,
    sessions,
    sessionId,
    sessionsLoading,
    creatingSession,
    loadingSessionId,
    isModelPickerVisible,
    availableModels,
    selectedModelId,
    auth: {
      mode,
      baseUrlInput,
      identifier,
      email,
      displayName,
      password,
      connectionStatus,
      testingConnection,
      manualApiBaseUrlEnabled,
      setMode: changeAuthMode,
      setBaseUrlInput: updateBaseUrlInput,
      setIdentifier,
      setEmail,
      setDisplayName,
      setPassword,
      handleAuth,
      handleTestConnection,
    },
    header: {
      title: headerTitle,
      selectedModelLabel,
      modelsLoading,
      modelError,
      onOpenHistory: openHistory,
      onOpenModelPicker: openModelPicker,
      onSignOut: signOut,
    },
    list: {
      messages,
      sending,
      sendingPrompt,
      eventActionKey,
      activePlanIndexes,
      onDismissEvent: dismissEvent,
      onAddEvent: addEvent,
      onDismissDecomposition: dismissDecomposition,
      onAddTask: addTask,
      onSetActivePlanIndex: setActivePlanIndex,
    },
    input: {
      sending,
      useWebSearch,
      onToggleWebSearch: toggleWebSearch,
      onSend: sendMessage,
    },
    historyModal: {
      visible: historyVisible,
      sessions,
      sessionId,
      sessionsLoading,
      creatingSession,
      loadingSessionId,
      onClose: closeHistory,
      onCreateSession: createSession,
      onSelectSession: selectSession,
    },
    modelModal: {
      visible: isModelPickerVisible,
      modelsLoading,
      modelError,
      availableModels,
      selectedModelId,
      onClose: closeModelPicker,
      onSelectModel: selectModel,
    },
  };
}
