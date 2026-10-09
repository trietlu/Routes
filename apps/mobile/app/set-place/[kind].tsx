import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '../../features/placeholder/PlaceholderScreen';
import { t } from '../../i18n';

/** S2, Set Home or Work (R-18). */
export default function SetPlaceScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  return (
    <PlaceholderScreen
      title={t(kind === 'work' ? 'screen.setPlace.work' : 'screen.setPlace.home')}
    />
  );
}
