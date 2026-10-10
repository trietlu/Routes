import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FuelType } from '@routes/routing-core';
import { t } from '../../i18n';
import { useVehicle } from '../../state';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { useStorage } from '../app/services';
import { AppText } from '../common/AppText';
import { PrimaryButton } from '../common/Button';
import { BackIcon } from '../common/icons';
import { parseMpg, parsePrice } from './validation';

const FUEL_TYPES: readonly { type: FuelType; label: () => string }[] = [
  { type: 'regular', label: () => t('vehicle.regular') },
  { type: 'midgrade', label: () => t('vehicle.midgrade') },
  { type: 'premium', label: () => t('vehicle.premium') },
  { type: 'diesel', label: () => t('vehicle.diesel') },
];

/** S1, Edit vehicle (FR-19, US-10). */
export function VehicleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { preferences } = useStorage();
  const vehicle = useVehicle((s) => s.vehicle);
  const save = useVehicle((s) => s.save);
  const [mpgText, setMpgText] = useState(String(vehicle.mpg));
  const [priceText, setPriceText] = useState(vehicle.pricePerGallon.toFixed(2));
  const [fuelType, setFuelType] = useState<FuelType>(vehicle.fuelType);
  const [saving, setSaving] = useState(false);

  const mpg = parseMpg(mpgText);
  const price = parsePrice(priceText);
  const valid = mpg !== null && price !== null;

  const onSave = async () => {
    if (mpg === null || price === null) return;
    setSaving(true);
    await save({ mpg, fuelType, pricePerGallon: price });
    // A set vehicle retires the Cheapest prompt for good (FR-22).
    await preferences.setCheapestVehiclePromptShown(true).catch(() => undefined);
    router.back();
  };

  const inputStyle = [
    styles.input,
    theme.typography.body,
    {
      color: theme.colors.text,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
  ];

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: theme.spacing.md, gap: theme.spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('vehicle.back')}
          onPress={() => router.back()}
          testID="vehicle-back"
          style={styles.iconButton}
        >
          <BackIcon color={theme.colors.text} />
        </Pressable>
        <AppText variant="title" accessibilityRole="header">
          {t('screen.vehicle.title')}
        </AppText>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading">{t('vehicle.economy')}</AppText>
          <View style={[styles.fieldRow, { gap: theme.spacing.sm }]}>
            <TextInput
              value={mpgText}
              onChangeText={setMpgText}
              keyboardType="decimal-pad"
              accessibilityLabel={t('vehicle.economyLabel')}
              accessibilityHint={mpg === null ? t('vehicle.economyError') : undefined}
              testID="vehicle-mpg"
              style={inputStyle}
            />
            <AppText secondary>{t('vehicle.economySuffix')}</AppText>
          </View>
          {mpg === null ? (
            <AppText
              variant="caption"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.danger }}
              testID="mpg-error"
            >
              {t('vehicle.economyError')}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading">{t('vehicle.fuelType')}</AppText>
          <View
            accessibilityRole="radiogroup"
            style={[
              styles.segments,
              { backgroundColor: theme.colors.border, borderRadius: theme.radii.md },
            ]}
          >
            {FUEL_TYPES.map((option) => {
              const selected = option.type === fuelType;
              return (
                <Pressable
                  key={option.type}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label()}
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => setFuelType(option.type)}
                  testID={`fuel-${option.type}`}
                  style={[
                    styles.segment,
                    { borderRadius: theme.radii.sm },
                    selected && { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <AppText variant={selected ? 'heading' : 'body'}>{option.label()}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading">{t('vehicle.price')}</AppText>
          <View style={[styles.fieldRow, { gap: theme.spacing.sm }]}>
            <AppText secondary>{t('vehicle.pricePrefix')}</AppText>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              accessibilityLabel={t('vehicle.priceLabel')}
              accessibilityHint={price === null ? t('vehicle.priceError') : undefined}
              testID="vehicle-price"
              style={inputStyle}
            />
            <AppText secondary>{t('vehicle.priceSuffix')}</AppText>
          </View>
          {price === null ? (
            <AppText
              variant="caption"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.danger }}
              testID="price-error"
            >
              {t('vehicle.priceError')}
            </AppText>
          ) : null}
        </View>

        <AppText variant="secondary" secondary>
          {t('vehicle.helper')}
        </AppText>
        <PrimaryButton
          label={t('vehicle.save')}
          onPress={() => void onSave()}
          disabled={!valid || saving}
          testID="vehicle-save"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: MIN_TOUCH_TARGET, borderWidth: 1, paddingHorizontal: 12 },
  segments: { flexDirection: 'row', flexWrap: 'wrap', padding: 3 },
  segment: {
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
