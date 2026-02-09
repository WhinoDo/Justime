import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type TaskItem = {
    title: string;
    duration_hours: number;
    description?: string;
    order?: number;
};

export type TaskDecomposition = {
    project_name: string;
    start_date?: string;
    total_days?: number;
    subtasks: TaskItem[];
    message?: string;
};

interface TaskDecompositionViewProps {
    decomposition: TaskDecomposition;
    onConfirm: () => void;
    onCancel: () => void;
    onAddTask: (task: TaskItem, index: number) => Promise<boolean>;
    loading?: boolean;
}

export function TaskDecompositionView({ decomposition, onConfirm, onCancel, onAddTask, loading }: TaskDecompositionViewProps) {
    const [addedTasks, setAddedTasks] = useState<Set<number>>(new Set());
    const [addingTaskIndex, setAddingTaskIndex] = useState<number | null>(null);

    const handleAddTask = async (task: TaskItem, index: number) => {
        if (addedTasks.has(index)) return;

        setAddingTaskIndex(index);
        const success = await onAddTask(task, index);
        if (success) {
            setAddedTasks(prev => new Set(prev).add(index));
        }
        setAddingTaskIndex(null);
    };

    return (
        <Card variant="outlined" style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <IconSymbol name="list.bullet" size={20} color={Colors.light.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">任务分解建议</ThemedText>
                    <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                        项目: {decomposition.project_name}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.taskList}>
                {decomposition.subtasks.map((task, index) => (
                    <View key={index} style={styles.taskItem}>
                        <View style={styles.taskBullet}>
                            <ThemedText type="caption" style={{ color: '#FFF', fontSize: 10 }}>{index + 1}</ThemedText>
                        </View>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>{task.title}</ThemedText>
                            <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                                预计耗时: {task.duration_hours} 小时
                            </ThemedText>
                        </View>
                        <TouchableOpacity
                            onPress={() => handleAddTask(task, index)}
                            disabled={addedTasks.has(index) || addingTaskIndex === index}
                            style={[
                                styles.addButton,
                                addedTasks.has(index) && styles.addedButton
                            ]}
                        >
                            {addingTaskIndex === index ? (
                                <ActivityIndicator size="small" color={Colors.light.primary} />
                            ) : (
                                <IconSymbol
                                    name={addedTasks.has(index) ? "checkmark" : "plus"}
                                    size={16}
                                    color={addedTasks.has(index) ? Colors.light.success : Colors.light.primary}
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            <View style={styles.actions}>
                <Button
                    title="关闭"
                    variant="ghost"
                    onPress={onCancel}
                    size="sm"
                    style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                    title="全部添加"
                    variant="primary"
                    onPress={onConfirm}
                    loading={loading}
                    size="sm"
                    style={{ flex: 1, marginLeft: Spacing.sm }}
                    icon={<IconSymbol name="calendar" size={16} color="#FFF" />}
                />
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.light.surfaceHighlight,
        borderWidth: 1,
        borderColor: Colors.light.primary + '30',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    taskList: {
        marginBottom: Spacing.md,
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        backgroundColor: Colors.light.background,
        padding: Spacing.sm,
        borderRadius: 8,
    },
    taskBullet: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    addedButton: {
        backgroundColor: Colors.light.success + '10', // 10% opacity success color
        borderColor: Colors.light.success,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    }
});
