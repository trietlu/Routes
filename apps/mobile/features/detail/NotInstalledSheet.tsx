import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { LinkButton, PrimaryButton } from '../common/Button';

interface NotInstalledSheetProps {
  visible: boolean;
  onOpenInBrowser: () => void;
  onGetGoogleMaps: () => void;
  onCancel: () => void;
}

/** S3, "Google Maps isn't installed" (FR-17). */
export function NotInstalledSheet({
  visible,
  onOpenInBrowser,
  onGetGoogleMaps,
  onCancel,
}: NotInstalledSheetProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable accessible={false} style={styles.backdrop} onPress={onCancel} />
      <View
        accessibilityViewIsModal
        testID="not-installed-sheet"
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
          },
        ]}
      >
        <AppText variant="title" accessibilityRole="header">
          {t('notInstalled.title')}
        </AppText>
        <AppText secondary>{t('notInstalled.body')}</AppText>
        <PrimaryButton
          label={t('notInstalled.openInBrowser')}
          onPress={onOpenInBrowser}
          testID="open-in-browser"
        />
        <LinkButton
          label={t('notInstalled.getGoogleMaps')}
          onPress={onGetGoogleMaps}
          testID="get-google-maps"
        />
        <LinkButton
          label={t('notInstalled.cancel')}
          onPress={onCancel}
          testID="not-installed-cancel"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
