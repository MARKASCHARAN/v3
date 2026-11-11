'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';

export function useAsyncResource<T>(fetcher: () => Promise<T>, fallbackError: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : fallbackError);
    } finally {
      setLoading(false);
    }
  }, [fetcher, fallbackError]);

  useEffect(() => {
    let active = true;
    fetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiClientError ? err.message : fallbackError);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetcher, fallbackError]);

  return { data, error, setError, loading, reload };
}

