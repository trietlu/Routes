import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useStorage } from '../features/app/services';
import { HomeScreen } from '../features/home/HomeScreen';

/** Screen 2, Home. On first launch, onboarding comes first (FR-1). */
export default function HomeRoute() {
  const { preferences } = useStorage();
  const [promptShown, setPromptShown] = useState<boolean | null>(null);
  useEffect(() => {
    void preferences.getLocationPromptShown().then(setPromptShown);
  }, [preferences]);
  if (promptShown === null) return null;
  if (!promptShown) return <Redirect href="/onboarding" />;
  return <HomeScreen />;
}
