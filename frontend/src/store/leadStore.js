import { create } from 'zustand';
import api from '../services/api';

const useLeadStore = create((set, get) => ({
  leads: [],
  stages: [],
  total: 0,
  loading: false,
  stagesLoading: false,
  error: null,
  filters: {
    stage: '',
    assignedTo: '',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }));
  },

  // -------------------------------------------------------------------------
  // Pipeline stages
  // -------------------------------------------------------------------------

  fetchStages: async () => {
    set({ stagesLoading: true });

    try {
      const { data } = await api.get('/leads/stages');
      set({ stages: data.data, stagesLoading: false });
    } catch (err) {
      set({ stagesLoading: false, error: err });
    }
  },

  // -------------------------------------------------------------------------
  // Leads CRUD
  // -------------------------------------------------------------------------

  fetchLeads: async () => {
    const { filters } = get();
    set({ loading: true, error: null });

    try {
      const params = {
        ...(filters.stage && { stage: filters.stage }),
        ...(filters.assignedTo && { assigned_to: filters.assignedTo }),
        ...(filters.search && { search: filters.search }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.sortOrder && { sortOrder: filters.sortOrder }),
      };

      const { data } = await api.get('/leads', { params });
      set({
        leads: data.data,
        total: data.meta?.total ?? data.data.length,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err });
    }
  },

  /**
   * @param {object} payload Lead creation payload.
   * @returns {Promise<object>}
   */
  createLead: async (payload) => {
    set({ error: null });

    try {
      const { data } = await api.post('/leads', payload);
      const created = data.data;

      set((state) => ({
        leads: [created, ...state.leads],
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
   * @param {object} payload
   * @returns {Promise<object>}
   */
  updateLead: async (id, payload) => {
    set({ error: null });

    try {
      const { data } = await api.put(`/leads/${id}`, payload);
      const updated = data.data;

      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? updated : l)),
      }));

      return updated;
    } catch (err) {
      set({ error: err });
      throw err;
    }
  },

  /**
   * Optimistic stage move for Kanban drag-and-drop.
   * Immediately updates local state, then syncs with the server.
   * Rolls back on failure and surfaces the error.
   *
   * @param {string} leadId
   * @param {string} newStageId
   */
  moveLead: async (leadId, newStageId) => {
    const { leads } = get();
    const target = leads.find((l) => l.id === leadId);
    if (!target) return;

    const previousStageId = target.pipeline_stage_id;

    // Optimistic update
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, pipeline_stage_id: newStageId } : l
      ),
    }));

    try {
      const { data } = await api.patch(`/leads/${leadId}/stage`, {
        pipeline_stage_id: newStageId,
      });

      // Replace with server-confirmed state.
      set((state) => ({
        leads: state.leads.map((l) => (l.id === leadId ? data.data : l)),
      }));
    } catch (err) {
      // Rollback
      set((state) => ({
        leads: state.leads.map((l) =>
          l.id === leadId ? { ...l, pipeline_stage_id: previousStageId } : l
        ),
        error: err,
      }));
    }
  },

  /**
   * @param {string} id
   */
  deleteLead: async (id) => {
    set({ error: null });

    try {
      await api.delete(`/leads/${id}`);
      set((state) => ({
        leads: state.leads.filter((l) => l.id !== id),
        total: state.total - 1,
      }));
    } catch (err) {
      set({ error: err });
      throw err;
    }
  },

  // -------------------------------------------------------------------------
  // Derived selectors
  // -------------------------------------------------------------------------

  /**
   * Returns leads grouped by pipeline_stage_id.
   * Use as: useLeadStore(state => state.leadsByStage())
   * @returns {Record<string, object[]>}
   */
  leadsByStage: () => {
    const { leads, stages } = get();
    const grouped = {};

    for (const stage of stages) {
      grouped[stage.id] = [];
    }

    for (const lead of leads) {
      const key = lead.pipeline_stage_id;
      if (grouped[key]) {
        grouped[key].push(lead);
      } else {
        grouped[key] = [lead];
      }
    }

    return grouped;
  },

  reset: () =>
    set({
      leads: [],
      stages: [],
      total: 0,
      loading: false,
      stagesLoading: false,
      error: null,
      filters: { stage: '', assignedTo: '', search: '', sortBy: 'created_at', sortOrder: 'desc' },
    }),
}));

export default useLeadStore;
