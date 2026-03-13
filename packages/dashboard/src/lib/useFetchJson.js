import { useState, useEffect } from 'preact/hooks';

/**
 * Fetch JSON from a URL. Returns { data, loading, error }.
 * @param {string} url - URL to fetch (e.g. './data/service-report.json')
 * @returns {{ data: any, loading: boolean, error: Error | null }}
 */
export function useFetchJson(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
}
