import { t } from './index';

/** "2:22 PM" from a date, in the device's local time (UX screen 5). */
export function formatClockTime(date: Date): string {
  const hours = date.getHours();
  return t('time.clock', {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: String(date.getMinutes()).padStart(2, '0'),
    period: t(hours < 12 ? 'time.am' : 'time.pm'),
  });
}
