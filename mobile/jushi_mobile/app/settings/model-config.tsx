import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, Alert, ActivityIndicator, FlatList, TouchableOpacity, Modal, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
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
        } catch (e) {
            Alert.alert('加载配置失败', '请检查网络连接');
        } finally {
            setLoading(false);
        }
    }, [token, baseUrl]);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

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
                Alert.alert('成功', '保存成功');
            } else {
                Alert.alert('保存失败', result.message || '未知错误');
            }
        } catch (e) {
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
            }
        } catch (e) {
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
                        } else {
                            Alert.alert('删除失败', result.message);
                        }
                    } catch (e) {
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
    input: { marginBottom: Spacing.md }
});
