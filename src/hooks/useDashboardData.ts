import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TestfallErfassung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [testfallErfassung, setTestfallErfassung] = useState<TestfallErfassung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [testfallErfassungData] = await Promise.all([
        LivingAppsService.getTestfallErfassung(),
      ]);
      setTestfallErfassung(testfallErfassungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [testfallErfassungData] = await Promise.all([
          LivingAppsService.getTestfallErfassung(),
        ]);
        setTestfallErfassung(testfallErfassungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  return { testfallErfassung, setTestfallErfassung, loading, error, fetchAll };
}