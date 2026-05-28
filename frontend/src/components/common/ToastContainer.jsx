import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import useUiStore from '../../store/uiStore';

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP = {
  success: {
    bg: 'bg-[var(--color-success-muted)]',
    border: 'border-success/30',
    icon: 'text-success',
  },
  error: {
    bg: 'bg-[var(--color-danger-muted)]',
    border: 'border-danger/30',
    icon: 'text-danger',
  },
  warning: {
    bg: 'bg-[var(--color-warning-muted)]',
    border: 'border-warning/30',
    icon: 'text-warning',
  },
  info: {
    bg: 'bg-[var(--color-info-muted)]',
    border: 'border-[var(--color-info)]/30',
    icon: 'text-[var(--color-info)]',
  },
};

/**
 * Global toast notification container.
 * Reads from uiStore.notifications and renders stacked toasts
 * in the top-right corner with slide-in animation.
 */
export default function ToastContainer() {
  const notifications = useUiStore((s) => s.notifications);
  const removeNotification = useUiStore((s) => s.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="
        fixed right-4 top-4 z-[100] flex flex-col gap-2
        max-h-[calc(100vh-2rem)] overflow-hidden pointer-events-none
      "
    >
      {notifications.map((n) => {
        const Icon = ICON_MAP[n.type] || Info;
        const colors = COLOR_MAP[n.type] || COLOR_MAP.info;

        return (
          <div
            key={n.id}
            className={`
              pointer-events-auto flex items-start gap-3 rounded-lg
              border px-4 py-3 shadow-lg backdrop-blur-sm
              animate-toast-in min-w-[320px] max-w-[420px]
              ${colors.bg} ${colors.border}
            `}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${colors.icon}`} />
            <p className="flex-1 text-sm text-text-primary leading-snug">
              {n.message}
            </p>
            <button
              onClick={() => removeNotification(n.id)}
              className="
                shrink-0 rounded p-0.5 text-text-secondary
                transition-colors hover:text-text-primary
              "
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
