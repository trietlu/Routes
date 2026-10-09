import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '../../features/placeholder/PlaceholderScreen';
import { t } from '../../i18n';

/** Screen 5, Route detail for route A, B or C (R-21). */
export default function RouteDetailScreen() {
  const { letter } = useLocalSearchParams<{ letter: string }>();
  return <PlaceholderScreen title={t('screen.route.title', { letter: letter ?? '' })} />;
}
