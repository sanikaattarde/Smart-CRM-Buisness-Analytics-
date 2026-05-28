import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes';
import ToastContainer from './components/common/ToastContainer';
import useAuthStore from './store/authStore';

/**
 * Root application component.
 * - Hydrates auth session on mount (silent refresh from persisted token)
 * - Renders the router once hydration settles
 * - Mounts the global toast notification layer
 */
export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="h-10 w-10 rounded-xl bg-accent animate-pulse" />
          <p className="text-sm text-text-secondary">Loading SmartCRM…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
    </>
  );
}
