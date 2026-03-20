import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Colors, Spacing } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type HabitFormState = {
  occupation: string;
  currentStudyFocus: string;
  highEfficiencyPeriods: string;
  lowEfficiencyPeriods: string;
  weeklyUnavailableSlots: string;
  preferredFocusMinutes: string;
  preferredBreakMinutes: string;
  maxFocusSessionsPerDay: string;
  planningPreference: string;
  notes: string;
};

const DEFAULT_HABIT_FORM: HabitFormState = {
  occupation: '',
  currentStudyFocus: '',
  highEfficiencyPeriods: '',
  lowEfficiencyPeriods: '',
  weeklyUnavailableSlots: '',
  preferredFocusMinutes: '45',
  preferredBreakMinutes: '10',
  maxFocusSessionsPerDay: '4',
  planningPreference: '',
  notes: '',
};

/**
 * 将用户在输入框里填写的由换行符或逗号分隔的字符串，解析成字符串数组
 * 用于处理 "高效时段"、"低效时段" 等多条目设置
 */
const parseListInput = (value: string): string[] => (
  value
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean)
);

/**
 * 将从后端接口拿到的字符串数组，重新拼接回带有换行符的纯文本
 * 用于在界面的多行输入框 (Multiline Input) 中展示
 */
const listToText = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
};

/**
 * 将字符串解析为数字，并限制其在 [min, max] 范围内
 * 用于保护 "偏好专注时长"、"每日深度任务上限" 等数值，防止用户输入非法的极端数字
 */
