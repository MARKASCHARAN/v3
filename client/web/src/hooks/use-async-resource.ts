'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth-storage';

export function useAsyncResource<T>(fetcher: () => Promise<T>, fallbackError: string) {
  const session = useAuthSession();
  const hasToken = Boolean(session?.accessToken);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!hasToken) {
      return;
    }
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : fallbackError);
    } finally {
      setLoading(false);
    }
  }, [fetcher, fallbackError, hasToken]);

  useEffect(() => {
    if (!hasToken) {
      return;
    }
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
  }, [fetcher, fallbackError, hasToken]);

  return { data, error, setError, loading, reload };
}
