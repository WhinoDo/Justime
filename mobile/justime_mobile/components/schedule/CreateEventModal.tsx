import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  ScheduleEventUpdatePayload,
} from './EventDetailSheet';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: ScheduleEventUpdatePayload) => Promise<void>;
  loading?: boolean;
  defaultDate?: string;
}

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

type DateTimePickerTarget = 'start' | 'end' | null;

type DateTimePickerState = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
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
  return { ...state, day: maxDays };
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

export function CreateEventModal({
  visible,
  onClose,
  onCreate,
  loading = false,
  defaultDate,
}: CreateEventModalProps) {
  const surfaceColor = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('pending');
  const [allDay, setAllDay] = useState(false);

  const [activeDateTimeTarget, setActiveDateTimeTarget] = useState<DateTimePickerTarget>(null);
  const [pickerState, setPickerState] = useState<DateTimePickerState>(toPickerState(new Date()));
  const [hourInput, setHourInput] = useState('09');
  const [minuteInput, setMinuteInput] = useState('00');

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setLocation('');
    setType('task');
    setPriority('medium');
    setStatus('pending');
    setAllDay(false);

    const baseDate = defaultDate ? new Date(defaultDate) : new Date();
    const startDate = new Date(baseDate);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(baseDate);
    endDate.setHours(10, 0, 0, 0);

    setStartInput(format(startDate, 'yyyy-MM-dd HH:mm'));
    setEndInput(format(endDate, 'yyyy-MM-dd HH:mm'));
  }, [visible, defaultDate]);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 11 }, (_, i) => currentYear - 3 + i),
    [currentYear]
  );
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const dayOptions = useMemo(
    () => Array.from({ length: getDaysInMonth(pickerState.year, pickerState.month) }, (_, i) => i + 1),
    [pickerState.month, pickerState.year]
  );

  const parsedHourInput = Number.parseInt(hourInput, 10);
  const parsedMinuteInput = Number.parseInt(minuteInput, 10);
  const isHourValid = hourInput.trim().length > 0 && Number.isInteger(parsedHourInput) && parsedHourInput >= 0 && parsedHourInput <= 23;
  const isMinuteValid = minuteInput.trim().length > 0 && Number.isInteger(parsedMinuteInput) && parsedMinuteInput >= 0 && parsedMinuteInput <= 59;
  const canApplyDateTime = isHourValid && isMinuteValid;

  const openDateTimePicker = (target: Exclude<DateTimePickerTarget, null>) => {
    const currentValue = target === 'start' ? startInput : endInput;
    const parsed = parseDateTimeInput(currentValue) || new Date();
    setPickerState(toPickerState(parsed));
    setHourInput(String(parsed.getHours()).padStart(2, '0'));
    setMinuteInput(String(parsed.getMinutes()).padStart(2, '0'));
    setActiveDateTimeTarget(target);
  };

  const closeDateTimePicker = () => setActiveDateTimeTarget(null);

  const updatePickerState = (key: keyof DateTimePickerState, value: number) => {
    setPickerState((prev) => clampPickerStateDay({ ...prev, [key]: value }));
  };

  const applyDateTimePicker = () => {
    if (!canApplyDateTime) return;
    const nextPickerState = clampPickerStateDay({
      ...pickerState,
      hour: parsedHourInput,
      minute: parsedMinuteInput,
    });
    const formatted = formatDateTimeFromParts(nextPickerState);
    if (activeDateTimeTarget === 'start') {
      setStartInput(formatted);
    } else if (activeDateTimeTarget === 'end') {
      setEndInput(formatted);
    }
    closeDateTimePicker();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '标题不能为空');
      return;
    }
    if (!startInput.trim()) {
      Alert.alert('提示', '请选择开始时间');
      return;
    }
    if (!endInput.trim()) {
      Alert.alert('提示', '请选择结束时间');
      return;
    }

    const startDate = parseDateTimeInput(startInput);
    if (!startDate) {
      Alert.alert('提示', '开始时间格式无效');
      return;
    }

    const endDate = parseDateTimeInput(endInput);
    if (!endDate) {
      Alert.alert('提示', '结束时间格式无效');
      return;
    }

    if (startDate.getTime() >= endDate.getTime()) {
      Alert.alert('提示', '结束时间必须晚于开始时间');
      return;
    }

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        location: location.trim(),
        type,
        priority,
        status,
        allDay,
        resources: [],
      });
    } catch (error) {
      Alert.alert('创建失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  return (
    <>
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
              <ThemedText type="subtitle">创建新日程</ThemedText>
              <Button
                title=""
                variant="ghost"
                icon={<MaterialIcons name="close" size={20} color={Colors.light.textSecondary} />}
                style={styles.closeButton}
                onPress={onClose}
              />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
              <Card variant="outlined" style={styles.sectionCard}>
                <Input
                  label="标题"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="请输入标题"
                />
                <View style={styles.dateTimeRow}>
                  <View style={styles.dateTimeInput}>
                    <ThemedText type="label" style={styles.dropdownLabel}>开始时间</ThemedText>
                    <TouchableOpacity
                      style={styles.dropdownField}
                      onPress={() => openDateTimePicker('start')}
                    >
                      <ThemedText>{startInput || '选择开始时间'}</ThemedText>
                      <MaterialIcons name="arrow-drop-down" size={20} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dateTimeInput}>
                    <ThemedText type="label" style={styles.dropdownLabel}>结束时间</ThemedText>
                    <TouchableOpacity
                      style={styles.dropdownField}
                      onPress={() => openDateTimePicker('end')}
                    >
                      <ThemedText>{endInput || '选择结束时间'}</ThemedText>
                      <MaterialIcons name="arrow-drop-down" size={20} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.row}>
                  <MaterialIcons
                    name={allDay ? 'check-box' : 'check-box-outline-blank'}
                    size={18}
                    color={Colors.light.primary}
                  />
                  <TouchableOpacity onPress={() => setAllDay(!allDay)}>
                    <ThemedText style={{ marginLeft: Spacing.sm }}>全天事件</ThemedText>
                  </TouchableOpacity>
                </View>

                <Input
                  label="地点"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="可选"
                />
                <Input
                  label="描述"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="可选"
                  multiline
                  style={styles.descriptionInput}
                />

                <ThemedText type="defaultSemiBold" style={styles.optionTitle}>类型</ThemedText>
                <View style={styles.optionRow}>
                  {TYPE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionChip, type === option.value && styles.optionChipActive]}
                      onPress={() => setType(option.value)}
                    >
                      <ThemedText type="caption" style={type === option.value ? styles.optionTextActive : styles.optionText}>
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                <ThemedText type="defaultSemiBold" style={styles.optionTitle}>优先级</ThemedText>
                <View style={styles.optionRow}>
                  {PRIORITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionChip, priority === option.value && styles.optionChipActive]}
                      onPress={() => setPriority(option.value)}
                    >
                      <ThemedText type="caption" style={priority === option.value ? styles.optionTextActive : styles.optionText}>
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                <ThemedText type="defaultSemiBold" style={styles.optionTitle}>状态</ThemedText>
                <View style={styles.optionRow}>
                  {STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionChip, status === option.value && styles.optionChipActive]}
                      onPress={() => setStatus(option.value)}
                    >
                      <ThemedText type="caption" style={status === option.value ? styles.optionTextActive : styles.optionText}>
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: borderColor }]}>
              <Button title="取消" variant="secondary" onPress={onClose} style={styles.footerButton} />
              <Button title="创建" onPress={handleCreate} loading={loading} disabled={loading} style={styles.footerButton} />
            </View>
          </View>
        </View>
      </Modal>

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
                  error={hourInput.trim().length > 0 && !isHourValid ? '请输入 0-23' : null}
                  containerStyle={styles.timeNumericInput}
                />
                <Input
                  label="分钟"
                  value={minuteInput}
                  onChangeText={(value) => setMinuteInput(value.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="00"
                  error={minuteInput.trim().length > 0 && !isMinuteValid ? '请输入 0-59' : null}
                  containerStyle={styles.timeNumericInput}
                />
              </View>
            </View>

            <View style={styles.pickerActions}>
              <Button title="取消" variant="secondary" onPress={closeDateTimePicker} style={styles.footerButton} />
              <Button title="确认" onPress={applyDateTimePicker} disabled={!canApplyDateTime} style={styles.footerButton} />
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
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
  sectionCard: {
    marginVertical: Spacing.xs,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
    minHeight: 80,
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
