import { useLocalSearchParams } from 'expo-router';
import { SearchScreen } from '../../features/search/SearchScreen';

/** S2, Set Home or Work: Search that saves the pick. */
export default function SetPlaceRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  return <SearchScreen target={{ kind: 'saved', saved: kind === 'work' ? 'work' : 'home' }} />;
}
