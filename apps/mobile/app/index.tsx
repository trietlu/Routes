import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useStorage } from '../features/app/services';
import { PlaceholderScreen } from '../features/placeholder/PlaceholderScreen';
import { t } from '../i18n';

/** Screen 2, Home (R-17). On first launch, onboarding comes first (FR-1). */
export default function HomeScreen() {
  const { preferences } = useStorage();
  const [promptShown, setPromptShown] = useState<boolean | null>(null);
  useEffect(() => {
    void preferences.getLocationPromptShown().then(setPromptShown);
  }, [preferences]);
  if (promptShown === null) return null;
  if (!promptShown) return <Redirect href="/onboarding" />;
  return <PlaceholderScreen title={t('screen.home.title')} />;
}
