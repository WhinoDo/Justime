import React from 'react';
import { View, StyleSheet, ViewProps, Platform } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BorderRadius, Spacing, Colors } from '@/constants/theme';

export type CardProps = ViewProps & {
    variant?: 'elevated' | 'outlined' | 'flat';
    lightColor?: string;
    darkColor?: string;
};

export function Card({ style, variant = 'elevated', lightColor, darkColor, ...rest }: CardProps) {
    const backgroundColor = useThemeColor(
        { light: lightColor || Colors.light.surface, dark: darkColor || Colors.dark.surface },
        'surface'
    );

    const borderColor = useThemeColor(
        { light: Colors.light.border, dark: Colors.dark.border },
        'border'
    );

    const shadowColor = useThemeColor(
        { light: Colors.light.shadow, dark: Colors.dark.shadow },
        'shadow'
    );

    return (
        <View
            style={[
                styles.base,
                { backgroundColor },
                variant === 'outlined' && { borderWidth: 1, borderColor },
                variant === 'elevated' && getShadowStyle(shadowColor),
                style,
            ]}
            {...rest}
        />
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginVertical: Spacing.sm,
    },
});

const getShadowStyle = (shadowColor: string) => Platform.select({
    ios: {
        shadowColor: shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    android: {
        elevation: 3,
        shadowColor: shadowColor,
    },
    default: {
        shadowColor: shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
});
