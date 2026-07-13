import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Typography, Colors } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'defaultSemiBold' | 'title' | 'subtitle' | 'link' | 'jumbo' | 'heading' | 'subheading' | 'caption' | 'label';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const defaultColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const captionColor = useThemeColor(
    { light: Colors.light.textSecondary, dark: Colors.dark.textSecondary },
    'textSecondary'
  );
  const linkColor = useThemeColor(
    { light: Colors.light.primary, dark: Colors.dark.primary },
    'primary'
  );

  const semanticColor = type === 'caption' ? captionColor : type === 'link' ? linkColor : defaultColor;

  return (
    <Text
      style={[
        { color: semanticColor },
        type === 'default' ? styles.default : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'jumbo' ? styles.jumbo : undefined,
        type === 'heading' ? styles.heading : undefined,
        type === 'subheading' ? styles.subheading : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'label' ? styles.label : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    fontWeight: Typography.weights.regular,
  },
  defaultSemiBold: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    fontWeight: Typography.weights.semibold,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.sizes.xxl * Typography.lineHeights.tight,
  },
  subtitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    lineHeight: Typography.sizes.xl * Typography.lineHeights.normal,
  },
  link: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    textDecorationLine: 'underline',
  },
  jumbo: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.sizes.xxxl * Typography.lineHeights.tight,
  },
  heading: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.sizes.lg * Typography.lineHeights.normal,
  },
  subheading: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  caption: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.regular,
    lineHeight: Typography.sizes.xs * Typography.lineHeights.relaxed,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.tight,
  },
});
