import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BookAnalysisChapter, BookAnalysisProject } from '@/types/book-analysis';
import * as bookAnalysisService from '@/services/bookAnalysisService';

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return '待分析';
    case 'running':
      return '分析中';
    case 'completed':
      return '已完成';
    case 'completed_with_errors':
      return '已完成（含异常）';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'draft':
      return Colors.light.textSecondary;
    case 'running':
      return Colors.light.primary;
    case 'completed':
      return Colors.light.success;
    case 'completed_with_errors':
      return '#F59E0B';
    case 'failed':
      return Colors.light.error;
    default:
      return Colors.light.textSecondary;
  }
}

function cloneChapters(chapters: BookAnalysisChapter[]): BookAnalysisChapter[] {
  return chapters.map((ch) => ({ ...ch }));
}

export default function BookAnalysisScreen() {
  const { token, baseUrl } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');

  const [projects, setProjects] = useState<BookAnalysisProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draftChapters, setDraftChapters] = useState<BookAnalysisChapter[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const draftDirty = useMemo(() => {
    if (!selectedProject) return false;
    return JSON.stringify(selectedProject.chapters) !== JSON.stringify(draftChapters);
  }, [selectedProject, draftChapters]);

  const draftValidationError = useMemo(() => {
    if (!draftChapters.length) return '至少保留一个章节';
    let previousEnd = 0;
    for (const chapter of draftChapters) {
      const title = chapter.title.trim();
      if (!title) return '章节标题不能为空';
      if (chapter.startPage < 1 || chapter.endPage < 1) return '页码必须大于 0';
      if (chapter.startPage > chapter.endPage) return `《${title}》起始页不能大于结束页`;
      if (selectedProject && chapter.endPage > selectedProject.pageCount) {
        return `《${title}》页码超出总页数`;
      }
      if (chapter.startPage <= previousEnd) return '章节页码必须按顺序且不能重叠';
      previousEnd = chapter.endPage;
    }
    return '';
  }, [draftChapters, selectedProject]);

  const loadProjects = useCallback(
    async (preserveSelection = true) => {
      if (!token) return;
      try {
        setLoading(true);
        const nextProjects = await bookAnalysisService.listProjects(baseUrl, token);
        setProjects(nextProjects);
        if (!preserveSelection || !selectedProjectId) {
          setSelectedProjectId(nextProjects[0]?.id || null);
        } else if (!nextProjects.some((p) => p.id === selectedProjectId)) {
          setSelectedProjectId(nextProjects[0]?.id || null);
        }
      } catch (error) {
        Alert.alert('加载失败', error instanceof Error ? error.message : '无法获取书籍分析项目');
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, token, selectedProjectId]
  );

  useEffect(() => {
    void loadProjects(false);
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setDraftChapters([]);
      return;
    }
    setDraftChapters(cloneChapters(selectedProject.chapters));
  }, [selectedProjectId]);

  // Auto-poll when project is running
  useEffect(() => {
    if (selectedProject?.status === 'running') {
      pollingRef.current = setInterval(() => {
        void loadProjects(true);
      }, 3000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [selectedProject?.id, selectedProject?.status, loadProjects]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
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

      setCreating(true);
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? asset.uri : asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/pdf',
      } as any);
      if (draftTitle.trim()) {
        formData.append('title', draftTitle.trim());
      }

      const project = await bookAnalysisService.createProject(baseUrl, formData, token);
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(project.id);
      setDraftTitle('');
      Alert.alert('项目已创建', `《${project.title}》已上传，继续校正章节后即可开始分析。`);
    } catch (error) {
      Alert.alert('上传失败', error instanceof Error ? error.message : '无法创建项目');
    } finally {
      setCreating(false);
    }
  };

  const updateChapter = (index: number, patch: Partial<BookAnalysisChapter>) => {
    setDraftChapters((current) =>
      current.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter))
    );
  };

  const handleAddChapter = () => {
    const lastChapter = draftChapters[draftChapters.length - 1];
    const nextStart = lastChapter ? lastChapter.endPage + 1 : 1;
    const nextEnd = selectedProject ? Math.min(nextStart, selectedProject.pageCount) : nextStart;
    setDraftChapters((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        title: `新章节 ${current.length + 1}`,
        startPage: nextStart,
        endPage: nextEnd,
        status: 'draft',
        summary: '',
        keyPoints: [],
        arguments: [],
        examples: [],
        evidence: [],
        quotedEvidence: [],
        openQuestions: [],
        rawAnswer: '',
        error: null,
      },
    ]);
  };

  const handleRemoveChapter = (index: number) => {
    setDraftChapters((current) => current.filter((_, i) => i !== index));
  };

  const handleSaveChapters = async () => {
    if (!selectedProject) return;
    if (draftValidationError) {
      Alert.alert('章节校验失败', draftValidationError);
      return;
    }

    try {
      setSaving(true);
      const project = await bookAnalysisService.updateChapters(
        baseUrl,
        selectedProject.id,
        draftChapters.map((ch) => ({
          title: ch.title,
          startPage: ch.startPage,
          endPage: ch.endPage,
        })),
        token
      );
      setProjects((current) => current.map((p) => (p.id === project.id ? project : p)));
      setSelectedProjectId(project.id);
      Alert.alert('章节已保存', '现在可以启动 NotebookLM 逐章分析。');
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '无法保存章节');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    if (!selectedProject) return;
    if (draftDirty) {
      Alert.alert('请先保存章节', '章节草稿已变更，请先保存后再启动分析。');
      return;
    }
    if (draftValidationError) {
      Alert.alert('章节校验失败', draftValidationError);
      return;
    }
    try {
      setStarting(true);
      const project = await bookAnalysisService.startAnalysis(baseUrl, selectedProject.id, token);
      setProjects((current) => current.map((p) => (p.id === project.id ? project : p)));
      Alert.alert('分析已启动', 'NotebookLM 正在逐章处理，请保持页面开启或稍后回来查看。');
    } catch (error) {
      Alert.alert('启动失败', error instanceof Error ? error.message : '无法启动分析');
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerBadge}>
              <IconSymbol name="book.fill" size={16} color={Colors.light.primary} />
              <ThemedText type="caption" style={styles.headerBadgeText}>
                NotebookLM Book Analysis
              </ThemedText>
            </View>
          </View>
          <ThemedText type="heading" style={styles.headerTitle}>
            书籍逐章分析
          </ThemedText>
          <ThemedText type="caption" style={styles.headerSubtitle}>
            上传一本 PDF，校正章节范围，调用 NotebookLM 做逐章分析，并在双栏阅读页中同时查看原文与分析结果。
          </ThemedText>
        </View>

        {/* Upload Section */}
        <Card variant="outlined" style={styles.uploadCard}>
          <Input
            label="可选书名"
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="默认使用 PDF 文件名"
          />
          <TouchableOpacity
            style={styles.uploadArea}
            onPress={handleUpload}
            disabled={creating}
            activeOpacity={0.7}
          >
            {creating ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <IconSymbol name="doc.fill" size={24} color={Colors.light.textSecondary} />
            )}
            <ThemedText type="default" style={styles.uploadText}>
              {creating ? '正在上传并提取章节...' : '上传 PDF 创建项目'}
            </ThemedText>
          </TouchableOpacity>
        </Card>

        {/* Project List & Chapter Editor */}
        <View style={styles.mainRow}>
          {/* Project List */}
          <Card variant="outlined" style={styles.projectListCard}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>项目列表</ThemedText>
            {loading && projects.length === 0 ? (
              <View style={styles.centeredState}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
                <ThemedText type="caption" style={styles.stateText}>
                  加载项目中...
                </ThemedText>
              </View>
            ) : projects.length === 0 ? (
              <View style={styles.centeredState}>
                <ThemedText type="caption" style={styles.stateText}>
                  还没有书籍分析项目，先上传一本书。
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.projectList} nestedScrollEnabled>
                {projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      styles.projectItem,
                      project.id === selectedProjectId && styles.projectItemActive,
                    ]}
                    onPress={() => setSelectedProjectId(project.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.projectItemHeader}>
                      <View style={styles.projectItemInfo}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.projectTitle}>
                          {project.title}
                        </ThemedText>
                        <ThemedText type="caption" numberOfLines={1} style={styles.projectFilename}>
                          {project.originalFilename}
                        </ThemedText>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor(project.status) + '20' }]}>
                        <ThemedText type="caption" style={[styles.statusText, { color: statusColor(project.status) }]}>
                          {statusLabel(project.status)}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="caption" style={styles.projectMeta}>
                      章节 {project.totalChapters} · 进度 {project.progressPercent}%
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Card>

          {/* Chapter Editor */}
          <Card variant="outlined" style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <ThemedText type="subtitle">章节草稿与任务控制</ThemedText>
              <ThemedText type="caption" style={styles.editorHint}>
                调整章节名与页码范围，保存后即可触发 NotebookLM 逐章分析。
              </ThemedText>
            </View>

            {!selectedProject ? (
              <View style={styles.centeredState}>
                <ThemedText type="caption" style={styles.stateText}>
                  选择左侧项目后即可编辑章节。
                </ThemedText>
              </View>
            ) : (
              <>
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <ThemedText type="caption" style={styles.statLabel}>总页数</ThemedText>
                    <ThemedText type="title" style={styles.statValue}>{selectedProject.pageCount}</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText type="caption" style={styles.statLabel}>章节数</ThemedText>
                    <ThemedText type="title" style={styles.statValue}>{draftChapters.length}</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText type="caption" style={styles.statLabel}>当前状态</ThemedText>
                    <ThemedText type="defaultSemiBold" style={[styles.statValueSm, { color: statusColor(selectedProject.status) }]}>
                      {statusLabel(selectedProject.status)}
                    </ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText type="caption" style={styles.statLabel}>阶段</ThemedText>
                    <ThemedText type="caption" numberOfLines={1} style={styles.statValueSm}>
                      {selectedProject.currentStage || 'draft'}
                    </ThemedText>
                  </View>
                </View>

                {/* Error display */}
                {selectedProject.error ? (
                  <View style={styles.errorBox}>
                    <ThemedText type="caption" style={styles.errorText}>{selectedProject.error}</ThemedText>
                  </View>
                ) : null}

                {/* Chapter List Editor */}
                <ScrollView style={styles.chapterEditorScroll} nestedScrollEnabled>
                  {draftChapters.map((chapter, index) => (
                    <View key={chapter.id} style={styles.chapterRow}>
                      <View style={styles.chapterRowFields}>
                        <Input
                          value={chapter.title}
                          onChangeText={(value) => updateChapter(index, { title: value })}
                          containerStyle={styles.chapterTitleInput}
                          placeholder="章节标题"
                          editable={selectedProject.status !== 'running'}
                        />
                        <Input
                          value={String(chapter.startPage)}
                          onChangeText={(value) => updateChapter(index, { startPage: Number(value) || 1 })}
                          containerStyle={styles.chapterPageInput}
                          keyboardType="number-pad"
                          placeholder="起始"
                          editable={selectedProject.status !== 'running'}
                        />
                        <Input
                          value={String(chapter.endPage)}
                          onChangeText={(value) => updateChapter(index, { endPage: Number(value) || 1 })}
                          containerStyle={styles.chapterPageInput}
                          keyboardType="number-pad"
                          placeholder="结束"
                          editable={selectedProject.status !== 'running'}
                        />
                      </View>
                      {selectedProject.status !== 'running' && draftChapters.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveChapter(index)}
                        >
                          <ThemedText type="caption" style={styles.removeBtnText}>删除</ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <View style={styles.actionsLeft}>
                    <Button
                      title="新增章节"
                      variant="secondary"
                      size="sm"
                      onPress={handleAddChapter}
                      disabled={selectedProject.status === 'running'}
                      icon={<IconSymbol name="plus" size={16} color={Colors.light.primary} />}
                    />
                    {draftValidationError ? (
                      <ThemedText type="caption" style={styles.validationError}>
                        {draftValidationError}
                      </ThemedText>
                    ) : draftDirty ? (
                      <ThemedText type="caption" style={styles.dirtyHint}>
                        章节草稿已变更，记得先保存。
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.actionsRight}>
                    <Button
                      title="保存章节"
                      variant="secondary"
                      size="sm"
                      onPress={handleSaveChapters}
                      loading={saving}
                      disabled={saving || selectedProject.status === 'running'}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="启动分析"
                      variant="primary"
                      size="sm"
                      onPress={handleStart}
                      loading={starting}
                      disabled={starting || selectedProject.status === 'running' || !!draftValidationError}
                      style={[styles.actionBtn, styles.startBtn]}
                    />
                  </View>
                </View>

                {/* Status hint */}
                <View style={styles.statusHint}>
                  <ThemedText type="caption" style={styles.statusHintText}>
                    {selectedProject.status === 'running'
                      ? `正在执行第 ${selectedProject.currentChapterIndex || 0} / ${selectedProject.totalChapters} 章，当前阶段：${selectedProject.currentStage}`
                      : selectedProject.status === 'completed' || selectedProject.status === 'completed_with_errors'
                      ? '分析已完成，可以查看详情。'
                      : '流程：上传 PDF -> 修正章节 -> 保存 -> 启动分析 -> 查看详情。'}
                  </ThemedText>
                  {(selectedProject.status === 'completed' || selectedProject.status === 'completed_with_errors') && (
                    <Button
                      title="查看详情"
                      variant="primary"
                      size="sm"
                      onPress={() => router.push(`/book-analysis/${selectedProject.id}`)}
                      style={styles.viewDetailBtn}
                    />
                  )}
                </View>
              </>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTop: {
    marginBottom: Spacing.sm,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadgeText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: Typography.sizes.xxxl,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: Colors.light.textSecondary,
    lineHeight: Typography.lineHeights.relaxed,
  },
  uploadCard: {
    marginBottom: Spacing.lg,
  },
  uploadArea: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  uploadText: {
    color: Colors.light.textSecondary,
  },
  mainRow: {
    gap: Spacing.md,
  },
  projectListCard: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  centeredState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  stateText: {
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  projectList: {
    maxHeight: 300,
  },
  projectItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceHighlight,
  },
  projectItemActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '10',
  },
  projectItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  projectItemInfo: {
    flex: 1,
  },
  projectTitle: {
    marginBottom: 2,
  },
  projectFilename: {
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontWeight: '600',
  },
  projectMeta: {
    color: Colors.light.textSecondary,
    marginTop: Spacing.xs,
  },
  editorCard: {
    flex: 2,
  },
  editorHeader: {
    marginBottom: Spacing.md,
  },
  editorHint: {
    color: Colors.light.textSecondary,
    marginTop: Spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: 80,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceHighlight,
  },
  statLabel: {
    color: Colors.light.textSecondary,
    marginBottom: 4,
    fontSize: Typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: Typography.sizes.xxl,
  },
  statValueSm: {
    fontSize: Typography.sizes.sm,
  },
  errorBox: {
    backgroundColor: Colors.light.error + '10',
    borderWidth: 1,
    borderColor: Colors.light.error + '30',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.light.error,
  },
  chapterEditorScroll: {
    maxHeight: 300,
    marginBottom: Spacing.md,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chapterRowFields: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chapterTitleInput: {
    flex: 2,
    marginBottom: 0,
  },
  chapterPageInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeBtn: {
    padding: Spacing.sm,
  },
  removeBtnText: {
    color: Colors.light.error,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionsLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  validationError: {
    color: '#F59E0B',
  },
  dirtyHint: {
    color: Colors.light.textSecondary,
  },
  actionBtn: {
    minWidth: 90,
  },
  startBtn: {
    backgroundColor: Colors.light.success,
  },
  statusHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceHighlight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statusHintText: {
    color: Colors.light.textSecondary,
    flex: 1,
  },
  viewDetailBtn: {
    backgroundColor: Colors.light.primary,
  },
});
