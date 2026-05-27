import { View, StyleSheet } from 'react-native';

export default function TabBarBackground() {
    return (
        <View style={styles.container} />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.85)', // translucent white
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
    },
});
