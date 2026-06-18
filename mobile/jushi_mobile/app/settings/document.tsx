import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Colors, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function DocumentEditorScreen() {
  const router = useRouter();
  const { eventId, eventName } = useLocalSearchParams<{ eventId: string; eventName?: string }>();
  const { token, baseUrl } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChanges = useRef(false);
  const initialContentRef = useRef('');

  const loadDocument = useCallback(async () => {
    if (!token || !eventId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${baseUrl}${API_ENDPOINTS.DOCUMENTS.BY_EVENT(eventId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const documentContent = result.data?.content || '';
        setContent(documentContent);
        initialContentRef.current = documentContent;
      } else if (response.status === 404) {
        setContent('');
        initialContentRef.current = '';
      } else {
        throw new Error(result.error || result.message || '加载文档失败');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '加载文档失败';
      setErrorMessage(msg);
      Alert.alert('加载失败', msg);
    } finally {
      setLoading(false);
    }
  }, [token, baseUrl, eventId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    if (content === initialContentRef.current) return;
    if (!lastSaved && content === '') return;

    hasUnsavedChanges.current = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content]);

  const saveDocument = async () => {
    if (!hasUnsavedChanges.current || !token || !eventId) return;

    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const response = await fetch(`${baseUrl}${API_ENDPOINTS.DOCUMENTS.BASE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId,
          content,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || '保存失败');
      }

      setLastSaved(new Date());
      setSaveStatus('saved');
      hasUnsavedChanges.current = false;
      initialContentRef.current = content;

      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      setSaveStatus('error');
      const msg = error instanceof Error ? error.message : '保存失败';
      setErrorMessage(msg);
    }
  };

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveDocument();
  };

  const handleGoBack = () => {
    if (hasUnsavedChanges.current) {
      Alert.alert(
        '未保存的更改',
        '您有未保存的更改，是否保存后再离开？',
        [
          { text: '不保存', style: 'destructive', onPress: () => router.back() },
          {
            text: '保存',
            onPress: async () => {
              await handleManualSave();
              router.back();
            },
          },
          { text: '取消', style: 'cancel' },
        ]
      );
    } else {
      router.back();
    }
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <ThemedText type="caption" style={[styles.statusText, { color: Colors.light.primary }]}>
              正在保存...
            </ThemedText>
          </View>
        );
      case 'saved':
        return (
          <View style={styles.statusRow}>
            <MaterialIcons name="check-circle" size={14} color={Colors.light.success} />
            <ThemedText type="caption" style={[styles.statusText, { color: Colors.light.success }]}>
              已保存 {lastSaved?.toLocaleTimeString()}
            </ThemedText>
          </View>
        );
      case 'error':
        return (
          <View style={styles.statusRow}>
            <MaterialIcons name="error" size={14} color={Colors.light.error} />
            <ThemedText type="caption" style={[styles.statusText, { color: Colors.light.error }]}>
              {errorMessage || '保存失败'}
            </ThemedText>
          </View>
        );
      default:
        return lastSaved ? (
          <View style={styles.statusRow}>
            <MaterialIcons name="check-circle-outline" size={14} color={Colors.light.textSecondary} />
            <ThemedText type="caption" style={[styles.statusText, { color: Colors.light.textSecondary }]}>
              上次保存: {lastSaved.toLocaleTimeString()}
            </ThemedText>
          </View>
        ) : null;
    }
  };

  if (!eventId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={Colors.light.error} />
          <ThemedText type="subtitle" style={{ marginTop: Spacing.md }}>
            未指定日程
          </ThemedText>
          <Button
            title="返回"
            variant="secondary"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="ghost" title="返回" onPress={handleGoBack} size="sm" />
          <View style={styles.headerTitleWrap}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {eventName || '工作文档'}
            </ThemedText>
            {renderSaveStatus()}
          </View>
        </View>
        <Button
          title="保存"
          icon={<MaterialIcons name="save" size={18} color="#fff" />}
          onPress={handleManualSave}
          disabled={saveStatus === 'saving'}
          loading={saveStatus === 'saving'}
          size="sm"
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <ThemedText type="caption" style={{ marginTop: Spacing.md, color: Colors.light.textSecondary }}>
            正在加载文档...
          </ThemedText>
        </View>
      ) : errorMessage && !content ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={Colors.light.error} />
          <ThemedText type="subtitle" style={{ marginTop: Spacing.md, color: Colors.light.error }}>
            {errorMessage}
          </ThemedText>
          <Button
            title="重试"
            variant="secondary"
            onPress={loadDocument}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <Card variant="outlined" style={styles.editorCard}>
            <Input
              value={content}
              onChangeText={setContent}
              placeholder="在这里记录您的工作内容、想法和待办事项...&#10;&#10;支持 Markdown 格式：&#10;- **粗体** 和 *斜体*&#10;- # 标题&#10;- - 列表&#10;- [链接](url)"
              multiline
              style={styles.textArea}
              containerStyle={styles.textAreaContainer}
              autoCapitalize="sentences"
              autoCorrect
            />
          </Card>

          <View style={styles.hintBar}>
            <MaterialIcons name="info-outline" size={16} color={Colors.light.textSecondary} />
            <ThemedText type="caption" style={styles.hintText}>
              文档会自动保存，也支持手动保存
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      )}
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
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleWrap: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusText: {
    marginLeft: Spacing.xs,
  },
  editorCard: {
    flex: 1,
    margin: Spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  textAreaContainer: {
    flex: 1,
    marginBottom: 0,
  },
  textArea: {
    flex: 1,
    minHeight: 400,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  hintText: {
    color: Colors.light.textSecondary,
  },
});
