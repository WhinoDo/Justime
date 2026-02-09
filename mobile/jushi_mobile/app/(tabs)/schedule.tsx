import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
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

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';

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
};

export default function ScheduleScreen() {
  const { token, baseUrl, loading: authLoading } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const toggleViewMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(prev => prev === 'list' ? 'timeline' : 'list');
  };

  const loadEvents = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/calendar/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setEvents(result.data?.events || []);
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

  // Group events by date for the calendar markers
  const markedDates = useMemo(() => {
    const marks: any = {};
    events.forEach(event => {
      const dateKey = event.start.split('T')[0];
      if (!marks[dateKey]) {
        marks[dateKey] = { dots: [] };
      }
      // Limit dots to avoid UI clutter
      if (marks[dateKey].dots.length < 3) {
        marks[dateKey].dots.push({ color: Colors.light.primary });
      }
    });

    // Add selected date styling
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: Colors.light.primary,
    };

    return marks;
  }, [events, selectedDate]);

  // Filter events for the selected date
  const selectedEvents = useMemo(() => {
    return events.filter(event => event.start.startsWith(selectedDate));
  }, [events, selectedDate]);

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

  const { width: screenWidth } = useWindowDimensions();

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
              onPress={() => { /* Handle press */ }}
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
        <Button
          variant="ghost"
          title=""
          icon={<IconSymbol name={viewMode === 'list' ? 'list.bullet' : 'calendar'} size={20} color={Colors.light.primary} />}
          onPress={toggleViewMode}
        />
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={selectedEvents}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadEvents} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card variant="elevated" style={styles.eventCard}>
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
                </View>
              </View>
            </Card>
          )}
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
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  eventCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
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
