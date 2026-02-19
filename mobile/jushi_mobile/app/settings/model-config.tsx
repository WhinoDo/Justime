import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert, ActivityIndicator, FlatList, TouchableOpacity, Modal, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
    const [modalVisible, setModalVisible] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Partial<LLMConfigItem> | null>(null);

    // Form State
    const [formName, setFormName] = useState('');
    const [formApiKey, setFormApiKey] = useState('');
    const [formModelId, setFormModelId] = useState('gpt-3.5-turbo');
    const [formUrl, setFormUrl] = useState('');
    const [formTemperature, setFormTemperature] = useState('0.7');
    const [saving, setSaving] = useState(false);
    const [usageLoading, setUsageLoading] = useState(false);
    const [usageError, setUsageError] = useState<string | null>(null);
    const [usageModels, setUsageModels] = useState<ModelUsageItem[]>([]);
    const [usageDays, setUsageDays] = useState(14);
    const [usageNote, setUsageNote] = useState('');
    const [usageScope, setUsageScope] = useState<'primary' | 'all'>('primary');

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

    const openModal = (config?: LLMConfigItem) => {
        if (config) {
            setEditingConfig(config);
            setFormName(config.name);
            setFormApiKey(config.apiKey || '');
            setFormModelId(config.modelId || '');
            setFormUrl(config.baseUrl || '');
            setFormTemperature(config.temperature?.toString() || '0.7');
        } else {
            setEditingConfig(null);
            setFormName('');
            setFormApiKey('');
            setFormModelId('gpt-3.5-turbo');
            setFormUrl('');
            setFormTemperature('0.7');
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!token) return;
        setSaving(true);
        try {
            const payload = {
                name: formName || (editingConfig ? editingConfig.name : '新配置'),
                modelId: formModelId,
                baseUrl: formUrl,
                apiKey: formApiKey,
                temperature: parseFloat(formTemperature) || 0.7
            };

            let url = `${baseUrl}/api/v1/auth/llm-configs`;
            let method = 'POST';

            if (editingConfig && editingConfig.id) {
                url += `/${editingConfig.id}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                setModalVisible(false);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                fetchConfigs();
                fetchUsage();
                Alert.alert('成功', '保存成功');
            } else {
                Alert.alert('保存失败', result.message || '未知错误');
            }
        } catch {
            Alert.alert('保存失败', '网络请求错误');
        } finally {
            setSaving(false);
        }
    };

    const handleSetActive = async (id: string, currentActive: boolean) => {
        if (currentActive) return;
        try {
            const response = await fetch(`${baseUrl}/api/v1/auth/llm-configs/${id}/active`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                fetchConfigs();
                fetchUsage();
            }
        } catch {
            Alert.alert('设置失败', '网络错误');
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert('确认删除', '确定要删除这个配置吗？', [
            { text: '取消', style: 'cancel' },
            {
                text: '删除', style: 'destructive', onPress: async () => {
                    try {
                        const response = await fetch(`${baseUrl}/api/v1/auth/llm-configs/${id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const result = await response.json();
                        if (result.success) {
                            fetchConfigs();
                            fetchUsage();
                        } else {
                            Alert.alert('删除失败', result.message);
                        }
                    } catch {
                        Alert.alert('删除失败', '网络错误');
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }: { item: LLMConfigItem }) => (
        <Card variant={item.isActive ? 'elevated' : 'outlined'} style={[styles.card, item.isActive && styles.activeCard]}>
            <TouchableOpacity onPress={() => handleSetActive(item.id, item.isActive)} style={styles.cardContent}>
                <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        {item.isActive && <View style={styles.activeBadge}><ThemedText type="label" style={styles.activeText}>当前使用</ThemedText></View>}
                    </View>
                    <ThemedText type="caption" style={styles.cardDetail}>{item.modelId}</ThemedText>
                    <ThemedText type="caption" style={styles.cardDetail} numberOfLines={1}>{item.baseUrl || '默认 URL'}</ThemedText>
                </View>
                <View style={styles.cardActions}>
                    <Button variant="ghost" title="" icon={<IconSymbol name="pencil" size={20} color={Colors.light.primary} />} onPress={() => openModal(item)} />
                    <Button variant="ghost" title="" icon={<IconSymbol name="trash" size={20} color={Colors.light.error} />} onPress={() => handleDelete(item.id)} />
                </View>
            </TouchableOpacity>
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

            {!usageLoading && !usageError && usageModels.length === 0 && (
                <View style={styles.usageEmpty}>
                    <ThemedText type="caption">暂无模型使用数据，发送聊天消息后会开始累计。</ThemedText>
                </View>
            )}

            {usageModels.map(model => {
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
                <Button variant="ghost" title="返回" onPress={() => router.back()} size="sm" />
                <ThemedText type="subtitle">模型配置</ThemedText>
                <Button variant="ghost" title="" icon={<IconSymbol name="plus" size={24} color={Colors.light.primary} />} onPress={() => openModal()} />
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={Colors.light.primary} /></View>
            ) : (
                <FlatList
                    data={configs}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<View style={styles.empty}><ThemedText>暂无配置，请点击右上角添加</ThemedText></View>}
                    ListFooterComponent={renderUsageSection}
                />
            )}

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                    <View style={styles.modalHeader}>
                        <Button variant="ghost" title="取消" onPress={() => setModalVisible(false)} />
                        <ThemedText type="subtitle">{editingConfig ? '编辑配置' : '新建配置'}</ThemedText>
                        <Button variant="ghost" title="保存" onPress={handleSave} loading={saving} disabled={saving} />
                    </View>
                    <ScrollView contentContainerStyle={styles.formContent}>
                        <Input label="配置名称" value={formName} onChangeText={setFormName} placeholder="例如：我的GPT-4" containerStyle={styles.input} />
                        <Input label="模型ID" value={formModelId} onChangeText={setFormModelId} placeholder="gpt-4" containerStyle={styles.input} />
                        <Input label="API Key" value={formApiKey} onChangeText={setFormApiKey} secureTextEntry placeholder="sk-..." containerStyle={styles.input} />
                        <Input label="Base URL (可选)" value={formUrl} onChangeText={setFormUrl} placeholder="https://api.openai.com/v1" containerStyle={styles.input} />
                        <Input label="Temperature" value={formTemperature} onChangeText={setFormTemperature} keyboardType="numeric" placeholder="0.7" containerStyle={styles.input} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
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
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border
    },
    formContent: { padding: Spacing.lg },
    input: { marginBottom: Spacing.md },
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
