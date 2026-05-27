import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  LayoutAnimation,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  EventDetailSheet,
  ScheduleEventDetail,
  ScheduleEventUpdatePayload,
} from '@/components/schedule/EventDetailSheet';
import { CreateEventModal } from '@/components/schedule/CreateEventModal';

// Configure Locale for Calendar (Simplified Chinese)
LocaleConfig.locales['zh'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  today: '今天'
};
LocaleConfig.defaultLocale = 'zh';

type CalendarEvent = {
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
  resources?: {
    title?: string;
    url?: string;
  }[];
};

export default function ScheduleScreen() {
  const { token, baseUrl, loading: authLoading } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const { width: screenWidth } = useWindowDimensions();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [batchDeleteMode, setBatchDeleteMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  /**
   * 切换日历下方的视图模式
   * 在 "列表视图 (list)" 和 "时间轴视图 (timeline)" 之间切换
   * LayoutAnimation 提供了一个流畅的原生过渡动画
   */
  const toggleViewMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(prev => prev === 'list' ? 'timeline' : 'list');
  };

  /**
   * 从后端 API 拉取当前用户的所有日程数据
   * 1. 携带全局 AuthContext 中的 JWT Token 
   * 2. 如果当前处于批量删除模式，会自动清洗 selectedEventIds，剔除掉已经被删掉的旧 ID
   */
  const loadEvents = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        const nextEvents = result.data?.events || [];
        setEvents(nextEvents);
        const validIds = new Set(nextEvents.map((event: CalendarEvent) => event.id));
        setSelectedEventIds((prev) => new Set(Array.from(prev).filter((id) => validIds.has(id))));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [token, baseUrl]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  // 根据当月的所有 events 数据，在日历组件 (Calendar) 的对应日期下方画小圆点
  // 使用 useMemo 缓存计算结果，防止每次渲染都重新遍历数组
  const markedDates = useMemo(() => {
    const marks: any = {};
    events.forEach(event => {
      const dateKey = event.start.split('T')[0];
      if (!marks[dateKey]) {
        marks[dateKey] = { dots: [] };
      }
      // UI 限制：就算一天有 10 个日程，最多只画 3 个点防止太拥挤
      if (marks[dateKey].dots.length < 3) {
        marks[dateKey].dots.push({ color: Colors.light.primary });
      }
    });

    // 为当前用户点击选中的日期叠加蓝色高亮背景效果
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: Colors.light.primary,
    };

    return marks;
  }, [events, selectedDate]);

  // 从所有日程中，筛选出属于当前选中日期 (selectedDate) 的日程，用于下方列表/时间轴展示
  const selectedEvents = useMemo(() => {
    return events.filter(event => event.start.startsWith(selectedDate));
  }, [events, selectedDate]);

  // 监听批量删除模式
  // 如果用户切了日期，把不在当前日期的人从勾选缓存里剔除掉
  useEffect(() => {
    if (!batchDeleteMode) return;
    const visibleIds = new Set(selectedEvents.map((event) => event.id));
    setSelectedEventIds((prev) => new Set(Array.from(prev).filter((id) => visibleIds.has(id))));
  }, [batchDeleteMode, selectedEvents]);

  const openEventDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailVisible(true);
  };

  const closeEventDetail = () => {
    setDetailVisible(false);
    setSelectedEvent(null);
  };

  /**
   * 删除单个日程
   * 调用 DELETE 接口并从本地状态中移除以刷新 UI
   */
  const handleDeleteEvent = async (eventId: string) => {
    if (!token) return;
    setDeletingEvent(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/calendar/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.detail || result.message || '删除失败');
      }

      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      closeEventDetail();
    } catch (error) {
      console.error('删除日程失败:', error);
    } finally {
      setDeletingEvent(false);
    }
  };

  /**
   * （批量删除模式下）切换某个日程的选中状态
   */
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  /**
   * 进入批量删除模式
   * 强制切换回列表试图，因为时间轴视图不好做勾选 UI
   */
  const handleEnterBatchDeleteMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (viewMode !== 'list') {
      setViewMode('list');
    }
    closeEventDetail();
    setSelectedEventIds(new Set());
    setBatchDeleteMode(true);
  };

  const handleCancelBatchDelete = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBatchDeleteMode(false);
    setSelectedEventIds(new Set());
  };

  const handleBatchDeleteEvents = () => {
    if (!token || selectedEventIds.size === 0 || batchDeleting) return;

    Alert.alert(
      '批量删除日程',
      `确认删除已勾选的 ${selectedEventIds.size} 个日程吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBatchDeleting(true);
              const ids = Array.from(selectedEventIds);
              const deletedIds: string[] = [];
              let failedCount = 0;

              try {
                const results = await Promise.allSettled(
                  ids.map(async (eventId) => {
                    const response = await fetch(`${baseUrl}/api/v1/calendar/events/${eventId}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    });

                    let payload: any = null;
                    try {
                      payload = await response.json();
                    } catch {
                      payload = null;
                    }

                    if (!response.ok || (payload && payload.success === false)) {
                      throw new Error(payload?.detail || payload?.message || '删除失败');
                    }
                    return eventId;
                  })
                );

                results.forEach((result) => {
                  if (result.status === 'fulfilled') {
                    deletedIds.push(result.value);
                  } else {
                    failedCount += 1;
                  }
                });

                if (deletedIds.length > 0) {
                  setEvents((prev) => prev.filter((event) => !deletedIds.includes(event.id)));
                  setSelectedEventIds((prev) => {
                    const next = new Set(prev);
                    deletedIds.forEach((id) => next.delete(id));
                    return next;
                  });
                }

                if (failedCount > 0) {
                  Alert.alert('部分删除失败', `已删除 ${deletedIds.length} 个，失败 ${failedCount} 个，请稍后重试。`);
                } else {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setBatchDeleteMode(false);
                  setSelectedEventIds(new Set());
                }
              } catch (error) {
                console.error('批量删除日程失败:', error);
                Alert.alert('删除失败', '批量删除失败，请稍后重试。');
              } finally {
                setBatchDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  /**
   * 更新日程信息
   * 该函数会作为回调通过 Props 传递给 EventDetailSheet 组件内部使用
   */
  const handleUpdateEvent = async (eventId: string, payload: ScheduleEventUpdatePayload) => {
    if (!token) return;
    setSavingEvent(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/calendar/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.detail || result.message || '保存失败');
      }

      const updatedEvent = result.data?.event as CalendarEvent | undefined;
      // 悲观更新：优先使用接口返回的已更新数据替换本地旧数据，避免全量重新 loadEvents 加快响应
      if (updatedEvent) {
        setEvents((prev) => prev.map((item) => (item.id === eventId ? updatedEvent : item)));
      } else {
        await loadEvents();
      }
      closeEventDetail();
    } catch (error) {
      console.error('更新日程失败:', error);
      throw error;
    } finally {
      setSavingEvent(false);
    }
  };

  /**
   * 创建新日程
   */
  const handleCreateEvent = async (payload: ScheduleEventUpdatePayload) => {
    if (!token) return;
    setCreatingEvent(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.detail || result.message || '创建失败');
      }

      const newEvent = result.data?.event as CalendarEvent | undefined;
      if (newEvent) {
        setEvents((prev) => [...prev, newEvent]);
      } else {
        await loadEvents();
      }
      setCreateModalVisible(false);
    } catch (error) {
      console.error('创建日程失败:', error);
      throw error;
    } finally {
      setCreatingEvent(false);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor }]}>
        <ThemedText type="subtitle">请先登录</ThemedText>
      </SafeAreaView>
    );
  }

  const HOUR_HEIGHT = 60;
  const START_HOUR = 0;
  const END_HOUR = 24;

  // Helper to layout overlapping events
  const calculateEventLayout = (events: CalendarEvent[]) => {
    if (!events.length) return [];

    // 1. Sort by start time, then end time
    const sortedEvents = [...events].sort((a, b) => {
      if (a.start === b.start) return a.end > b.end ? -1 : 1;
      return a.start > b.start ? 1 : -1;
    });

    // 2. Group into clusters (overlapping blocks)
    const clusters: CalendarEvent[][] = [];
    let currentCluster: CalendarEvent[] = [];
    let clusterEnd: Date | null = null;

    sortedEvents.forEach(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      if (!currentCluster.length) {
        currentCluster.push(event);
        clusterEnd = eventEnd;
      } else {
        // Check if this event overlaps with the cluster's broad range
        if (eventStart < (clusterEnd as Date)) {
          currentCluster.push(event);
          if (eventEnd > (clusterEnd as Date)) {
            clusterEnd = eventEnd;
          }
        } else {
          // New cluster
          clusters.push(currentCluster);
          currentCluster = [event];
          clusterEnd = eventEnd;
        }
      }
    });
    if (currentCluster.length) clusters.push(currentCluster);

    // 3. Layout each cluster
    const layoutEvents: any[] = [];

    clusters.forEach(cluster => {
      const columns: Date[] = []; // Stores the end time of the last event in each column
      const eventColumns: number[] = []; // Column index for each event in cluster

      cluster.forEach(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          if (columns[i] <= eventStart) {
            columns[i] = eventEnd;
            eventColumns.push(i);
            placed = true;
            break;
          }
        }

        if (!placed) {
          columns.push(eventEnd);
          eventColumns.push(columns.length - 1);
        }
      });

      const maxColumns = columns.length;

      cluster.forEach((event, index) => {
        const colIndex = eventColumns[index];
        const widthRatio = 1 / maxColumns;
        const leftRatio = colIndex * widthRatio;

        layoutEvents.push({
          ...event,
          layout: {
            widthRatio,
            leftRatio,
          }
        });
      });
    });

    return layoutEvents;
  };

  const renderTimeGrid = () => {
    const positionedEvents = calculateEventLayout(selectedEvents);

    return (
      <ScrollView
        style={styles.timeGridContainer}
        contentContainerStyle={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT + Spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadEvents} />}
      >
        {/* Time Ruler & Grid Lines */}
        {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
          const hour = START_HOUR + i;
          return (
            <View key={hour} style={[styles.gridRow, { top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }]}>
              <View style={styles.gridTimeLabel}>
                <ThemedText type="caption" style={{ color: Colors.light.textSecondary, fontSize: 10 }}>
                  {`${hour.toString().padStart(2, '0')}:00`}
                </ThemedText>
              </View>
              <View style={styles.gridLine} />
            </View>
          );
        })}

        {/* Current Time Indicator (if today) */}
        {selectedDate === format(new Date(), 'yyyy-MM-dd') && (
          <View style={[
            styles.currentTimeLine,
            {
              top: (new Date().getHours() * 60 + new Date().getMinutes()) * (HOUR_HEIGHT / 60)
            }
          ]}>
            <View style={styles.currentTimeDot} />
          </View>
        )}

        {/* Events */}
        {positionedEvents.map((event: any) => {
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);

          const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
          const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
          const durationMinutes = endMinutes - startMinutes;

          const top = startMinutes * (HOUR_HEIGHT / 60);
          const height = Math.max(durationMinutes * (HOUR_HEIGHT / 60), 20); // Min height 20

          // Calculate Layout
          const availableWidth = screenWidth - 60 - Spacing.lg;
          const leftOffset = 60;

          const width = availableWidth * (event.layout?.widthRatio || 1);
          const left = leftOffset + (availableWidth * (event.layout?.leftRatio || 0));

          return (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.gridEvent,
                {
                  top,
                  height,
                  left,
                  width,
                  backgroundColor: 'transparent', // Wrapper handles color if specific styling needed, but here we apply to content or container
                }
              ]}
              onPress={() => openEventDetail(event)}
            >
              <View style={[
                styles.gridEventContent,
                {
                  backgroundColor: (event.type === 'task' ? Colors.light.secondary : Colors.light.primary) + '20',
                  borderLeftColor: event.type === 'task' ? Colors.light.secondary : Colors.light.primary
                }
              ]}>
                <ThemedText type="caption" style={{ fontWeight: 'bold', color: Colors.light.text }} numberOfLines={1}>{event.title}</ThemedText>
                {durationMinutes > 30 && (
                  <ThemedText type="caption" style={{ fontSize: 10, color: Colors.light.textSecondary }} numberOfLines={1}>
                    {format(startDate, 'HH:mm')}
                  </ThemedText>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderDatePicker = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 12 }, (_, i) => currentYear - 5 + i); // 2019-2030
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor }]}>
            <View style={styles.pickerHeader}>
              <ThemedText type="subtitle">选择日期</ThemedText>
              <Button variant="ghost" title="关闭" onPress={() => setDatePickerVisible(false)} size="sm" />
            </View>

            <View style={styles.yearScroll}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {years.map(year => (
                  <TouchableOpacity
                    key={year}
                    onPress={() => setPickerYear(year)}
                    style={[
                      styles.yearChip,
                      pickerYear === year && styles.yearChipSelected
                    ]}
                  >
                    <ThemedText style={{ color: pickerYear === year ? '#FFF' : Colors.light.text }}>
                      {year}年
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.monthGrid}>
              {months.map(month => (
                <TouchableOpacity
                  key={month}
                  style={styles.monthItem}
                  onPress={() => {
                    const newDate = `${pickerYear}-${month.toString().padStart(2, '0')}-01`;
                    setSelectedDate(newDate);
                    setDatePickerVisible(false);
                  }}
                >
                  <View style={[
                    styles.monthItemContent,
                    selectedDate.startsWith(`${pickerYear}-${month.toString().padStart(2, '0')}`) && styles.monthItemSelected
                  ]}>
                    <ThemedText style={{
                      color: selectedDate.startsWith(`${pickerYear}-${month.toString().padStart(2, '0')}`) ? '#FFF' : Colors.light.text
                    }}>
                      {month}月
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {renderDatePicker()}
      <EventDetailSheet
        visible={detailVisible}
        event={selectedEvent}
        deleting={deletingEvent}
        saving={savingEvent}
        onClose={closeEventDetail}
        onDelete={handleDeleteEvent}
        onSave={handleUpdateEvent}
      />
      <CreateEventModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateEvent}
        loading={creatingEvent}
        defaultDate={selectedDate}
      />
      <View style={styles.calendarContainer}>
        <Calendar
          key={selectedDate} // Force re-render to jump to new date
          current={selectedDate}
          onDayPress={(day: any) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedDate(day.dateString);
          }}
          onMonthChange={(month: any) => {
            // Update selectedDate to the first day of the new month to sync header
            setSelectedDate(month.dateString);
          }}
          markedDates={markedDates}
          markingType={'multi-dot'}
          theme={{
            backgroundColor: backgroundColor,
            calendarBackground: backgroundColor,
            textSectionTitleColor: Colors.light.textSecondary,
            selectedDayBackgroundColor: Colors.light.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: Colors.light.primary,
            dayTextColor: Colors.light.text,
            textDisabledColor: '#d9e1e8',
            dotColor: Colors.light.primary,
            selectedDotColor: '#ffffff',
            arrowColor: Colors.light.primary,
            monthTextColor: Colors.light.text,
            indicatorColor: Colors.light.primary,
            textDayFontWeight: '400',
            textMonthFontWeight: '600',
            textDayHeaderFontWeight: '400',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 14
          }}
        />
      </View>

      <View style={styles.listHeader}>
        <TouchableOpacity
          onPress={() => {
            setPickerYear(parseInt(selectedDate.split('-')[0]));
            setDatePickerVisible(true);
          }}
          style={styles.dateSelector}
        >
          <ThemedText type="subtitle">{format(new Date(selectedDate), 'yyyy年 M月', { locale: zhCN })}</ThemedText>
          <IconSymbol name="chevron.down" size={16} color={Colors.light.text} style={{ marginLeft: 4, marginTop: 2 }} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            title=""
            icon={<IconSymbol name="plus" size={20} color={Colors.light.primary} />}
            onPress={() => setCreateModalVisible(true)}
            disabled={batchDeleting || batchDeleteMode}
            style={styles.headerActionButton}
          />
          {batchDeleteMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                title="取消"
                onPress={handleCancelBatchDelete}
                style={styles.headerActionButton}
              />
              <Button
                variant="destructive"
                size="sm"
                title={`删除(${selectedEventIds.size})`}
                onPress={handleBatchDeleteEvents}
                disabled={selectedEventIds.size === 0 || batchDeleting}
                loading={batchDeleting}
                style={styles.headerActionButton}
              />
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              title="批量删除"
              icon={<IconSymbol name="trash" size={16} color={Colors.light.error} />}
              onPress={handleEnterBatchDeleteMode}
              style={styles.headerActionButton}
            />
          )}
          <Button
            variant="ghost"
            title=""
            icon={<IconSymbol name={viewMode === 'list' ? 'list.bullet' : 'calendar'} size={20} color={Colors.light.primary} />}
            onPress={toggleViewMode}
            disabled={batchDeleting || batchDeleteMode}
          />
        </View>
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={selectedEvents}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadEvents} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = selectedEventIds.has(item.id);
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => (batchDeleteMode ? toggleEventSelection(item.id) : openEventDetail(item))}
              >
                <Card variant="elevated" style={[styles.eventCard, batchDeleteMode && selected && styles.eventCardSelected]}>
                  {batchDeleteMode ? (
                    <View style={styles.selectionIndicatorWrap}>
                      <View style={[styles.selectionIndicator, selected && styles.selectionIndicatorSelected]}>
                        {selected ? <IconSymbol name="checkmark" size={14} color="#FFF" /> : null}
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.eventRow}>
                    <View style={styles.timeColumn}>
                      <ThemedText type="caption" style={{ color: Colors.light.primary, fontWeight: '600' }}>
                        {format(new Date(item.start), 'HH:mm')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>
                        {format(new Date(item.end), 'HH:mm')}
                      </ThemedText>
                    </View>
                    <View style={styles.infoColumn}>
                      <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                      {!!item.location && (
                        <View style={styles.locationRow}>
                          <IconSymbol name="location" size={12} color={Colors.light.textSecondary} />
                          <ThemedText type="caption" style={{ marginLeft: 4 }}>{item.location}</ThemedText>
                        </View>
                      )}
                      {!!item.description && (
                        <ThemedText type="caption" style={{ marginTop: 4, color: Colors.light.textSecondary }} numberOfLines={2}>
                          {item.description}
                        </ThemedText>
                      )}
                      <ThemedText type="caption" style={{ marginTop: 6, color: Colors.light.primary }}>
                        {batchDeleteMode ? '点击勾选日程' : '点击查看详细信息'}
                      </ThemedText>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ThemedText style={{ color: Colors.light.textSecondary }}>暂无日程</ThemedText>
            </View>
          }
        />
      ) : (
        renderTimeGrid()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: Spacing.sm,
  },
  listHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    marginRight: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  eventCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  eventCardSelected: {
    borderWidth: 1,
    borderColor: Colors.light.error,
    backgroundColor: Colors.light.surface,
  },
  selectionIndicatorWrap: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 2,
  },
  selectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: Colors.light.error,
    borderColor: Colors.light.error,
  },
  eventRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    marginRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  timeGridContainer: {
    flex: 1,
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gridTimeLabel: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: -8, // Adjust to center label on line
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
    marginRight: Spacing.lg,
  },
  gridEvent: {
    position: 'absolute',
    // left/width set via inline styles
    overflow: 'hidden',
    padding: 0,
  },
  gridEventContent: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    padding: 4,
    borderLeftWidth: 3,
    height: '100%',
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'red',
    zIndex: 10,
    alignItems: 'flex-start',
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
    marginTop: -3,
    marginLeft: 56, // Overlap with line
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    marginTop: Spacing.xl * 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: '85%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  yearScroll: {
    height: 50,
    marginBottom: Spacing.md,
  },
  yearChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.light.surfaceHighlight,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    justifyContent: 'center',
  },
  yearChipSelected: {
    backgroundColor: Colors.light.primary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  monthItem: {
    width: '23%', // 4 columns
    aspectRatio: 1.5,
    marginBottom: Spacing.sm,
  },
  monthItemContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceHighlight,
  },
  monthItemSelected: {
    backgroundColor: Colors.light.primary,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
