import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BookAnalysisProject } from '@/types/book-analysis';
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

function renderList(title: string, items: string[]) {
  if (!items?.length) return null;
  return (
    <View style={styles.sectionBox}>
      <ThemedText type="caption" style={styles.sectionBoxTitle}>
        {title}
      </ThemedText>
      <View style={styles.sectionBoxItems}>
        {items.map((item, index) => (
          <View key={`${title}-${index}`} style={styles.sectionBoxItem}>
            <ThemedText type="default" style={styles.sectionBoxItemText}>
              {item}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function BookAnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, baseUrl } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');

  const [project, setProject] = useState<BookAnalysisProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedChapter = useMemo(
    () => project?.chapters?.[selectedChapterIndex] || null,
    [project, selectedChapterIndex]
  );

  const loadProject = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const nextProject = await bookAnalysisService.getProject(baseUrl, id, token);
      setProject(nextProject);
      setSelectedChapterIndex((current) =>
        Math.min(current, Math.max(0, nextProject.chapters.length - 1))
      );
    } catch (error) {
      Alert.alert('加载失败', error instanceof Error ? error.message : '无法读取项目详情');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, token, id]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (project?.status !== 'running') return;
    pollingRef.current = setInterval(() => {
      void loadProject();
    }, 3000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [project?.status, project?.id, loadProject]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Button
              title="返回"
              variant="ghost"
              size="sm"
              onPress={() => router.back()}
              icon={<IconSymbol name="chevron.left" size={16} color={Colors.light.primary} />}
            />
            <View style={styles.headerBadge}>
              <IconSymbol name="book.fill" size={14} color={Colors.light.primary} />
              <ThemedText type="caption" style={styles.headerBadgeText}>
                双栏阅读页
              </ThemedText>
            </View>
          </View>
          {loading ? (
            <ThemedText type="subtitle">加载中...</ThemedText>
          ) : project ? (
            <>
              <ThemedText type="heading" style={styles.headerTitle}>
                {project.title}
              </ThemedText>
              <ThemedText type="caption" style={styles.headerMeta}>
                {project.originalFilename} · 章节 {project.totalChapters} · 进度 {project.progressPercent}%
              </ThemedText>
            </>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ThemedText type="caption" style={styles.stateText}>加载中...</ThemedText>
          </View>
        ) : !project ? (
          <View style={styles.loadingState}>
            <ThemedText type="caption" style={styles.stateText}>项目不存在</ThemedText>
          </View>
        ) : (
          <>
            {/* Status badge + Refresh */}
            <View style={styles.toolbar}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(project.status) + '20' }]}>
                <ThemedText type="caption" style={[styles.statusText, { color: statusColor(project.status) }]}>
                  {statusLabel(project.status)}
                </ThemedText>
              </View>
              <Button
                title="刷新"
                variant="ghost"
                size="sm"
                onPress={() => loadProject()}
                icon={<IconSymbol name="arrow.clockwise" size={14} color={Colors.light.primary} />}
              />
            </View>

            {/* Error display */}
            {project.error ? (
              <View style={styles.errorBox}>
                <ThemedText type="caption" style={styles.errorText}>{project.error}</ThemedText>
              </View>
            ) : null}

            {/* Chapter Selector */}
            <View style={styles.chapterSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapterSelectorContent}>
                {project.chapters.map((chapter, index) => (
                  <TouchableOpacity
                    key={chapter.id}
                    style={[
                      styles.chapterChip,
                      index === selectedChapterIndex && styles.chapterChipActive,
                    ]}
                    onPress={() => setSelectedChapterIndex(index)}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      type="caption"
                      style={[
                        styles.chapterChipText,
                        index === selectedChapterIndex && styles.chapterChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {index + 1}. {chapter.title}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Selected Chapter Content */}
            {!selectedChapter ? (
              <View style={styles.loadingState}>
                <ThemedText type="caption" style={styles.stateText}>暂无章节结果</ThemedText>
              </View>
            ) : (
              <>
                {/* Chapter Header */}
                <Card variant="outlined" style={styles.chapterHeaderCard}>
                  <View style={styles.chapterHeaderRow}>
                    <View style={styles.chapterHeaderInfo}>
                      <ThemedText type="subtitle">{selectedChapter.title}</ThemedText>
                      <ThemedText type="caption" style={styles.chapterPageRange}>
                        页码 {selectedChapter.startPage} - {selectedChapter.endPage}
                      </ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(selectedChapter.status) + '20' }]}>
                      <ThemedText type="caption" style={[styles.statusText, { color: statusColor(selectedChapter.status) }]}>
                        {statusLabel(selectedChapter.status)}
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {/* Chapter Error */}
                {selectedChapter.error ? (
                  <View style={styles.chapterErrorBox}>
                    <ThemedText type="caption" style={styles.chapterErrorText}>
                      {selectedChapter.error}
                    </ThemedText>
                  </View>
                ) : null}

                {/* Summary */}
                <View style={styles.sectionBox}>
                  <ThemedText type="caption" style={styles.sectionBoxTitle}>章节摘要</ThemedText>
                  <ThemedText type="default" style={styles.summaryText}>
                    {selectedChapter.summary || '该章节尚未生成摘要。'}
                  </ThemedText>
                </View>

                {/* Structured analysis */}
                {renderList('关键点', selectedChapter.keyPoints)}
                {renderList('论点', selectedChapter.arguments)}
                {renderList('例子', selectedChapter.examples)}
                {renderList('开放问题', selectedChapter.openQuestions)}
                {renderList('证据', selectedChapter.quotedEvidence)}

                {/* Raw answer if error */}
                {selectedChapter.rawAnswer && selectedChapter.status !== 'completed' && (
                  <View style={styles.sectionBox}>
                    <ThemedText type="caption" style={styles.sectionBoxTitle}>原始回答</ThemedText>
                    <View style={styles.rawAnswerBox}>
                      <ThemedText type="caption" style={styles.rawAnswerText}>
                        {selectedChapter.rawAnswer}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
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
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBadgeText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  headerTitle: {
    marginBottom: Spacing.xs,
  },
  headerMeta: {
    color: Colors.light.textSecondary,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  stateText: {
    color: Colors.light.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontWeight: '600',
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
  chapterSelector: {
    marginBottom: Spacing.md,
  },
  chapterSelectorContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chapterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceHighlight,
  },
  chapterChipActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '15',
  },
  chapterChipText: {
    color: Colors.light.textSecondary,
  },
  chapterChipTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  chapterHeaderCard: {
    marginBottom: Spacing.md,
  },
  chapterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chapterHeaderInfo: {
    flex: 1,
  },
  chapterPageRange: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  chapterErrorBox: {
    backgroundColor: '#F59E0B10',
    borderWidth: 1,
    borderColor: '#F59E0B30',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  chapterErrorText: {
    color: '#D97706',
  },
  sectionBox: {
    backgroundColor: Colors.light.surfaceHighlight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionBoxTitle: {
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: Typography.sizes.xs,
  },
  sectionBoxItems: {
    gap: Spacing.sm,
  },
  sectionBoxItem: {
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  sectionBoxItemText: {
    lineHeight: Typography.lineHeights.relaxed,
  },
  summaryText: {
    lineHeight: Typography.lineHeights.relaxed,
  },
  rawAnswerBox: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  rawAnswerText: {
    color: Colors.light.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.lineHeights.normal,
  },
});
