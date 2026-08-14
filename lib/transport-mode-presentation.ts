import type { TransportMode } from '@/lib/transport-provider';

// Transport type is distinct from live status: reserve green, amber, and red status
// treatments for on-time, delay, and risk messages elsewhere in the journey UI.
export const transportModeIconClasses: Record<TransportMode, string> = {
  walk: 'bg-surface-muted text-text-muted',
  subway: 'bg-info-soft text-info',
  tram: 'bg-info-soft text-info',
  bus: 'bg-warning-soft text-warning',
  regional_train: 'bg-primary-100 text-primary-700',
  ice: 'bg-accent-100 text-accent-600',
  other: 'bg-surface-muted text-text-secondary',
};
