import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PageWrapper from './PageWrapper';
import useUiStore from '../../store/uiStore';

/**
 * Master layout shell that wraps all authenticated pages.
 * Composes Sidebar + Navbar + PageWrapper around the <Outlet />.
 * Handles responsive sidebar collapse on small viewports.
 */
export default function AppLayout() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  // Auto-collapse sidebar on narrow viewports
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');

    function handleChange(e) {
      setSidebarCollapsed(e.matches);
    }

    // Set initial state
    handleChange(mql);

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [setSidebarCollapsed]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <div
        className="flex flex-1 flex-col transition-all duration-300 ease-in-out"
        style={{
          marginLeft: collapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)',
        }}
      >
        <Navbar />
        <PageWrapper>
          <Outlet />
        </PageWrapper>
      </div>
    </div>
  );
}
