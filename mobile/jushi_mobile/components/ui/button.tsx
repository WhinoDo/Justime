import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, TouchableOpacityProps, Animated, Easing } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type ButtonProps = TouchableOpacityProps & {
    title: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
};

export function Button({
    title,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    style,
    disabled,
    ...rest
}: ButtonProps) {
    const primaryColor = useThemeColor({}, 'primary');
    const surfaceHighlightColor = useThemeColor({}, 'surfaceHighlight');
    const errorColor = useThemeColor({}, 'error');

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.timing(scaleAnim, {
            toValue: 0.96,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.ease,
        }).start();
    };

    const handlePressOut = () => {
        Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.ease,
        }).start();
    };

    const getBackgroundColor = () => {
        if (disabled) return surfaceHighlightColor;
        switch (variant) {
            case 'primary': return primaryColor;
            case 'secondary': return surfaceHighlightColor;
            case 'destructive': return errorColor;
            case 'ghost': return 'transparent';
            default: return primaryColor;
        }
    };

    const getTextColor = () => {
        if (disabled) return Colors.light.textSecondary;
        switch (variant) {
            case 'primary': return '#FFFFFF';
            case 'destructive': return '#FFFFFF';
            case 'secondary': return primaryColor;
            case 'ghost': return primaryColor;
            default: return '#FFFFFF';
        }
    };

    const getPadding = () => {
        switch (size) {
            case 'sm': return { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md };
            case 'md': return { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg };
            case 'lg': return { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl };
        }
    };

    const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

    return (
        <AnimatedTouchableOpacity
            style={[
                styles.base,
                { backgroundColor: getBackgroundColor() },
                getPadding(),
                style,
                disabled && styles.disabled,
                { transform: [{ scale: scaleAnim }] }
            ]}
            disabled={disabled || loading}
            activeOpacity={0.8}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            {...rest}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <>
                    {icon}
                    <ThemedText
                        style={[
                            styles.text,
                            { color: getTextColor() },
                            icon ? { marginLeft: Spacing.sm } : {}
                        ]}
                        type="defaultSemiBold"
                    >
                        {title}
                    </ThemedText>
                </>
            )}
        </AnimatedTouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: BorderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        textAlign: 'center',
    },
    disabled: {
        opacity: 0.6,
    },
});
