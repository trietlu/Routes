import { useLocalSearchParams } from 'expo-router';
import { SearchScreen } from '../features/search/SearchScreen';

/** Screen 3, Search for the From or To field (`?field=from|to`; To by default). */
export default function SearchRoute() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  return <SearchScreen target={{ kind: 'trip', field: field === 'from' ? 'from' : 'to' }} />;
}
