import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import useCustomerStore from '../../../store/customerStore';
import useUiStore from '../../../store/uiStore';

export default function CustomerModal() {
  const createCustomer = useCustomerStore((state) => state.createCustomer);
  const closeModal = useUiStore((state) => state.closeModal);
  const addNotification = useUiStore((state) => state.addNotification);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await createCustomer(formData);
      addNotification({ type: 'success', message: 'Customer created successfully.' });
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create customer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-base-elevated w-full max-w-md rounded-xl shadow-xl border border-border animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Add Customer</h2>
          <button onClick={closeModal} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium text-text-primary">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-text-primary">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
            <p className="text-xs text-text-secondary">Must be a valid corporate email</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company" className="block text-sm font-medium text-text-primary">Company Name</label>
            <input
              id="company"
              name="company"
              type="text"
              required
              value={formData.company}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-sm font-medium text-text-primary">Phone (Optional)</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={isLoading}
              className="h-10 px-4 rounded-md border border-border text-text-primary hover:bg-base transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 px-4 rounded-md bg-accent text-white font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors flex items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Create Customer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
