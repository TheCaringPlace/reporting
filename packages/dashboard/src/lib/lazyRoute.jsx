import { useState, useEffect } from 'preact/hooks';

/**
 * Lazy-load a route component with a loading fallback.
 * Avoids preact/compat's Suspense which can conflict with preact-router.
 * Vite still code-splits on the dynamic import.
 * @param {() => Promise<{ default: import('preact').ComponentType }>} loader
 * @param {import('preact').VNode} [fallback]
 * @returns {import('preact').ComponentType}
 */
export function lazyRoute(loader, fallback = null) {
  return function LazyRoute(props) {
    const [Component, setComponent] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      loader()
        .then((m) => {
          if (!cancelled && m?.default) {
            setComponent(() => m.default);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []);

    if (error) {
      return <div class="loading">Failed to load: {error.message}</div>;
    }
    if (!Component) {
      return fallback ?? <div class="loading">Loading…</div>;
    }
    return <Component {...props} />;
  };
}
