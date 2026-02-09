import React, { useState } from 'react';
import { TextInput, StyleSheet, View, TextInputProps, Platform } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors, BorderRadius, Spacing, Typography } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type InputProps = TextInputProps & {
    label?: string;
    error?: string | null;
    containerStyle?: View['props']['style'];
};

export function Input({ label, error, containerStyle, style, ...rest }: InputProps) {
    const [isFocused, setIsFocused] = useState(false);

    const textColor = useThemeColor({}, 'text');
    const placeholderColor = useThemeColor({ light: Colors.light.textSecondary, dark: Colors.dark.textSecondary }, 'textSecondary');
    const borderColor = useThemeColor({}, 'border');
    const primaryColor = useThemeColor({}, 'primary');
    const errorColor = useThemeColor({}, 'error');
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');

    const activeBorderColor = error ? errorColor : (isFocused ? primaryColor : borderColor);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <ThemedText type="label" style={styles.label}>
                    {label}
                </ThemedText>
            )}
            <TextInput
                style={[
                    styles.input,
                    {
                        color: textColor,
                        backgroundColor: surfaceColor,
                        borderColor: activeBorderColor,
                    },
                    style,
                ]}
                placeholderTextColor={placeholderColor}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                {...rest}
            />
            {error && (
                <ThemedText style={{ color: errorColor, marginTop: Spacing.xs }} type="caption">
                    {error}
                </ThemedText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
    },
    label: {
        marginBottom: Spacing.xs,
    },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        fontSize: Typography.sizes.base,
    },
});
