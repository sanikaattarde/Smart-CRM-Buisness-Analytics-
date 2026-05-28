import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Lightbulb,
  Settings,
  ChevronLeft,
  Zap,
} from 'lucide-react';
import useUiStore from '../../store/uiStore';

/* --------------------------------------------------------------------------
   Navigation Items
   -------------------------------------------------------------------------- */

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/customers',  label: 'Customers',    icon: Users },
  { to: '/leads',      label: 'Leads',        icon: Kanban },
  { to: '/tasks',      label: 'Tasks',        icon: CheckSquare },
  { to: '/insights',   label: 'AI Insights',  icon: Lightbulb },
];

const BOTTOM_ITEMS = [
  { to: '/settings', label: 'Settings', icon: Settings },
];

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */

export default function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const location = useLocation();

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 flex h-screen flex-col
        border-r border-border bg-base-surface
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'}
      `}
    >
      {/* ------ Brand ------ */}
      <div className="flex h-[var(--navbar-height)] items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Zap size={16} className="text-white" />
        </div>
        <span
          className={`
            text-base font-bold tracking-tight text-text-primary
            transition-opacity duration-200
            ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'}
          `}
        >
          SmartCRM
        </span>
      </div>

      {/* ------ Main Nav ------ */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              active={location.pathname.startsWith(item.to)}
            />
          ))}
        </ul>
      </nav>

      {/* ------ Bottom Section ------ */}
      <div className="border-t border-border px-3 py-3">
        <ul className="space-y-1">
          {BOTTOM_ITEMS.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              active={location.pathname.startsWith(item.to)}
            />
          ))}
        </ul>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`
            mt-3 flex w-full items-center justify-center gap-2 rounded-md
            py-2 text-sm text-text-secondary transition-colors
            hover:bg-base-elevated hover:text-text-primary
          `}
        >
          <ChevronLeft
            size={16}
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

/* --------------------------------------------------------------------------
   Sidebar Link
   -------------------------------------------------------------------------- */

function SidebarLink({ item, collapsed, active }) {
  const Icon = item.icon;

  return (
    <li>
      <NavLink
        to={item.to}
        className={`
          group relative flex items-center gap-3 rounded-md px-3 py-2
          text-sm font-medium transition-colors duration-200
          ${active
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:bg-base-elevated hover:text-text-primary'
          }
        `}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
        )}

        <Icon size={18} className="shrink-0" />

        <span
          className={`
            whitespace-nowrap transition-all duration-200
            ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'}
          `}
        >
          {item.label}
        </span>

        {/* Tooltip for collapsed state */}
        {collapsed && (
          <span
            className="
              pointer-events-none absolute left-full ml-3 rounded-md
              bg-base-elevated px-2.5 py-1 text-xs font-medium text-text-primary
              opacity-0 shadow-lg transition-opacity duration-200
              group-hover:pointer-events-auto group-hover:opacity-100
              border border-border whitespace-nowrap z-50
            "
          >
            {item.label}
          </span>
        )}
      </NavLink>
    </li>
  );
}
