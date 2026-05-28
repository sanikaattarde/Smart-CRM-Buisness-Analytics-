import { create } from 'zustand';
import api from '../services/api';

/** @type {import('zustand').StateCreator} */
const useCustomerStore = create((set, get) => ({
  customers: [],
  total: 0,
  page: 1,
  pageSize: 20,
  filters: {
    search: '',
    segment: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  loading: false,
  error: null,
  selectedCustomer: null,

  // -------------------------------------------------------------------------
  // Filter management
  // -------------------------------------------------------------------------

  /**
   * @param {Partial<typeof filters>} newFilters
   */
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1, // Reset to first page on filter change
    }));
  },

  setPage: (page) => set({ page }),

  // -------------------------------------------------------------------------
  // CRUD actions
  // -------------------------------------------------------------------------

  /**
   * Fetch paginated customer list with current filters.
   */
  fetchCustomers: async () => {
    const { page, pageSize, filters } = get();
    set({ loading: true, error: null });

    try {
      const params = {
        page,
        limit: pageSize,
        ...(filters.search && { search: filters.search }),
        ...(filters.segment && { segment: filters.segment }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.sortOrder && { sortOrder: filters.sortOrder }),
      };

      const { data } = await api.get('/customers', { params });
      set({
        customers: data.data,
        total: data.meta?.total ?? data.data.length,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err });
    }
  },

  /**
   * @param {string} id
   */
  fetchCustomerById: async (id) => {
    set({ loading: true, error: null });

    try {
      const { data } = await api.get(`/customers/${id}`);
      set({ selectedCustomer: data.data, loading: false });
      return data.data;
    } catch (err) {
      set({ loading: false, error: err });
      throw err;
    }
  },

  /**
   * @param {object} payload Customer creation payload.
   * @returns {Promise<object>} Created customer.
   */
  createCustomer: async (payload) => {
    set({ error: null });

    try {
      const { data } = await api.post('/customers', payload);
      const created = data.data;

      set((state) => ({
        customers: [created, ...state.customers],
        total: state.total + 1,
      }));

      return created;
    } catch (err) {
      set({ error: err });
      throw err;
    }
  },

  /**
   * @param {string} id
   * @param {object} payload Fields to update.
   * @returns {Promise<object>} Updated customer.
   */
  updateCustomer: async (id, payload) => {
    set({ error: null });

    try {
      const { data } = await api.put(`/customers/${id}`, payload);
      const updated = data.data;

      set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? updated : c)),
        selectedCustomer:
          state.selectedCustomer?.id === id ? updated : state.selectedCustomer,
      }));

      return updated;
    } catch (err) {
      set({ error: err });
      throw err;
    }
  },

  /**
   * @param {string} id
   */
  deleteCustomer: async (id) => {
    set({ error: null });

    try {
      await api.delete(`/customers/${id}`);
      set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
        total: state.total - 1,
        selectedCustomer:
          state.selectedCustomer?.id === id ? null : state.selectedCustomer,
      }));
    } catch (err) {
      set({ error: err });
      throw err;
    }
  },

  /** Reset store to initial state. */
  reset: () =>
    set({
      customers: [],
      total: 0,
      page: 1,
      filters: { search: '', segment: '', sortBy: 'created_at', sortOrder: 'desc' },
      loading: false,
      error: null,
      selectedCustomer: null,
    }),
}));

export default useCustomerStore;
