import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, LogOut, User, ChevronDown } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';

/* --------------------------------------------------------------------------
   Route → Title mapping
   -------------------------------------------------------------------------- */

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/leads': 'Lead Pipeline',
  '/tasks': 'Tasks',
  '/insights': 'AI Insights',
  '/settings': 'Settings',
};

/**
 * Resolve page title from pathname.
 * Falls back to capitalized first segment for dynamic routes like /customers/:id.
 */
function resolveTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  const base = '/' + pathname.split('/').filter(Boolean)[0];
  if (ROUTE_TITLES[base]) return ROUTE_TITLES[base];

  const segment = pathname.split('/').filter(Boolean)[0] || 'Dashboard';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */

export default function Navbar() {
  const location = useLocation();
  const title = resolveTitle(location.pathname);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const notifications = useUiStore((s) => s.notifications);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <header
      className="
        sticky top-0 z-30 flex h-[var(--navbar-height)] items-center
        justify-between border-b border-border bg-base-surface/80
        px-6 backdrop-blur-md
      "
    >
      {/* Page title */}
      <h1 className="text-lg font-semibold text-text-primary tracking-tight">
        {title}
      </h1>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          aria-label="Notifications"
          className="
            relative flex h-9 w-9 items-center justify-center rounded-md
            text-text-secondary transition-colors hover:bg-base-elevated
            hover:text-text-primary
          "
        >
          <Bell size={18} />
          {notifications.length > 0 && (
            <span
              className="
                absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center
                justify-center rounded-full bg-danger px-1 text-2xs font-bold
                text-white
              "
            >
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>

        {/* User dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="
              flex items-center gap-2 rounded-md px-2 py-1.5
              text-sm text-text-secondary transition-colors
              hover:bg-base-elevated hover:text-text-primary
            "
          >
            <div
              className="
                flex h-7 w-7 items-center justify-center rounded-full
                bg-accent/15 text-xs font-semibold text-accent
              "
            >
              {initials}
            </div>
            <span className="hidden sm:inline max-w-[120px] truncate">
              {user?.name || 'User'}
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className="
                absolute right-0 top-full mt-1 w-56 rounded-lg border
                border-border bg-base-elevated p-1.5 shadow-lg
                animate-slide-up z-50
              "
            >
              {/* User info header */}
              <div className="border-b border-border px-3 py-2.5 mb-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {user?.email || ''}
                </p>
                {user?.role && (
                  <span
                    className="
                      mt-1.5 inline-block rounded-full bg-accent/10 px-2 py-0.5
                      text-2xs font-medium text-accent capitalize
                    "
                  >
                    {user.role.replace('_', ' ')}
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                }}
                className="
                  flex w-full items-center gap-2.5 rounded-md px-3 py-2
                  text-sm text-text-secondary transition-colors
                  hover:bg-base-surface hover:text-text-primary
                "
              >
                <User size={15} />
                Profile
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="
                  flex w-full items-center gap-2.5 rounded-md px-3 py-2
                  text-sm text-danger transition-colors
                  hover:bg-danger/10
                "
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
