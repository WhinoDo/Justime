import React from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const backgroundColor = useThemeColor({}, 'background');

    const handleLogout = async () => {
        await signOut();
        // Router logic might be handled by AuthContext or _layout, but ensuring redirection is good
    };

    if (!user) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor }]}>
                <View style={styles.centered}>
                    <ThemedText type="subtitle">请先登录</ThemedText>
                    <Button
                        title="去登录"
                        onPress={() => router.push('/(tabs)/')}
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
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        marginBottom: Spacing.md,
        marginLeft: Spacing.xs,
    },
    menuItem: {
        marginBottom: Spacing.sm,
        padding: 0, // Reset default card padding for button to fill
        overflow: 'hidden',
    },
    menuButton: {
        justifyContent: 'flex-start',
        paddingHorizontal: Spacing.md,
        width: '100%',
    }
});
