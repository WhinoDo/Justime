import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type AddTaskResult = {
    success: boolean;
    start?: string;
    end?: string;
};

export type TaskSchedulePreview = {
    start: string;
    end: string;
};

export type TaskItem = {
    title: string;
    duration_hours: number;
    description?: string;
    order?: number;
    resources?: {
        title?: string;
        url?: string;
        type?: string;
    }[];
};

export type TaskDecomposition = {
    project?: {
        name?: string;
        description?: string;
        total_days?: number;
        start_date?: string;
        subtask_count?: number;
    };
    project_name?: string;
    start_date?: string;
    total_days?: number;
    subtasks: TaskItem[];
    message?: string;
};

interface TaskDecompositionViewProps {
    decomposition: TaskDecomposition;
    onCancel: () => void;
    onAddTask: (task: TaskItem, index: number) => Promise<AddTaskResult>;
    taskSchedules?: TaskSchedulePreview[];
    loading?: boolean;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export function TaskDecompositionView({ decomposition, onCancel, onAddTask, taskSchedules = [], loading }: TaskDecompositionViewProps) {
    const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
    const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
    const [addedTasks, setAddedTasks] = useState<Set<number>>(new Set());
    const [addingTaskIndex, setAddingTaskIndex] = useState<number | null>(null);
    const [batchAdding, setBatchAdding] = useState(false);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const projectName = decomposition.project_name || decomposition.project?.name || '任务规划';

    const pendingIndexes = useMemo(
        () => decomposition.subtasks.map((_, idx) => idx).filter((idx) => !addedTasks.has(idx)),
        [decomposition.subtasks, addedTasks]
    );
    const selectedPendingCount = pendingIndexes.filter((idx) => selectedTasks.has(idx)).length;
    const allPendingSelected = pendingIndexes.length > 0 && selectedPendingCount === pendingIndexes.length;

    const toggleSelectTask = (index: number) => {
        if (addedTasks.has(index) || batchAdding || loading) {
            return;
        }
        setSelectedTasks((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const toggleTaskDetail = (index: number) => {
        setExpandedTasks((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (batchAdding || loading || pendingIndexes.length === 0) {
            return;
        }
        setSelectedTasks((prev) => {
            const next = new Set(prev);
            if (allPendingSelected) {
                pendingIndexes.forEach((idx) => next.delete(idx));
            } else {
                pendingIndexes.forEach((idx) => next.add(idx));
            }
            return next;
        });
    };

    const addTasksByIndexes = async (indexes: number[]) => {
        const targetIndexes = indexes
            .filter((index) => !addedTasks.has(index))
            .filter((index) => !!decomposition.subtasks[index]);

        if (targetIndexes.length === 0) {
            return;
        }

        setBatchAdding(true);
        setResultMessage(null);

        const nextAdded = new Set(addedTasks);
        const succeededIndexes: number[] = [];
        let successCount = 0;
        let failedCount = 0;

        try {
            for (const index of targetIndexes) {
                setAddingTaskIndex(index);
                const task = decomposition.subtasks[index];
                const result = await onAddTask(task, index);
                if (result.success) {
                    successCount += 1;
                    succeededIndexes.push(index);
                    nextAdded.add(index);

                } else {
                    failedCount += 1;
                }
            }
        } finally {
            setAddingTaskIndex(null);
            setBatchAdding(false);
        }

        setAddedTasks(nextAdded);
        setSelectedTasks((prev) => {
            const next = new Set(prev);
            succeededIndexes.forEach((idx) => next.delete(idx));
            return next;
        });

        if (successCount === 0) {
            setResultMessage('未成功添加，请重试');
            return;
        }

        if (failedCount > 0) {
            setResultMessage(`已添加 ${successCount} 个，失败 ${failedCount} 个`);
            return;
        }

        if (nextAdded.size >= decomposition.subtasks.length) {
            setResultMessage('所有日程均已添加到日历');
            return;
        }

        setResultMessage(`已成功添加 ${successCount} 个日程`);
    };

    const handleAddSelected = async () => {
        const indexes = pendingIndexes.filter((idx) => selectedTasks.has(idx));
        await addTasksByIndexes(indexes);
    };

    const handleSelectAllAndAdd = async () => {
        if (pendingIndexes.length === 0) {
            return;
        }
        setSelectedTasks((prev) => {
            const next = new Set(prev);
            pendingIndexes.forEach((idx) => next.add(idx));
            return next;
        });
        await addTasksByIndexes(pendingIndexes);
    };

    const isBusy = !!loading || batchAdding;


    return (
        <Card variant="outlined" style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <IconSymbol name="list.bullet" size={20} color={Colors.light.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">任务分解建议</ThemedText>
                    <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                        项目: {projectName}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.toolbar}>
                <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                    已勾选 {selectedPendingCount} 项，待添加 {pendingIndexes.length} 项
                </ThemedText>
                <View style={styles.toolbarActions}>
                    <Button
                        title={allPendingSelected ? '取消全选' : '全选'}
                        variant="secondary"
                        size="sm"
                        onPress={toggleSelectAll}
                        disabled={isBusy || pendingIndexes.length === 0}
                        style={styles.toolbarButton}
                    />
                    <Button
                        title="全选添加"
                        variant="primary"
                        size="sm"
                        onPress={() => {
                            void handleSelectAllAndAdd();
                        }}
                        disabled={isBusy || pendingIndexes.length === 0}
                        style={styles.toolbarButton}
                    />
                </View>
            </View>

            <View style={styles.taskList}>
                {pendingIndexes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                            所有任务已添加完成
                        </ThemedText>
                    </View>
                ) : null}
                {pendingIndexes.map((index) => {
                    const task = decomposition.subtasks[index];
                    return (
                    <View key={index} style={styles.taskItem}>
                        <View style={styles.taskRow}>
                            <TouchableOpacity
                                onPress={() => toggleSelectTask(index)}
                                disabled={addedTasks.has(index) || isBusy}
                                style={[
                                    styles.checkbox,
                                    selectedTasks.has(index) && styles.checkboxSelected,
                                    addedTasks.has(index) && styles.checkboxAdded,
                                ]}
                            >
                                {(selectedTasks.has(index) || addedTasks.has(index)) ? (
                                    <IconSymbol name="checkmark" size={14} color="#FFF" />
                                ) : null}
                            </TouchableOpacity>

                            <View style={styles.taskBullet}>
                                <ThemedText type="caption" style={{ color: '#FFF', fontSize: 10 }}>{index + 1}</ThemedText>
                            </View>

                            <View style={styles.taskMain}>
                                <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>{task.title}</ThemedText>
                                <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                                    预计耗时: {task.duration_hours} 小时
                                </ThemedText>
                            </View>

                            <TouchableOpacity
                                onPress={() => toggleTaskDetail(index)}
                                style={styles.detailToggle}
                            >
                                {addingTaskIndex === index ? (
                                    <ActivityIndicator size="small" color={Colors.light.primary} />
                                ) : (
                                    <>
                                        <ThemedText type="caption" style={styles.detailToggleText}>
                                            {expandedTasks.has(index) ? '收起详情' : '查看详情'}
                                        </ThemedText>
                                        <IconSymbol
                                            name={expandedTasks.has(index) ? 'chevron.down' : 'chevron.right'}
                                            size={16}
                                            color={Colors.light.textSecondary}
                                        />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {expandedTasks.has(index) ? (
                            <View style={styles.detailPanel}>
                                {taskSchedules[index] ? (
                                    <ThemedText type="caption" style={styles.detailText}>
                                        计划时间：{formatDateTime(taskSchedules[index].start)} - {formatDateTime(taskSchedules[index].end)}
                                    </ThemedText>
                                ) : null}
                                <ThemedText type="caption" style={styles.detailText}>
                                    任务说明：{task.description || '暂无详细说明'}
                                </ThemedText>
                                {task.resources && task.resources.length > 0 ? (
                                    <View style={styles.resourceList}>
                                        {task.resources.map((resource, resourceIndex) => (
                                            <ThemedText key={`${index}-resource-${resourceIndex}`} type="caption" style={styles.resourceText}>
                                                • {resource.title || '相关资源'} {resource.url ? `(${resource.url})` : ''}
                                            </ThemedText>
                                        ))}
                                    </View>
                                ) : (
                                    <ThemedText type="caption" style={styles.detailText}>
                                        相关资源：暂无
                                    </ThemedText>
                                )}
                            </View>
                        ) : null}
                    </View>
                    );
                })}
            </View>

            {resultMessage ? (
                <ThemedText type="caption" style={styles.resultMessage}>
                    {resultMessage}
                </ThemedText>
            ) : null}

            <View style={styles.actions}>
                <Button
                    title="关闭"
                    variant="ghost"
                    onPress={onCancel}
                    size="sm"
                    style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                    title={`添加勾选 (${selectedPendingCount})`}
                    variant="primary"
                    onPress={() => {
                        void handleAddSelected();
                    }}
                    loading={isBusy}
                    disabled={isBusy || selectedPendingCount === 0}
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
    toolbar: {
        marginBottom: Spacing.sm,
    },
    toolbarActions: {
        flexDirection: 'row',
        marginTop: Spacing.xs,
    },
    toolbarButton: {
        marginRight: Spacing.xs,
    },
    taskList: {
        marginBottom: Spacing.md,
    },
    emptyState: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: 8,
        backgroundColor: Colors.light.background,
        marginBottom: Spacing.sm,
    },
    taskItem: {
        marginBottom: Spacing.sm,
        backgroundColor: Colors.light.background,
        padding: Spacing.sm,
        borderRadius: 8,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.xs,
    },
    checkboxSelected: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    checkboxAdded: {
        backgroundColor: Colors.light.success,
        borderColor: Colors.light.success,
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
    taskMain: {
        flex: 1,
        marginRight: Spacing.sm,
    },
    detailToggle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailToggleText: {
        color: Colors.light.textSecondary,
        marginRight: 2,
    },
    detailPanel: {
        marginTop: Spacing.sm,
        marginLeft: 54,
        padding: Spacing.sm,
        borderRadius: 8,
        backgroundColor: Colors.light.surface,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    detailText: {
        color: Colors.light.textSecondary,
        marginBottom: 4,
    },
    resourceList: {
        marginTop: 2,
    },
    resourceText: {
        color: Colors.light.textSecondary,
        marginBottom: 2,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    resultMessage: {
        marginBottom: Spacing.sm,
        color: Colors.light.success,
    }
});
