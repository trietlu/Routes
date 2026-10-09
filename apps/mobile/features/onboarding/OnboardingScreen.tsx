import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../i18n';
import { requestPermission } from '../../location';
import { useTheme } from '../../theme';
import { useStorage } from '../app/services';
import { AppText } from '../common/AppText';
import { LinkButton, PrimaryButton } from '../common/Button';
import { RoutesIllustration } from './RoutesIllustration';

/**
 * Screen 1 (FR-1, US-1, US-2). Shown once, before any location prompt. The
 * iOS prompt appears only when the user taps "Allow location access".
 */
export function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { preferences } = useStorage();
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await preferences.setLocationPromptShown(true).catch(() => undefined);
    router.replace('/');
  };

  const allow = async () => {
    setBusy(true);
    // Granted or denied, the app continues to Home (UX screen 1).
    await requestPermission().catch(() => undefined);
    await finish();
  };

  const enterAddress = async () => {
    await finish();
    router.push({ pathname: '/search', params: { field: 'from' } });
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      {/* Scrolls at large Dynamic Type sizes instead of clipping. */}
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.spacing.xl }]}>
        <RoutesIllustration />
        <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
          <AppText variant="duration" accessibilityRole="header">
            {t('onboarding.title')}
          </AppText>
          <AppText secondary>{t('onboarding.body')}</AppText>
        </View>
        <View style={[styles.actions, { gap: theme.spacing.sm, marginTop: theme.spacing.xxl }]}>
          <PrimaryButton
            label={t('onboarding.allow')}
            onPress={() => void allow()}
            disabled={busy}
            testID="onboarding-allow"
          />
          <LinkButton
            label={t('onboarding.enterAddress')}
            onPress={() => void enterAddress()}
            testID="onboarding-enter-address"
          />
          <AppText variant="caption" secondary style={styles.footnote}>
            {t('onboarding.footnote')}
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
  actions: { marginTop: 'auto' },
  footnote: { textAlign: 'center' },
});
