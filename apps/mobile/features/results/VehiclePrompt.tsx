import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEFAULT_VEHICLE, formatMoney } from '@routes/routing-core';
import { coreT, t } from '../../i18n';
import { useTrip, useVehicle } from '../../state';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { useStorage } from '../app/services';
import { AppText } from '../common/AppText';
import { CloseIcon } from '../common/icons';

/**
 * FR-22: on Cheapest with the default vehicle, say which defaults are in use
 * and offer to set the vehicle, until dismissed or a vehicle is saved.
 */
export function VehiclePrompt() {
  const theme = useTheme();
  const router = useRouter();
  const { preferences } = useStorage();
  const mode = useTrip((s) => s.mode);
  const isUserSet = useVehicle((s) => s.vehicle.isUserSet);
  // null until loaded, so the banner never flashes for users who dismissed it.
  const [shown, setShown] = useState<boolean | null>(null);

  useEffect(() => {
    void preferences.getCheapestVehiclePromptShown().then(setShown, () => setShown(true));
  }, [preferences]);

  if (mode !== 'cheapest' || isUserSet || shown !== false) return null;

  const dismiss = () => {
    setShown(true);
    void preferences.setCheapestVehiclePromptShown(true).catch(() => undefined);
  };

  return (
    <View
      testID="vehicle-prompt"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
        },
      ]}
    >
      <View style={[styles.text, { gap: 2 }]}>
        <AppText variant="secondary">
          {t('results.vehiclePrompt', {
            mpg: DEFAULT_VEHICLE.mpg,
            price: formatMoney(DEFAULT_VEHICLE.pricePerGallon, coreT),
          })}
        </AppText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('results.setVehicle')}
          onPress={() => router.push('/vehicle')}
          testID="prompt-set-vehicle"
          style={styles.target}
        >
          <AppText variant="secondary" style={{ color: theme.colors.accent, fontWeight: '700' }}>
            {t('results.setVehicle')}
          </AppText>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('results.dismiss')}
        onPress={dismiss}
        testID="prompt-dismiss"
        style={[styles.target, styles.center]}
      >
        <CloseIcon color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingLeft: 12 },
  text: { flex: 1, paddingVertical: 6 },
  target: { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET, justifyContent: 'center' },
  center: { alignItems: 'center' },
});
