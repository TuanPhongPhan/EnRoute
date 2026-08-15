import { Suspense } from 'react';
import { JourneyRouteSelector } from '@/components/journey-route-selector';

export default function JourneyPage() {
  return (
    <Suspense fallback={null}>
      <JourneyRouteSelector />
    </Suspense>
  );
}
