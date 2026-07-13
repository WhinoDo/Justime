import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';

interface ThinkingBubbleProps {
  input?: string;
}

type ThinkingIconName =
  | 'sparkles'
  | 'brain'
  | 'magnifyingglass'
  | 'calendar.badge.clock'
  | 'chevron.left.forwardslash.chevron.right'
  | 'wand.and.stars';

type ThinkingStep = {
  text: string;
  icon: ThinkingIconName;
  duration: number;
};

const jitter = (base: number, amplitude: number) => {
  const delta = Math.floor(Math.random() * amplitude);
  return base + delta;
};

export function ThinkingBubble({ input = '' }: ThinkingBubbleProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);

  const normalizedInput = input.trim().toLowerCase();
  const trimmedInput = input.trim();
  const isGreeting = /^[你您]好|^hello|^hi|在吗/i.test(trimmedInput);
  const isTaskDecomposition = /分解|拆解|计划|方案|项目|路线图|里程碑/.test(input);
  const isCalendar = /日程|提醒|会议|预约|明天|后天|下周|时间安排/.test(input);
  const isSearch = /搜索|查找|查询|最新|新闻|资料来源|web|网页/.test(input);
  const isKnowledge = /知识库|文档|资料|pdf|文件|串\.pdf|readme|查一下|定义/.test(input);
  const isCode = /代码|报错|bug|python|java|javascript|typescript|js|tsx|sql|接口/.test(normalizedInput);

  const steps = useMemo<ThinkingStep[]>(() => {
    const baseSteps: ThinkingStep[] = [
      { text: '正在解析语义...', icon: 'brain', duration: jitter(1000, 500) },
    ];

    if (isGreeting) {
      return [
        ...baseSteps,
        { text: '正在构建回复...', icon: 'sparkles', duration: jitter(1200, 400) },
      ];
    }

    const specificSteps: ThinkingStep[] = [];

    if (isTaskDecomposition) {
      specificSteps.push(
        { text: '正在构建工作结构(WBS)...', icon: 'chevron.left.forwardslash.chevron.right', duration: jitter(1800, 1000) },
        { text: '正在评估任务耗时...', icon: 'calendar.badge.clock', duration: jitter(1600, 700) }
      );
    } else if (isCalendar) {
      specificSteps.push(
        { text: '正在提取时间要素...', icon: 'calendar.badge.clock', duration: jitter(1300, 600) },
        { text: '正在检查日程冲突...', icon: 'magnifyingglass', duration: jitter(1500, 800) }
      );
    } else if (isKnowledge) {
      specificSteps.push(
        { text: '正在转换为向量查询...', icon: 'brain', duration: jitter(1300, 500) },
        { text: '正在检索本地知识库...', icon: 'magnifyingglass', duration: jitter(1800, 900) }
      );
    } else if (isCode) {
      specificSteps.push(
        { text: '正在分析代码逻辑...', icon: 'chevron.left.forwardslash.chevron.right', duration: jitter(1500, 800) },
        { text: '正在推导修复方案...', icon: 'brain', duration: jitter(1800, 1000) }
      );
    } else if (isSearch) {
      specificSteps.push(
        { text: '正在调用搜索引擎...', icon: 'magnifyingglass', duration: jitter(1700, 900) },
        { text: '正在整合全网信息...', icon: 'wand.and.stars', duration: jitter(1500, 800) }
      );
    }

    if (specificSteps.length === 0) {
      specificSteps.push(
        { text: '正在进行逻辑推理...', icon: 'brain', duration: jitter(1500, 700) },
        { text: '正在组织语言...', icon: 'sparkles', duration: jitter(1800, 1000) }
      );
      return [...baseSteps, ...specificSteps];
    }

    return [
      ...baseSteps,
      ...specificSteps,
      { text: '正在生成最终结论...', icon: 'sparkles', duration: jitter(1800, 1200) },
    ];
  }, [isCalendar, isCode, isGreeting, isKnowledge, isSearch, isTaskDecomposition]);

  useEffect(() => {
    setStepIndex(0);
    fadeAnim.setValue(1);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let isMounted = true;
    let currentStep = 0;

    const scheduleNext = () => {
      if (!isMounted || currentStep >= steps.length - 1) {
        return;
      }

      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }).start(() => {
          if (!isMounted) return;

          currentStep += 1;
          setStepIndex(currentStep);

          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }).start(() => {
            scheduleNext();
          });
        });
      }, steps[currentStep]?.duration || 2000);
    };

    scheduleNext();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fadeAnim, steps]);

  useEffect(() => {
    const animations = [dot1, dot2, dot3].map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            delay: index * 200,
            useNativeDriver: true,
            easing: Easing.ease,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.ease,
          }),
        ])
      )
    );

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dot1, dot2, dot3]);

  const getDotStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.2],
        }),
      },
    ],
  });

  const currentStep = steps[stepIndex] || {
    text: '正在思考...',
    icon: 'brain' as ThinkingIconName,
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <IconSymbol name="sparkles" size={16} color="#FFF" />
      </View>
      <View style={styles.bubble}>
        <View style={styles.content}>
          <View style={styles.statusIconWrap}>
            <IconSymbol name={currentStep.icon} size={14} color={Colors.light.primary} />
          </View>
          <Animated.View style={[styles.textWrap, { opacity: fadeAnim }]}>
            <ThemedText style={styles.text} numberOfLines={1}>
              {currentStep.text}
            </ThemedText>
          </Animated.View>
          <View style={styles.dots}>
            <Animated.View style={[styles.dot, getDotStyle(dot1)]} />
            <Animated.View style={[styles.dot, getDotStyle(dot2)]} />
            <Animated.View style={[styles.dot, getDotStyle(dot3)]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
    marginBottom: 4,
  },
  bubble: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    maxWidth: '82%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  textWrap: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  text: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.textSecondary,
    marginHorizontal: 1,
  },
});
