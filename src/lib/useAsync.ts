import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { friendlyError } from './errors';

export type AsyncState<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  setData: (data: T) => void;
};

// Minimal server-state hook: loads on mount/deps change, exposes reload for
// retry buttons and refresh for pull-to-refresh, and ignores stale responses.
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (mode: 'load' | 'refresh') => {
    const id = ++requestId.current;
    if (mode === 'load') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const result = await loadRef.current();
      if (id === requestId.current) {
        setData(result);
      }
    } catch (caught) {
      if (id === requestId.current) {
        setError(friendlyError(caught));
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void run('load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    error,
    loading,
    refreshing,
    reload: () => run('load'),
    refresh: () => run('refresh'),
    setData,
  };
}
