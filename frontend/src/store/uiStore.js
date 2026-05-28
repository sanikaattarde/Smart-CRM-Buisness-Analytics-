import { create } from 'zustand';

/** Auto-incrementing notification ID to guarantee unique keys. */
let notificationId = 0;

/** Default auto-dismiss delay in milliseconds. */
const DEFAULT_DISMISS_MS = 5000;

const useUiStore = create((set, get) => ({
  sidebarCollapsed: false,
  notifications: [],
  activeModal: null,
  modalProps: null,

  // -------------------------------------------------------------------------
  // Sidebar
  // -------------------------------------------------------------------------

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  /**
   * Push a toast notification.
   *
   * @param {{ type: 'success'|'error'|'warning'|'info', message: string, duration?: number }} notification
   * @returns {number} Notification ID for programmatic removal.
   */
  addNotification: (notification) => {
    const id = ++notificationId;
    const entry = {
      id,
      type: notification.type || 'info',
      message: notification.message,
      createdAt: Date.now(),
    };

    set((state) => ({
      notifications: [...state.notifications, entry],
    }));

    // Auto-dismiss
    const duration = notification.duration ?? DEFAULT_DISMISS_MS;
    if (duration > 0) {
      setTimeout(() => get().removeNotification(id), duration);
    }

    return id;
  },

  /**
   * @param {number} id
   */
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => set({ notifications: [] }),

  // -------------------------------------------------------------------------
  // Modal
  // -------------------------------------------------------------------------

  /**
   * @param {string} modalName Unique modal identifier (e.g. 'createCustomer', 'confirmDelete').
   * @param {object} [props] Arbitrary props passed to the modal component.
   */
  openModal: (modalName, props = null) => set({ activeModal: modalName, modalProps: props }),

  closeModal: () => set({ activeModal: null, modalProps: null }),
}));

export default useUiStore;
