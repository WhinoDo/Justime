import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type EventResource = {
  title?: string;
  url?: string;
  type?: string;
};

export type ScheduleEventDetail = {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  type?: string;
  priority?: string;
  status?: string;
  allDay?: boolean;
  aiGenerated?: boolean;
  resources?: EventResource[];
};

export type ScheduleEventUpdatePayload = {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  type: string;
  priority: string;
  status: string;
  allDay: boolean;
  resources: EventResource[];
};

interface EventDetailSheetProps {
  visible: boolean;
  event: ScheduleEventDetail | null;
  deleting?: boolean;
  saving?: boolean;
  onClose: () => void;
  onDelete?: (eventId: string) => Promise<void>;
  onSave?: (eventId: string, payload: ScheduleEventUpdatePayload) => Promise<void>;
}

const TYPE_LABEL: Record<string, string> = {
  task: '任务',
  meeting: '会议',
  reminder: '提醒',
  deadline: '截止',
  other: '其他',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
};

const TYPE_OPTIONS = [
  { value: 'task', label: '任务' },
  { value: 'meeting', label: '会议' },
  { value: 'reminder', label: '提醒' },
  { value: 'deadline', label: '截止' },
  { value: 'other', label: '其他' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

type EditableDraft = {
  title: string;
  description: string;
  startInput: string;
  endInput: string;
  location: string;
  type: string;
  priority: string;
  status: string;
  allDay: boolean;
  resources: EventResource[];
};

type DateTimePickerTarget = 'start' | 'end' | null;

type DateTimePickerState = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const getDurationLabel = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const totalMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
};

const formatDateTimeInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'yyyy-MM-dd HH:mm');
};

