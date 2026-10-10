import { useEffect } from 'react';
import { type CurrentLocation } from '../../location';
import { useTrip } from '../../state';

/** With location available and no start chosen, the trip starts here (FR-2). */
export function useDefaultStart(location: CurrentLocation): void {
  const start = useTrip((s) => s.start);
  const setStart = useTrip((s) => s.setStart);
  const ready = location.state === 'ready';
  useEffect(() => {
    if (ready && start === null) setStart('current');
  }, [ready, start, setStart]);
}
