import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { type Place, type SavedKind } from '../../storage/places';
import { useStorage } from '../app/services';

/** Recents and saved Home/Work, reloaded whenever the screen comes into view. */
export function useStoredPlaces() {
  const { places } = useStorage();
  const [recents, setRecents] = useState<Place[]>([]);
  const [saved, setSaved] = useState<Record<SavedKind, Place | null>>({ home: null, work: null });

  const reload = useCallback(async () => {
    const [list, home, work] = await Promise.all([
      places.listRecents(),
      places.getSaved('home'),
      places.getSaved('work'),
    ]);
    setRecents(list);
    setSaved({ home, work });
  }, [places]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { recents, saved, reload };
}
