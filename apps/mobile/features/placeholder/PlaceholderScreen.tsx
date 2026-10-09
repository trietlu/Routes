import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { t } from '../../i18n';

/** Stand-in for a screen until its issue lands (R-16 to R-23). */
export function PlaceholderScreen({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        <AppText secondary>{t('placeholder.body')}</AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
