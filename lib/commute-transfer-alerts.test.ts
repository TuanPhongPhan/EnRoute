import { describe, expect, it } from 'vitest';
import { createTransferAlerts, transferAlertLeadMinutes } from '@/lib/commute-transfer-alerts';
import type { TransportJourneyLeg } from '@/lib/transport-provider';

const at = (minutes: number) => new Date(Date.UTC(2030, 0, 1, 8, minutes)).toISOString();
const leg = (mode: TransportJourneyLeg['mode'], label: string, destination: string, arrivalMinute: number): TransportJourneyLeg => ({
  mode,
  label,
  origin: 'Origin',
  destination,
  scheduledDeparture: at(arrivalMinute - 10),
  actualDeparture: at(arrivalMinute - 10),
  scheduledArrival: at(arrivalMinute),
  actualArrival: at(arrivalMinute),
  delayMinutes: 0,
});

describe('createTransferAlerts', () => {
  it('creates an alert five minutes before a vehicle-to-vehicle change', () => {
    const alerts = createTransferAlerts([leg('subway', 'U2', 'München Hbf', 30), leg('regional_train', 'RE9', 'Neu-Ulm', 90)]);
    expect(alerts).toEqual([
      expect.objectContaining({
        sequence: 0,
        station: 'München Hbf',
        nextServiceLabel: 'RE9',
        alertAt: at(30 - transferAlertLeadMinutes),
      }),
    ]);
  });

  it('keeps an alert when a short walk sits between two services', () => {
    const alerts = createTransferAlerts([
      leg('subway', 'U2', 'München Hbf', 30),
      leg('walk', 'Walk', 'Platform 14', 35),
      leg('regional_train', 'RE9', 'Neu-Ulm', 90),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.nextServiceDestination).toBe('Neu-Ulm');
  });

  it('does not notify for the final walk home', () => {
    expect(createTransferAlerts([leg('regional_train', 'RE9', 'Neu-Ulm', 90), leg('walk', 'Walk', 'Home', 100)])).toEqual([]);
  });
});
