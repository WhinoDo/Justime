import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';

interface ThinkingBubbleProps {
    input?: string;
}

export function ThinkingBubble({ input = '' }: ThinkingBubbleProps) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [stepIndex, setStepIndex] = useState(0);

    const isTaskDecomposition = /分解|拆解|计划|方案|项目/.test(input);
    const isCalendar = /日程|提醒|会议|预约|明天|下周/.test(input);
    const isSearch = /搜索|查找|查询|是谁|什么/.test(input);

    const steps = [
        { text: '正在分析意图...', duration: 1500 },
        ...(isTaskDecomposition ? [
            { text: '正在构建工作结构(WBS)...', duration: 2500 },
            { text: '正在拆解子任务...', duration: 2500 },
        ] : []),
        ...(isCalendar ? [
            { text: '正在检查日历冲突...', duration: 1500 },
            { text: '正在规划日程...', duration: 1500 },
        ] : []),
        ...(isSearch ? [
            { text: '正在检索知识库...', duration: 2000 },
            { text: '正在整合信息...', duration: 2000 },
        ] : []),
        { text: '正在调用工具...', duration: 2000 },
        { text: '正在生成回答...', duration: 3000 },
        { text: '正在完善细节...', duration: 5000 },
    ];

    useEffect(() => {
        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout>;

        const runNextStep = (currentIndex: number) => {
            if (!isMounted) return;

            // Fade in text
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }).start();

            const currentDuration = steps[currentIndex]?.duration || 2000;
            timeoutId = setTimeout(() => {
                if (!isMounted || currentIndex >= steps.length - 1) return;

                // Fade out before next text
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.ease),
                }).start(() => {
                    if (isMounted) {
                        setStepIndex(currentIndex + 1);
                        runNextStep(currentIndex + 1);
                    }
                });
            }, currentDuration);
        };

        runNextStep(0);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [input]);

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 600,
                        delay,
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
            ).start();
        };

        animate(dot1, 0);
        animate(dot2, 200);
        animate(dot3, 400);
    }, []);

    const getDotStyle = (dot: Animated.Value) => ({
        opacity: dot.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
        }),
        transform: [{
            scale: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.2],
            }),
        }],
    });

    const currentText = steps[stepIndex]?.text || '正在思考...';

    return (
        <View style={styles.container}>
            <View style={styles.avatar}>
                <IconSymbol name="sparkles" size={16} color="#FFF" />
            </View>
            <View style={styles.bubble}>
                <View style={styles.content}>
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <ThemedText style={styles.text}>{currentText}</ThemedText>
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
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderBottomLeftRadius: 4,
        backgroundColor: Colors.light.surface,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        marginRight: 6,
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