const formatDateTimeFromParts = (parts: DateTimePickerState) =>
  `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const toPickerState = (date: Date): DateTimePickerState => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
  hour: date.getHours(),
  minute: date.getMinutes(),
});

const clampPickerStateDay = (state: DateTimePickerState): DateTimePickerState => {
  const maxDays = getDaysInMonth(state.year, state.month);
  if (state.day <= maxDays) return state;
  return {
    ...state,
    day: maxDays,
  };
};

const parseDateTimeInput = (value: string): Date | null => {
  const normalized = value.trim().replace('T', ' ');
  if (!normalized) return null;

  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct;

  const fallback = new Date(normalized.replace(' ', 'T'));
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return null;
};

export function EventDetailSheet({
  visible,
  event,
  deleting = false,
  saving = false,
  onClose,
  onDelete,
  onSave,
}: EventDetailSheetProps) {
  const surfaceColor = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const secondaryTextColor = useThemeColor({}, 'textSecondary');
  const [editing, setEditing] = useState(false);
  const [activeDateTimeTarget, setActiveDateTimeTarget] = useState<DateTimePickerTarget>(null);
  const [pickerState, setPickerState] = useState<DateTimePickerState>(toPickerState(new Date()));
  const [hourInput, setHourInput] = useState('00');
  const [minuteInput, setMinuteInput] = useState('00');
  const [draft, setDraft] = useState<EditableDraft>({
    title: '',
    description: '',
    startInput: '',
    endInput: '',
    location: '',
    type: 'other',
    priority: 'medium',
    status: 'pending',
    allDay: false,
    resources: [],
  });

  useEffect(() => {
    if (!event || !visible) return;
    setEditing(false);
    setDraft({
      title: event.title || '',
      description: event.description || '',
      startInput: formatDateTimeInput(event.start),
      endInput: formatDateTimeInput(event.end),
      location: event.location || '',
      type: event.type || 'other',
      priority: event.priority || 'medium',
      status: event.status || 'pending',
      allDay: !!event.allDay,
      resources: (event.resources || []).map((resource) => ({
        title: resource.title || '',
        url: resource.url || '',
        type: resource.type,
      })),
    });
  }, [event, visible]);

  const safeType = TYPE_LABEL[event?.type || 'other'] || '其他';
  const safePriority = PRIORITY_LABEL[event?.priority || 'medium'] || '中';
  const safeStatus = STATUS_LABEL[event?.status || 'pending'] || '待处理';
  const eventResources = event?.resources || [];

  const handleDelete = () => {
    if (!event || !onDelete) return;

    Alert.alert('删除日程', `确认删除「${event.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void onDelete(event.id);
        },
      },
    ]);
  };

  const openDateTimePicker = (target: Exclude<DateTimePickerTarget, null>) => {
    const currentValue = target === 'start' ? draft.startInput : draft.endInput;
    const parsed = parseDateTimeInput(currentValue) || new Date();
    setPickerState(toPickerState(parsed));
    setHourInput(String(parsed.getHours()).padStart(2, '0'));
    setMinuteInput(String(parsed.getMinutes()).padStart(2, '0'));
    setActiveDateTimeTarget(target);
  };

  const closeDateTimePicker = () => {
    setActiveDateTimeTarget(null);
  };

  const parsedHourInput = Number.parseInt(hourInput, 10);
  const parsedMinuteInput = Number.parseInt(minuteInput, 10);
  const isHourValid =
    hourInput.trim().length > 0 &&
    Number.isInteger(parsedHourInput) &&
    parsedHourInput >= 0 &&
    parsedHourInput <= 23;
  const isMinuteValid =
    minuteInput.trim().length > 0 &&
    Number.isInteger(parsedMinuteInput) &&
    parsedMinuteInput >= 0 &&
    parsedMinuteInput <= 59;
  const canApplyDateTime = isHourValid && isMinuteValid;

  const applyDateTimePicker = () => {
    if (!canApplyDateTime) return;

    const nextPickerState = clampPickerStateDay({
      ...pickerState,
      hour: parsedHourInput,
      minute: parsedMinuteInput,
    });
    const formatted = formatDateTimeFromParts(nextPickerState);
    if (activeDateTimeTarget === 'start') {
      setDraft((prev) => ({ ...prev, startInput: formatted }));
    } else if (activeDateTimeTarget === 'end') {
      setDraft((prev) => ({ ...prev, endInput: formatted }));
    }
    closeDateTimePicker();
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 11 }, (_, index) => currentYear - 3 + index),
    [currentYear]
  );
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const dayOptions = useMemo(
    () => Array.from({ length: getDaysInMonth(pickerState.year, pickerState.month) }, (_, index) => index + 1),
    [pickerState.month, pickerState.year]
  );

  const updatePickerState = (key: keyof DateTimePickerState, value: number) => {
    setPickerState((prev) => clampPickerStateDay({ ...prev, [key]: value }));
  };

  const addResource = () => {
    setDraft((prev) => ({
      ...prev,
      resources: [...prev.resources, { title: '', url: '' }],
    }));
  };

  const updateResourceField = (index: number, field: 'title' | 'url', value: string) => {
    setDraft((prev) => ({
      ...prev,
      resources: prev.resources.map((resource, resourceIndex) =>
        resourceIndex === index ? { ...resource, [field]: value } : resource
      ),
    }));
  };

  const removeResource = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      resources: prev.resources.filter((_, resourceIndex) => resourceIndex !== index),
    }));
  };

  const handleSave = async () => {
    if (!event || !onSave) return;

    if (!draft.title.trim()) {
      Alert.alert('提示', '标题不能为空');
      return;
    }
    if (!draft.startInput.trim()) {
      Alert.alert('提示', '请选择开始时间');
      return;
    }
    if (!draft.endInput.trim()) {
      Alert.alert('提示', '请选择结束时间');
      return;
    }

    const startDate = parseDateTimeInput(draft.startInput);
    if (!startDate) {
      Alert.alert('提示', '开始时间格式无效，请使用 yyyy-MM-dd HH:mm');
      return;
    }

    const endDate = parseDateTimeInput(draft.endInput);
    if (!endDate) {
      Alert.alert('提示', '结束时间格式无效，请使用 yyyy-MM-dd HH:mm');
      return;
    }

    if (startDate.getTime() >= endDate.getTime()) {
      Alert.alert('提示', '结束时间必须晚于开始时间');
      return;
    }

    const normalizedResources = draft.resources
      .map((resource) => ({
        title: (resource.title || '').trim(),
        url: (resource.url || '').trim(),
        type: resource.type,
      }))
      .filter((resource) => resource.title || resource.url);

    const invalidResource = normalizedResources.find((resource) => !resource.url);
    if (invalidResource) {
      Alert.alert('提示', '资源链接不能为空');
      return;
    }

    const resourcesPayload = normalizedResources.map((resource, index) => ({
      title: resource.title || `资源 ${index + 1}`,
      url: resource.url,
      type: resource.type,
    }));

    try {
      await onSave(event.id, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        location: draft.location.trim(),
        type: draft.type,
        priority: draft.priority,
        status: draft.status,
        allDay: draft.allDay,
        resources: resourcesPayload,
      });
      setEditing(false);
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const openResource = async (url?: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('无法打开链接', '该链接在当前设备上不可用');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('打开失败', error instanceof Error ? error.message : '无法打开链接');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: surfaceColor, borderColor }]}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <ThemedText type="subtitle" numberOfLines={2}>
                {editing ? '编辑日程' : (event?.title || '日程详情')}
              </ThemedText>
            </View>
            {!editing && event ? (
              <Button
                title=""
                variant="ghost"
                icon={<MaterialIcons name="edit" size={19} color={Colors.light.primary} />}
                style={styles.headerActionButton}
                onPress={() => setEditing(true)}
              />
            ) : null}
            <Button
              title=""
              variant="ghost"
              icon={<MaterialIcons name="close" size={20} color={Colors.light.textSecondary} />}
              style={styles.closeButton}
              onPress={onClose}
            />
          </View>

          {event ? (
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              {editing ? (
                <Card variant="outlined" style={styles.sectionCard}>
                  <Input
                    label="标题"
                    value={draft.title}
                    onChangeText={(value) => setDraft((prev) => ({ ...prev, title: value }))}
                    placeholder="请输入标题"
                  />
                  <View style={styles.dateTimeRow}>
                    <View style={styles.dateTimeInput}>
                      <ThemedText type="label" style={styles.dropdownLabel}>开始时间</ThemedText>
                      <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDateTimePicker('start')}
                      >
                        <ThemedText>{draft.startInput || '选择开始时间'}</ThemedText>
                        <MaterialIcons name="arrow-drop-down" size={20} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dateTimeInput}>
                      <ThemedText type="label" style={styles.dropdownLabel}>结束时间</ThemedText>
                      <TouchableOpacity
                        style={styles.dropdownField}
                        onPress={() => openDateTimePicker('end')}
                      >
                        <ThemedText>{draft.endInput || '选择结束时间'}</ThemedText>
                        <MaterialIcons name="arrow-drop-down" size={20} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <ThemedText type="caption" style={{ marginBottom: Spacing.sm }}>
                    使用下拉面板选择日期和时间
                  </ThemedText>

                  <View style={styles.row}>
                    <MaterialIcons
                      name={draft.allDay ? 'check-box' : 'check-box-outline-blank'}
                      size={18}
                      color={Colors.light.primary}
                    />
                    <TouchableOpacity
                      onPress={() => setDraft((prev) => ({ ...prev, allDay: !prev.allDay }))}
                    >
                      <ThemedText style={{ marginLeft: Spacing.sm }}>全天事件</ThemedText>
                    </TouchableOpacity>
                  </View>

                  <Input
                    label="地点"
                    value={draft.location}
                    onChangeText={(value) => setDraft((prev) => ({ ...prev, location: value }))}
                    placeholder="可选"
                  />
                  <Input
                    label="描述"
                    value={draft.description}
                    onChangeText={(value) => setDraft((prev) => ({ ...prev, description: value }))}
                    placeholder="可选"
                    multiline
                    style={styles.descriptionInput}
                  />

                  <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                    相关资源
                  </ThemedText>
                  <View style={styles.resourceHeaderRow}>
                    <ThemedText type="caption" style={styles.resourceHintText}>
                      可添加学习资料、文档链接等
                    </ThemedText>
                    <Button
                      title="添加资源"
                      size="sm"
                      variant="secondary"
                      onPress={addResource}
                      style={styles.resourceAddButton}
                    />
                  </View>
                  {draft.resources.length > 0 ? (
                    draft.resources.map((resource, index) => (
                      <View key={`resource-edit-${index}`} style={styles.resourceEditItem}>
                        <Input
                          label={`资源 ${index + 1} 标题`}
                          value={resource.title || ''}
                          onChangeText={(value) => updateResourceField(index, 'title', value)}
                          placeholder="可选，默认自动命名"
                          containerStyle={styles.resourceEditInput}
                        />
                        <Input
                          label={`资源 ${index + 1} 链接`}
                          value={resource.url || ''}
                          onChangeText={(value) => updateResourceField(index, 'url', value)}
                          placeholder="https://..."
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                          containerStyle={styles.resourceEditInput}
                        />
                        <Button
                          title=""
                          variant="ghost"
                          icon={<MaterialIcons name="delete-outline" size={20} color={Colors.light.error} />}
                          onPress={() => removeResource(index)}
                          style={styles.resourceDeleteButton}
                        />
                      </View>
                    ))
                  ) : (
                    <ThemedText type="caption" style={styles.resourceEmptyText}>
                      暂无资源，点击右侧按钮添加
                    </ThemedText>
                  )}

                  <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                    类型
                  </ThemedText>
                  <View style={styles.optionRow}>
                    {TYPE_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionChip,
                          draft.type === option.value && styles.optionChipActive,
                        ]}
                        onPress={() => setDraft((prev) => ({ ...prev, type: option.value }))}
                      >
                        <ThemedText
                          type="caption"
                          style={draft.type === option.value ? styles.optionTextActive : styles.optionText}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                    优先级
                  </ThemedText>
                  <View style={styles.optionRow}>
                    {PRIORITY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionChip,
                          draft.priority === option.value && styles.optionChipActive,
                        ]}
                        onPress={() => setDraft((prev) => ({ ...prev, priority: option.value }))}
                      >
                        <ThemedText
                          type="caption"
                          style={draft.priority === option.value ? styles.optionTextActive : styles.optionText}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                    状态
                  </ThemedText>
                  <View style={styles.optionRow}>
                    {STATUS_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionChip,
                          draft.status === option.value && styles.optionChipActive,
                        ]}
                        onPress={() => setDraft((prev) => ({ ...prev, status: option.value }))}
                      >
                        <ThemedText
                          type="caption"
                          style={draft.status === option.value ? styles.optionTextActive : styles.optionText}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Card>
              ) : (
                <>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, styles.typeBadge]}>
                      <ThemedText type="caption" style={styles.badgeText}>
                        {safeType}
                      </ThemedText>
                    </View>
                    <View style={[styles.badge, styles.priorityBadge]}>
                      <ThemedText type="caption" style={styles.badgeText}>
                        优先级: {safePriority}
                      </ThemedText>
                    </View>
                    <View style={[styles.badge, styles.statusBadge]}>
                      <ThemedText type="caption" style={styles.badgeText}>
                        {safeStatus}
                      </ThemedText>
                    </View>
                  </View>

                  <Card variant="outlined" style={styles.sectionCard}>
                    <View style={styles.row}>
                      <MaterialIcons name="event" size={16} color={Colors.light.primary} />
                      <ThemedText style={styles.rowValue}>
                        {format(new Date(event.start), 'yyyy年M月d日 EEEE', { locale: zhCN })}
                      </ThemedText>
                    </View>
                    <View style={styles.row}>
                      <MaterialIcons name="schedule" size={16} color={Colors.light.primary} />
                      <ThemedText style={styles.rowValue}>
                        {event.allDay
                          ? '全天'
                          : `${format(new Date(event.start), 'HH:mm')} - ${format(new Date(event.end), 'HH:mm')}`}
                      </ThemedText>
                    </View>
                    <View style={styles.row}>
                      <MaterialIcons name="timer" size={16} color={Colors.light.primary} />
                      <ThemedText style={styles.rowValue}>
                        时长: {getDurationLabel(event.start, event.end)}
                      </ThemedText>
                    </View>
                    {event.location ? (
                      <View style={styles.row}>
                        <MaterialIcons name="place" size={16} color={Colors.light.primary} />
                        <ThemedText style={styles.rowValue}>{event.location}</ThemedText>
                      </View>
                    ) : null}
                    <View style={styles.row}>
                      <MaterialIcons
                        name={event.aiGenerated ? 'auto-awesome' : 'person-outline'}
                        size={16}
                        color={Colors.light.primary}
                      />
                      <ThemedText style={styles.rowValue}>
                        {event.aiGenerated ? 'AI 生成日程' : '手动创建日程'}
                      </ThemedText>
                    </View>
                  </Card>

                  <Card variant="outlined" style={styles.sectionCard}>
                    <ThemedText type="defaultSemiBold">详细描述</ThemedText>
                    <ThemedText style={[styles.descriptionText, { color: secondaryTextColor }]}>
                      {event.description?.trim() || '暂无描述'}
                    </ThemedText>
                  </Card>

                  <Card variant="outlined" style={styles.sectionCard}>
                    <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm }}>
                      相关资源
                    </ThemedText>
                    {eventResources.length > 0 ? (
                      eventResources.map((resource, index) => (
                        <TouchableOpacity
                          key={`${resource.url || 'resource'}-${index}`}
                          style={styles.resourceItem}
                          onPress={() => {
                            void openResource(resource.url);
                          }}
                          disabled={!resource.url}
                        >
                          <View style={{ flex: 1 }}>
                            <ThemedText type="defaultSemiBold" numberOfLines={1}>
                              {resource.title || `资源 ${index + 1}`}
                            </ThemedText>
                            <ThemedText type="caption" numberOfLines={1}>
                              {resource.url || '无链接'}
                            </ThemedText>
                          </View>
                          <MaterialIcons name="open-in-new" size={16} color={Colors.light.primary} />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <ThemedText type="caption" style={styles.resourceEmptyText}>
                        暂无资源
                      </ThemedText>
                    )}
                  </Card>
                </>
              )}
            </ScrollView>
          ) : null}

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            {editing ? (
              <>
                <Button
                  title="取消编辑"
                  variant="secondary"
                  onPress={() => setEditing(false)}
                  style={styles.footerButton}
                />
                <Button
                  title="保存"
                  onPress={() => {
                    void handleSave();
                  }}
                  loading={saving}
                  disabled={saving}
                  style={styles.footerButton}
                />
              </>
            ) : (
              <>
                <Button
                  title="关闭"
                  variant="secondary"
                  onPress={onClose}
                  style={styles.footerButton}
                />
                <Button
                  title="删除日程"
                  variant="destructive"
                  onPress={handleDelete}
                  loading={deleting}
                  disabled={!event || deleting}
                  style={styles.footerButton}
                />
              </>
            )}
          </View>
        </View>
      </View>

      <Modal
        visible={activeDateTimeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDateTimePicker}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={styles.pickerBackdrop} onPress={closeDateTimePicker} />
          <View style={[styles.pickerPanel, { backgroundColor: surfaceColor, borderColor }]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.sm }}>
              {activeDateTimeTarget === 'start' ? '选择开始时间' : '选择结束时间'}
            </ThemedText>

            <View style={styles.pickerSection}>
              <ThemedText type="label" style={styles.pickerLabel}>日期</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {yearOptions.map((year) => (
                  <TouchableOpacity
                    key={`year-${year}`}
                    style={[styles.optionChip, pickerState.year === year && styles.optionChipActive]}
                    onPress={() => updatePickerState('year', year)}
                  >
                    <ThemedText type="caption" style={pickerState.year === year ? styles.optionTextActive : styles.optionText}>
                      {year}年
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {monthOptions.map((month) => (
                  <TouchableOpacity
                    key={`month-${month}`}
                    style={[styles.optionChip, pickerState.month === month && styles.optionChipActive]}
                    onPress={() => updatePickerState('month', month)}
                  >
                    <ThemedText type="caption" style={pickerState.month === month ? styles.optionTextActive : styles.optionText}>
                      {month}月
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {dayOptions.map((day) => (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[styles.optionChip, pickerState.day === day && styles.optionChipActive]}
                    onPress={() => updatePickerState('day', day)}
                  >
                    <ThemedText type="caption" style={pickerState.day === day ? styles.optionTextActive : styles.optionText}>
                      {day}日
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.pickerSection}>
              <ThemedText type="label" style={styles.pickerLabel}>时间</ThemedText>
              <View style={styles.timeInputRow}>
                <Input
                  label="小时"
                  value={hourInput}
                  onChangeText={(value) => setHourInput(value.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="00"
                  error={hourInput.trim().length > 0 && !isHourValid ? '请输入 0-23 的小时' : null}
                  containerStyle={styles.timeNumericInput}
                />
                <Input
                  label="分钟"
                  value={minuteInput}
                  onChangeText={(value) => setMinuteInput(value.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="00"
                  error={minuteInput.trim().length > 0 && !isMinuteValid ? '请输入 0-59 的分钟' : null}
                  containerStyle={styles.timeNumericInput}
                />
              </View>
              <ThemedText type="caption">
                小时范围 0-23，分钟范围 0-59
              </ThemedText>
            </View>

            <View style={styles.pickerActions}>
              <Button title="取消" variant="secondary" onPress={closeDateTimePicker} style={styles.footerButton} />
              <Button title="确认" onPress={applyDateTimePicker} disabled={!canApplyDateTime} style={styles.footerButton} />
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: BorderRadius.full,
  },
  content: {
    maxHeight: '75%',
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  typeBadge: {
    backgroundColor: '#DBEAFE',
  },
  priorityBadge: {
    backgroundColor: '#FEF3C7',
  },
  statusBadge: {
    backgroundColor: '#E0E7FF',
  },
  badgeText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  sectionCard: {
    marginVertical: Spacing.xs,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  rowValue: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  descriptionText: {
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceHighlight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  resourceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  resourceHintText: {
    flex: 1,
    color: Colors.light.textSecondary,
  },
  resourceAddButton: {
    marginHorizontal: 0,
  },
  resourceEditItem: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.light.surface,
  },
  resourceEditInput: {
    marginBottom: Spacing.xs,
  },
  resourceDeleteButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },
  resourceEmptyText: {
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  footer: {
    borderTopWidth: 1,
    padding: Spacing.lg,
    flexDirection: 'row',
  },
  footerButton: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  dateTimeRow: {
    flexDirection: 'row',
    marginHorizontal: -Spacing.xs,
  },
  dateTimeInput: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  descriptionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  optionTitle: {
    marginBottom: Spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  optionChip: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.light.surface,
  },
  optionChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: Colors.light.primary,
  },
  optionText: {
    color: Colors.light.textSecondary,
  },
  optionTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  dropdownLabel: {
    marginBottom: Spacing.xs,
  },
  dropdownField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerPanel: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  pickerSection: {
    marginBottom: Spacing.md,
  },
  pickerLabel: {
    marginBottom: Spacing.xs,
  },
  timeInputRow: {
    flexDirection: 'row',
    marginHorizontal: -Spacing.xs,
  },
  timeNumericInput: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  pickerActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
});
