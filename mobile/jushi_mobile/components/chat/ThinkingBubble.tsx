import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';

export function ThinkingBubble() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

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

    return (
        <View style={styles.container}>
            <View style={styles.avatar}>
                <IconSymbol name="sparkles" size={16} color="#FFF" />
            </View>
            <View style={styles.bubble}>
                <View style={styles.content}>
                    <ThemedText style={styles.text}>正在思考</ThemedText>
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
