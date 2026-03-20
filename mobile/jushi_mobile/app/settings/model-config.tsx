import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Alert, ActivityIndicator, FlatList, TouchableOpacity, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';

type LLMConfigItem = {
    id: string;
    name: string;
    modelId: string;
    baseUrl?: string;
    apiKey?: string;
    isActive: boolean;
    temperature?: number;
};

type DailyUsagePoint = {
    date: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requests: number;
    missingUsageRequests: number;
};

type ModelUsageItem = {
    configId: string;
    name: string;
    modelId: string;
    isActive: boolean;
    totalTokens: number;
    totalRequests: number;
    missingUsageRequests: number;
    sourceCoverage?: number;
    daily: DailyUsagePoint[];
};

export default function ModelConfigScreen() {
    const router = useRouter();
    const { token, baseUrl } = useAuth();
    const backgroundColor = useThemeColor({}, 'background');

    const [configs, setConfigs] = useState<LLMConfigItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [usageLoading, setUsageLoading] = useState(false);
    const [usageError, setUsageError] = useState<string | null>(null);
    const [usageModels, setUsageModels] = useState<ModelUsageItem[]>([]);
    const [usageDays, setUsageDays] = useState(14);
    const [usageNote, setUsageNote] = useState('');
    const [usageScope, setUsageScope] = useState<'primary' | 'all'>('primary');

    const isGPTModel = useCallback((modelId?: string) => modelId?.toLowerCase().includes('gpt') ?? false, []);
    const visibleConfigs = useMemo(
        () =>
            configs
                .filter((config) => !isGPTModel(config.modelId))
                .sort((a, b) => Number(b.isActive) - Number(a.isActive)),
        [configs, isGPTModel]
    );
    const visibleUsageModels = useMemo(
        () => usageModels.filter((model) => !isGPTModel(model.modelId)),
        [usageModels, isGPTModel]
    );

    // Load Configs
    const fetchConfigs = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const response = await fetch(`${baseUrl}/api/v1/auth/llm-configs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success && result.data?.configs) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setConfigs(result.data.configs);
            }
        } catch {
            Alert.alert('加载配置失败', '请检查网络连接');
        } finally {
            setLoading(false);
        }
    }, [token, baseUrl]);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const fetchUsage = useCallback(async () => {
        if (!token) return;
        setUsageLoading(true);
        setUsageError(null);
        try {
            const response = await fetch(`${baseUrl}/api/v1/auth/llm-usage/daily?days=${usageDays}&scope=${usageScope}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || '加载模型使用量失败');
            }
            const models = Array.isArray(result.data?.models) ? result.data.models : [];
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setUsageModels(models);
            setUsageNote(result.data?.note || '');
        } catch (e) {
            setUsageModels([]);
            setUsageNote('');
            setUsageError(e instanceof Error ? e.message : '加载模型使用量失败');
        } finally {
            setUsageLoading(false);
        }
    }, [token, baseUrl, usageDays, usageScope]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    const formatTokenValue = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return `${value}`;
    };

    const formatDayLabel = (value: string) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value.slice(5);
        }
        return value;
    };

    const renderItem = ({ item }: { item: LLMConfigItem }) => (
        <Card variant={item.isActive ? 'elevated' : 'outlined'} style={[styles.card, item.isActive && styles.activeCard]}>
            <View style={styles.cardContent}>
                <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        {item.isActive && <View style={styles.activeBadge}><ThemedText type="label" style={styles.activeText}>当前使用</ThemedText></View>}
                    </View>
                    <ThemedText type="caption" style={styles.cardDetail}>{item.modelId}</ThemedText>
                    <ThemedText type="caption" style={styles.cardDetail} numberOfLines={1}>{item.baseUrl || '默认 URL'}</ThemedText>
                </View>
            </View>
        </Card>
    );

    const renderUsageSection = () => (
        <View style={styles.usageSection}>
            <View style={styles.usageHeaderRow}>
                <View style={styles.usageHeaderTextWrap}>
                    <ThemedText type="defaultSemiBold">模型 Token 使用量</ThemedText>
                    <ThemedText type="caption" style={styles.usageHeaderSubtext}>
                        按天统计每个配置模型的消耗
                    </ThemedText>
                </View>
                <TouchableOpacity style={styles.usageRefreshButton} onPress={fetchUsage} disabled={usageLoading}>
                    <ThemedText type="caption" style={styles.usageRefreshText}>
                        {usageLoading ? '刷新中' : '刷新'}
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <View style={styles.usageDaysRow}>
                <TouchableOpacity
                    style={[styles.usageDaysButton, usageScope === 'primary' && styles.usageDaysButtonActive]}
                    onPress={() => setUsageScope('primary')}
                >
                    <ThemedText
                        type="caption"
                        style={[styles.usageDaysButtonText, usageScope === 'primary' && styles.usageDaysButtonTextActive]}
                    >
                        主链路
                    </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.usageDaysButton, usageScope === 'all' && styles.usageDaysButtonActive]}
                    onPress={() => setUsageScope('all')}
                >
                    <ThemedText
                        type="caption"
                        style={[styles.usageDaysButtonText, usageScope === 'all' && styles.usageDaysButtonTextActive]}
                    >
                        总花费
                    </ThemedText>
                </TouchableOpacity>
                {[7, 14, 30].map(days => (
                    <TouchableOpacity
                        key={days}
                        style={[styles.usageDaysButton, usageDays === days && styles.usageDaysButtonActive]}
                        onPress={() => setUsageDays(days)}
                    >
                        <ThemedText
                            type="caption"
                            style={[styles.usageDaysButtonText, usageDays === days && styles.usageDaysButtonTextActive]}
                        >
                            {days}天
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            {usageError && (
                <Card variant="outlined" style={styles.usageErrorCard}>
                    <ThemedText type="caption" style={styles.usageErrorText}>{usageError}</ThemedText>
                </Card>
            )}

            {usageLoading && usageModels.length === 0 && (
                <View style={styles.usageLoading}>
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                </View>
            )}

            {!usageLoading && !usageError && visibleUsageModels.length === 0 && (
                <View style={styles.usageEmpty}>
                    <ThemedText type="caption">暂无模型使用数据。开始与 AI 助手对话后会生成统计记录。</ThemedText>
                </View>
            )}

            {visibleUsageModels.map(model => {
                const maxToken = Math.max(...model.daily.map(point => point.totalTokens), 0);
                return (
                    <Card key={model.configId} variant="outlined" style={styles.usageModelCard}>
                        <View style={styles.usageModelHeader}>
                            <View style={styles.usageModelNameWrap}>
                                <View style={styles.usageModelNameRow}>
                                    <ThemedText type="defaultSemiBold">{model.name}</ThemedText>
                                    {model.isActive && (
                                        <View style={styles.activeBadge}>
                                            <ThemedText type="label" style={styles.activeText}>当前使用</ThemedText>
                                        </View>
                                    )}
                                </View>
                                <ThemedText type="caption" style={styles.cardDetail}>{model.modelId || '未设置模型 ID'}</ThemedText>
                            </View>
                            <View style={styles.usageModelStats}>
                                <ThemedText type="caption">总 Token: {formatTokenValue(model.totalTokens)}</ThemedText>
                                <ThemedText type="caption">请求数: {model.totalRequests}</ThemedText>
                                <ThemedText type="caption">usage 缺失: {model.missingUsageRequests || 0}</ThemedText>
                                <ThemedText type="caption">覆盖率: {Math.round((model.sourceCoverage ?? 1) * 100)}%</ThemedText>
                            </View>
                        </View>

                        <View style={styles.usageChart}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.usageChartScrollContent}>
                                {model.daily.map(point => {
                                    const barHeight = point.totalTokens > 0 && maxToken > 0
                                        ? Math.max(6, Math.round((point.totalTokens / maxToken) * 100))
                                        : 0;
                                    return (
                                        <View key={`${model.configId}-${point.date}`} style={styles.usageBarColumn}>
                                            <ThemedText type="caption" style={styles.usageBarValue}>
                                                {formatTokenValue(point.totalTokens)}
                                            </ThemedText>
                                            <View style={styles.usageBarTrack}>
                                                {barHeight > 0 ? <View style={[styles.usageBarFill, { height: `${barHeight}%` }]} /> : null}
                                            </View>
                                            <ThemedText type="caption" style={styles.usageBarDate}>
                                                {formatDayLabel(point.date)}
                                            </ThemedText>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        <View style={styles.usageChartTip}>
                            <ThemedText type="caption" style={styles.usageChartTipText}>
                                每列显示当日 Token 使用量与日期
                            </ThemedText>
                        </View>
                    </Card>
                );
            })}

            {usageNote ? <ThemedText type="caption" style={styles.usageNote}>{usageNote}</ThemedText> : null}
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Button variant="ghost" title="返回" onPress={() => router.back()} size="sm" />
                    <ThemedText type="subtitle">模型概览</ThemedText>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={Colors.light.primary} /></View>
            ) : (
                <FlatList
                    data={visibleConfigs}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <ThemedText>暂无可用模型，请等待系统管理员配置。</ThemedText>
                        </View>
                    }
                    ListFooterComponent={renderUsageSection}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    listContent: { padding: Spacing.md },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { padding: Spacing.xl, alignItems: 'center' },
    card: { marginBottom: Spacing.md, padding: 0, overflow: 'hidden' },
    activeCard: { borderColor: Colors.light.primary, borderWidth: 2 },
    cardContent: { flexDirection: 'row', padding: Spacing.md },
    cardInfo: { flex: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    activeBadge: {
        backgroundColor: Colors.light.primary,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8
    },
    activeText: { color: '#fff', fontSize: 10 },
    cardDetail: { color: Colors.light.textSecondary, marginTop: 2 },
    usageSection: {
        marginTop: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        paddingTop: Spacing.lg,
        gap: Spacing.sm,
    },
    usageHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    usageHeaderTextWrap: {
        flex: 1,
    },
    usageHeaderSubtext: {
        marginTop: 2,
        color: Colors.light.textSecondary,
    },
    usageRefreshButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.light.surface,
    },
    usageRefreshText: {
        color: Colors.light.primary,
    },
    usageDaysRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    usageDaysButton: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.light.surface,
    },
    usageDaysButtonActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    usageDaysButtonText: {
        color: Colors.light.textSecondary,
    },
    usageDaysButtonTextActive: {
        color: '#fff',
    },
    usageErrorCard: {
        marginVertical: 0,
    },
    usageErrorText: {
        color: Colors.light.error,
    },
    usageLoading: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    usageEmpty: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        backgroundColor: Colors.light.surface,
    },
    usageModelCard: {
        marginBottom: Spacing.sm,
        marginVertical: 0,
        backgroundColor: Colors.light.surface,
    },
    usageModelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    usageModelNameWrap: {
        flex: 1,
    },
    usageModelNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    usageModelStats: {
        alignItems: 'flex-end',
    },
    usageChart: {
        height: 132,
    },
    usageChartScrollContent: {
        alignItems: 'flex-end',
        paddingBottom: Spacing.xs,
    },
    usageBarColumn: {
        width: 42,
        alignItems: 'center',
        marginRight: Spacing.xs,
    },
    usageBarValue: {
        color: Colors.light.textSecondary,
        fontSize: 10,
        marginBottom: 4,
    },
    usageBarTrack: {
        width: 22,
        height: 80,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.light.surfaceHighlight,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    usageBarFill: {
        width: '100%',
        backgroundColor: Colors.light.primary,
        borderRadius: BorderRadius.sm,
    },
    usageBarDate: {
        marginTop: 4,
        color: Colors.light.textSecondary,
        fontSize: 10,
    },
    usageChartTip: {
        marginTop: Spacing.xs,
    },
    usageChartTipText: {
        color: Colors.light.textSecondary,
    },
    usageNote: {
        marginTop: Spacing.xs,
        color: Colors.light.textSecondary,
    },
});