const toBoundedInt = (value: string, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

export default function ProfileScreen() {
  const { user, token, baseUrl, signOut } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');

  const [habitForm, setHabitForm] = useState<HabitFormState>(DEFAULT_HABIT_FORM);
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveMessageType, setSaveMessageType] = useState<'success' | 'error'>('success');

  /**
   * 处理退出登录
   * 调用由 AuthContext 提供的全局 signOut 方法，清除本地 token 并跳转到登录页
   */
  const handleLogout = async () => {
    await signOut();
  };

  /**
   * 加载当前用户的个人资料与学习习惯设置
   * 1. 使用 token 鉴权调用 /api/v1/auth/profile
   * 2. 如果遇到 401 状态码，主动触发登出逻辑
   * 3. 拿到数据后，将其回填（解析转换后）到本地的 habitForm 状态机中渲染表单
   */
  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoadingProfile(true);
    setSaveMessage(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.message || result?.error || '加载个人资料失败');
      }

      const profile = result?.data?.user?.profile || {};
      const habits = profile?.habits || {};

      setProfileData(profile);
      setHabitForm({
        occupation: habits.occupation || '',
        currentStudyFocus: habits.currentStudyFocus || '',
        highEfficiencyPeriods: listToText(habits.highEfficiencyPeriods),
        lowEfficiencyPeriods: listToText(habits.lowEfficiencyPeriods),
        weeklyUnavailableSlots: listToText(habits.weeklyUnavailableSlots),
        preferredFocusMinutes: String(habits.preferredFocusMinutes ?? 45),
        preferredBreakMinutes: String(habits.preferredBreakMinutes ?? 10),
        maxFocusSessionsPerDay: String(habits.maxFocusSessionsPerDay ?? 4),
        planningPreference: habits.planningPreference || '',
        notes: habits.notes || '',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '加载个人资料失败';
      if (msg.includes('登录已过期')) {
        await signOut();
      } else {
        setSaveMessageType('error');
        setSaveMessage(msg);
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [baseUrl, signOut, token]);

  const handleSaveHabits = async () => {
    if (!token || !user) return;
    setSavingProfile(true);
    setSaveMessage(null);

    try {
      // 组装提交给后端的 Payload：
      // 将页面上的纯文本输入，通过 parseListInput / toBoundedInt 等辅助函数
      // 转化为符合系统要求的结构化数据（数组、受限整数）
      const payloadProfile = {
        ...profileData,
        name: profileData?.name || user.displayName || user.email || '用户',
        displayName: profileData?.displayName || user.displayName || '',
        email: profileData?.email || user.email || '',
        habits: {
          occupation: habitForm.occupation.trim(),
          currentStudyFocus: habitForm.currentStudyFocus.trim(),
          highEfficiencyPeriods: parseListInput(habitForm.highEfficiencyPeriods),
          lowEfficiencyPeriods: parseListInput(habitForm.lowEfficiencyPeriods),
          weeklyUnavailableSlots: parseListInput(habitForm.weeklyUnavailableSlots),
          preferredFocusMinutes: toBoundedInt(habitForm.preferredFocusMinutes, 45, 15, 180),
          preferredBreakMinutes: toBoundedInt(habitForm.preferredBreakMinutes, 10, 5, 60),
          maxFocusSessionsPerDay: toBoundedInt(habitForm.maxFocusSessionsPerDay, 4, 1, 12),
          planningPreference: habitForm.planningPreference.trim(),
          notes: habitForm.notes.trim(),
        },
      };

      const response = await fetch(`${baseUrl}/api/v1/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile: payloadProfile }),
      });

      if (response.status === 401) {
        throw new Error('登录已过期，请重新登录');
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.message || result?.error || '保存失败');
      }

      const savedProfile = result?.data?.user?.profile || payloadProfile;
      const savedHabits = savedProfile?.habits || payloadProfile.habits;
      setProfileData(savedProfile);
      setHabitForm({
        occupation: savedHabits.occupation || '',
        currentStudyFocus: savedHabits.currentStudyFocus || '',
        highEfficiencyPeriods: listToText(savedHabits.highEfficiencyPeriods),
        lowEfficiencyPeriods: listToText(savedHabits.lowEfficiencyPeriods),
        weeklyUnavailableSlots: listToText(savedHabits.weeklyUnavailableSlots),
        preferredFocusMinutes: String(savedHabits.preferredFocusMinutes ?? 45),
        preferredBreakMinutes: String(savedHabits.preferredBreakMinutes ?? 10),
        maxFocusSessionsPerDay: String(savedHabits.maxFocusSessionsPerDay ?? 4),
        planningPreference: savedHabits.planningPreference || '',
        notes: savedHabits.notes || '',
      });
      setSaveMessageType('success');
      setSaveMessage('保存成功，后续 AI 安排日程会参考你的个性化信息。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败';
      if (msg.includes('登录已过期')) {
        await signOut();
      } else {
        setSaveMessageType('error');
        setSaveMessage(msg);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.centered}>
          <ThemedText type="subtitle">请先登录</ThemedText>
          <Button
            title="去登录"
            onPress={() => router.push('/(tabs)')}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <ThemedText type="title" style={{ color: 'white' }}>
              {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
            </ThemedText>
          </View>
          <ThemedText type="heading">{user.displayName || '用户'}</ThemedText>
          <ThemedText type="caption" style={{ color: Colors.light.textSecondary }}>{user.email}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>个性化习惯与学习方向</ThemedText>
          <Card variant="outlined" style={styles.formCard}>
            {loadingProfile ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
                <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: Colors.light.textSecondary }}>
                  正在加载个性化信息...
                </ThemedText>
              </View>
            ) : null}

            <Input
              label="工作角色"
              value={habitForm.occupation}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, occupation: value }))}
              placeholder="例如：后端工程师"
            />
            <Input
              label="学习方向"
              value={habitForm.currentStudyFocus}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, currentStudyFocus: value }))}
              placeholder="例如：微积分、英语、算法"
            />
            <Input
              label="偏好专注时长（分钟）"
              value={habitForm.preferredFocusMinutes}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, preferredFocusMinutes: value }))}
              keyboardType="number-pad"
              placeholder="45"
            />
            <Input
              label="偏好休息时长（分钟）"
              value={habitForm.preferredBreakMinutes}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, preferredBreakMinutes: value }))}
              keyboardType="number-pad"
              placeholder="10"
            />
            <Input
              label="每日深度任务上限"
              value={habitForm.maxFocusSessionsPerDay}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, maxFocusSessionsPerDay: value }))}
              keyboardType="number-pad"
              placeholder="4"
            />
            <Input
              label="计划偏好"
              value={habitForm.planningPreference}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, planningPreference: value }))}
              placeholder="例如：先难后易，上午安排重点任务"
            />
            <Input
              label="高效时段（每行一条）"
              value={habitForm.highEfficiencyPeriods}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, highEfficiencyPeriods: value }))}
              placeholder={'例如：\n09:00-11:30\n20:00-22:00'}
              multiline
              style={styles.multilineInput}
            />
            <Input
              label="低效时段（每行一条）"
              value={habitForm.lowEfficiencyPeriods}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, lowEfficiencyPeriods: value }))}
              placeholder={'例如：\n14:00-15:00'}
              multiline
              style={styles.multilineInput}
            />
            <Input
              label="每周不可用时段（每行一条）"
              value={habitForm.weeklyUnavailableSlots}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, weeklyUnavailableSlots: value }))}
              placeholder={'例如：\n周二 19:00-21:00\n周四 18:00-20:00'}
              multiline
              style={styles.multilineInput}
            />
            <Input
              label="补充备注"
              value={habitForm.notes}
              onChangeText={(value) => setHabitForm((prev) => ({ ...prev, notes: value }))}
              placeholder="例如：晚上学习效率更高，周末可安排长任务"
              multiline
              style={styles.multilineInput}
            />

            {saveMessage ? (
              <ThemedText
                type="caption"
                style={{ color: saveMessageType === 'success' ? Colors.light.success : Colors.light.error, marginBottom: Spacing.sm }}
              >
                {saveMessage}
              </ThemedText>
            ) : null}

            <Button
              title="保存个性化信息"
              onPress={handleSaveHabits}
              loading={savingProfile}
              disabled={savingProfile || loadingProfile}
            />
            <ThemedText type="caption" style={styles.helperText}>
              说明：AI 在安排日程、任务分解和时间建议时会优先参考这里的设置。
            </ThemedText>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>设置</ThemedText>

          <Card variant="outlined" style={styles.menuItem}>
            <Button
              variant="ghost"
              title="模型配置"
              icon={<IconSymbol name="gear" size={20} color={Colors.light.text} />}
              onPress={() => router.push('/settings/model-config')}
              style={styles.menuButton}
            />
          </Card>

          <Card variant="outlined" style={styles.menuItem}>
            <Button
              variant="ghost"
              title="知识库管理 (开发中)"
              icon={<IconSymbol name="folder" size={20} color={Colors.light.text} />}
              disabled
              style={styles.menuButton}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Button
            variant="destructive"
            title="退出登录"
            onPress={handleLogout}
          />
        </View>
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
    paddingBottom: Spacing.xl * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  formCard: {
    padding: Spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
  },
  helperText: {
    color: Colors.light.textSecondary,
    marginTop: Spacing.sm,
  },
  menuItem: {
    marginBottom: Spacing.sm,
    padding: 0,
    overflow: 'hidden',
  },
  menuButton: {
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.md,
    width: '100%',
  },
});
