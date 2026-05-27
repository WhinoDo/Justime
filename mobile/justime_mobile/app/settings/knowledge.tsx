import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';

type KnowledgeFile = {
  name: string;
  size: number;
  modified: number;
};

type RebuildStatus = {
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  error?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
};

type PreviewState = {
  visible: boolean;
  fileName: string;
  content: string;
  loading: boolean;
  error: string;
  truncated: boolean;
  charCount: number;
  maxChars: number;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFileIcon = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'picture-as-pdf';
  if (['txt', 'md', 'json', 'yaml', 'yml', 'xml', 'html', 'htm', 'log', 'ini'].includes(ext)) return 'description';
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext)) return 'code';
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'table-chart';
  if (['doc', 'docx'].includes(ext)) return 'article';
  return 'insert-drive-file';
};

export default function KnowledgeScreen() {
  const router = useRouter();
  const { token, baseUrl } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildTaskId, setRebuildTaskId] = useState<string | null>(null);
  const [rebuildStatus, setRebuildStatus] = useState<RebuildStatus | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>({
    visible: false,
    fileName: '',
    content: '',
    loading: false,
    error: '',
    truncated: false,
    charCount: 0,
    maxChars: 20000,
  });

  const isPdfFile = (filename: string) => filename.toLowerCase().endsWith('.pdf');

  const openPreview = async (filename: string) => {
    if (isPdfFile(filename)) {
      const url = `${baseUrl}/api/v1/knowledge/raw/${encodeURIComponent(filename)}`;
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        Alert.alert('打开失败', '无法打开 PDF 文件');
      }
      return;
    }

    setPreviewState({
      visible: true,
      fileName: filename,
      content: '',
      loading: true,
      error: '',
      truncated: false,
      charCount: 0,
      maxChars: 20000,
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/knowledge/content/${encodeURIComponent(filename)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
      }

      setPreviewState((prev) => ({
        ...prev,
        content: String(payload.content || ''),
        truncated: Boolean(payload.truncated),
        charCount: Number(payload.charCount || 0),
        maxChars: Number(payload.maxChars || 20000),
        loading: false,
      }));
    } catch (error) {
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '文档预览加载失败',
      }));
    }
  };

  const closePreview = () => {
    setPreviewState((prev) => ({ ...prev, visible: false }));
  };

  const fetchFiles = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/knowledge/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.files)) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFiles(result.files);
      }
    } catch {
      Alert.alert('加载失败', '无法获取知识库文件列表');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, baseUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri || !asset.name) {
        Alert.alert('错误', '无法获取文件信息');
        return;
      }

      setUploading(true);
      const formData = new FormData();
      const fileUri = Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri;

      formData.append('file', {
        uri: Platform.OS === 'ios' ? `file://${fileUri}` : asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      } as any);

      const response = await fetch(`${baseUrl}/api/v1/knowledge/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.detail || resJson.message || '上传失败');
      }

      Alert.alert('上传成功', `文件 ${asset.name} 已添加到知识库`);
      await fetchFiles();
    } catch (error) {
      Alert.alert('上传失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    Alert.alert(
      '删除文件',
      `确认删除「${filename}」吗？删除后无法恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setDeletingFile(filename);
            try {
              const response = await fetch(`${baseUrl}/api/v1/knowledge/files/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const result = await response.json();
              if (!response.ok || !result.success) {
                throw new Error(result.detail || result.message || '删除失败');
              }
              await fetchFiles();
            } catch (error) {
              Alert.alert('删除失败', error instanceof Error ? error.message : '请稍后重试');
            } finally {
              setDeletingFile(null);
            }
          },
        },
      ]
    );
  };

  const handleRebuildIndex = async () => {
    if (!token) return;
    setRebuildLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/knowledge/rebuild`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.detail || result.message || '重建索引失败');
      }
      setRebuildTaskId(result.task_id);
      setRebuildStatus({ status: 'pending', message: '任务已创建' });
      setStatusModalVisible(true);
    } catch (error) {
      Alert.alert('重建索引失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setRebuildLoading(false);
    }
  };

  const fetchRebuildStatus = useCallback(async () => {
    if (!token || !rebuildTaskId) return;
    try {
      const response = await fetch(`${baseUrl}/api/v1/knowledge/rebuild/status/${rebuildTaskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setRebuildStatus({
          status: result.status,
          message: result.message,
          error: result.error,
          created_at: result.created_at,
          started_at: result.started_at,
          completed_at: result.completed_at,
        });
      }
    } catch {
      console.error('Failed to fetch rebuild status');
    }
  }, [token, baseUrl, rebuildTaskId]);

  useEffect(() => {
    if (!statusModalVisible || !rebuildTaskId) return;
    const interval = setInterval(fetchRebuildStatus, 2000);
    return () => clearInterval(interval);
  }, [statusModalVisible, rebuildTaskId, fetchRebuildStatus]);

  const renderFileItem = ({ item }: { item: KnowledgeFile }) => (
    <Card variant="outlined" style={styles.fileCard}>
      <View style={styles.fileRow}>
        <TouchableOpacity
          style={styles.fileMainArea}
          onPress={() => openPreview(item.name)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={getFileIcon(item.name) as any}
            size={28}
            color={Colors.light.primary}
          />
          <View style={styles.fileInfo}>
            <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.fileName}>
              {item.name}
            </ThemedText>
            <View style={styles.fileMeta}>
              <ThemedText type="caption" style={styles.fileMetaText}>
                {formatFileSize(item.size)}
              </ThemedText>
              <ThemedText type="caption" style={styles.fileMetaText}>
                •
              </ThemedText>
              <ThemedText type="caption" style={styles.fileMetaText}>
                {formatDate(item.modified)}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.previewButton}
          onPress={() => openPreview(item.name)}
        >
          <MaterialIcons name="visibility" size={22} color={Colors.light.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.name)}
          disabled={deletingFile === item.name}
        >
          {deletingFile === item.name ? (
            <ActivityIndicator size="small" color={Colors.light.error} />
          ) : (
            <MaterialIcons name="delete-outline" size={22} color={Colors.light.error} />
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderStatusModal = () => (
    <Modal
      visible={statusModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setStatusModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: surfaceColor, borderColor }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">索引重建状态</ThemedText>
            <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {rebuildStatus ? (
            <View style={styles.statusContent}>
              <View style={styles.statusRow}>
                <MaterialIcons
                  name={
                    rebuildStatus.status === 'completed'
                      ? 'check-circle'
                      : rebuildStatus.status === 'failed'
                      ? 'error'
                      : rebuildStatus.status === 'running'
                      ? 'sync'
                      : 'schedule'
                  }
                  size={32}
                  color={
                    rebuildStatus.status === 'completed'
                      ? Colors.light.success
                      : rebuildStatus.status === 'failed'
                      ? Colors.light.error
                      : Colors.light.primary
                  }
                />
                <ThemedText type="defaultSemiBold" style={styles.statusText}>
                  {rebuildStatus.status === 'completed'
                    ? '已完成'
                    : rebuildStatus.status === 'failed'
                    ? '失败'
                    : rebuildStatus.status === 'running'
                    ? '进行中'
                    : '等待中'}
                </ThemedText>
              </View>

              {rebuildStatus.message && (
                <ThemedText type="caption" style={styles.statusMessage}>
                  {rebuildStatus.message}
                </ThemedText>
              )}

              {rebuildStatus.error && (
                <ThemedText type="caption" style={styles.statusError}>
                  错误: {rebuildStatus.error}
                </ThemedText>
              )}

              <View style={styles.statusTimes}>
                {rebuildStatus.created_at && (
                  <ThemedText type="caption">
                    创建时间: {new Date(rebuildStatus.created_at).toLocaleString('zh-CN')}
                  </ThemedText>
                )}
                {rebuildStatus.started_at && (
                  <ThemedText type="caption">
                    开始时间: {new Date(rebuildStatus.started_at).toLocaleString('zh-CN')}
                  </ThemedText>
                )}
                {rebuildStatus.completed_at && (
                  <ThemedText type="caption">
                    完成时间: {new Date(rebuildStatus.completed_at).toLocaleString('zh-CN')}
                  </ThemedText>
                )}
              </View>
            </View>
          ) : null}

          <View style={styles.modalFooter}>
            <Button
              title="关闭"
              variant="secondary"
              onPress={() => setStatusModalVisible(false)}
              style={styles.modalButton}
            />
            {rebuildStatus?.status === 'running' && (
              <Button
                title="刷新状态"
                onPress={fetchRebuildStatus}
                style={styles.modalButton}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {renderStatusModal()}

      <Modal
        visible={previewState.visible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surfaceColor, borderColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" numberOfLines={1} style={{ flex: 1, marginRight: Spacing.sm }}>
                文档预览: {previewState.fileName}
              </ThemedText>
              <TouchableOpacity onPress={closePreview}>
                <MaterialIcons name="close" size={24} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
              {previewState.loading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={Colors.light.primary} />
                  <ThemedText type="caption" style={{ marginTop: Spacing.md, color: Colors.light.textSecondary }}>
                    正在加载文档内容...
                  </ThemedText>
                </View>
              ) : previewState.error ? (
                <View style={styles.previewErrorContainer}>
                  <MaterialIcons name="error-outline" size={32} color={Colors.light.error} />
                  <ThemedText type="caption" style={{ color: Colors.light.error, marginTop: Spacing.sm }}>
                    {previewState.error}
                  </ThemedText>
                </View>
              ) : (
                <>
                  <ThemedText style={styles.previewText}>
                    {previewState.content || '暂无内容'}
                  </ThemedText>
                  {previewState.truncated && (
                    <ThemedText type="caption" style={styles.truncatedHint}>
                      文档较长，当前仅展示前 {previewState.maxChars.toLocaleString()} 字内容（原文 {previewState.charCount.toLocaleString()} 字）。
                    </ThemedText>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="关闭"
                variant="secondary"
                onPress={closePreview}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="ghost" title="返回" onPress={() => router.back()} size="sm" />
          <ThemedText type="subtitle">知识库管理</ThemedText>
        </View>
      </View>

      <View style={styles.actionsBar}>
        <Button
          title={uploading ? '上传中...' : '上传文件'}
          icon={<MaterialIcons name="upload-file" size={18} color="#fff" />}
          onPress={handleUpload}
          disabled={uploading}
          loading={uploading}
          style={styles.actionButton}
        />
        <Button
          title="重建索引"
          variant="secondary"
          icon={<MaterialIcons name="refresh" size={18} color={Colors.light.primary} />}
          onPress={handleRebuildIndex}
          disabled={rebuildLoading}
          loading={rebuildLoading}
          style={styles.actionButton}
        />
      </View>

      <View style={styles.infoCard}>
        <MaterialIcons name="info-outline" size={20} color={Colors.light.textSecondary} />
        <ThemedText type="caption" style={styles.infoText}>
          上传文档后，点击「重建索引」让 AI 能够检索知识库内容。支持 PDF、TXT、MD、JSON 等格式。
        </ThemedText>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.name}
          renderItem={renderFileItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFiles(true)}
              colors={[Colors.light.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="folder-open" size={64} color={Colors.light.textSecondary} />
              <ThemedText type="subtitle" style={styles.emptyTitle}>知识库为空</ThemedText>
              <ThemedText type="caption" style={styles.emptyText}>
                点击上方「上传文件」添加文档
              </ThemedText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    color: Colors.light.textSecondary,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    color: Colors.light.textSecondary,
  },
  emptyText: {
    marginTop: Spacing.xs,
    color: Colors.light.textSecondary,
  },
  fileCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fileName: {
    marginBottom: 2,
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fileMetaText: {
    color: Colors.light.textSecondary,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  previewButton: {
    padding: Spacing.sm,
  },
  fileMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewScroll: {
    maxHeight: 400,
  },
  previewContent: {
    padding: Spacing.md,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: Colors.light.text,
  },
  previewErrorContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  truncatedHint: {
    marginTop: Spacing.md,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  statusContent: {
    padding: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statusText: {
    fontSize: 18,
  },
  statusMessage: {
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
  },
  statusError: {
    color: Colors.light.error,
    marginBottom: Spacing.sm,
  },
  statusTimes: {
    gap: Spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
