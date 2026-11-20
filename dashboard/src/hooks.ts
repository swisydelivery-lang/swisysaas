import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ar } from './messages';

export function errText(e: unknown): string {
  return ar(e instanceof Error ? e.message : 'حدث خطأ');
}

export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError('');
    } catch (e) {
      setError(errText(e));
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload };
}
