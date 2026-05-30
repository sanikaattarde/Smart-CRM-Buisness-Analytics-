import React, { useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import useCustomerStore from '../../store/customerStore';
import useUiStore from '../../store/uiStore';
import CustomerModal from './components/CustomerModal';

export default function CustomersPage() {
  const { customers, loading, fetchCustomers, filters, setFilters } = useCustomerStore();
  const openModal = useUiStore((state) => state.openModal);
  const activeModal = useUiStore((state) => state.activeModal);
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    fetchCustomers();
  }, [filters, fetchCustomers]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (filters.search !== searchInput) {
        setFilters({ search: searchInput });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, filters.search, setFilters]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
        <button
          onClick={() => openModal('createCustomer')}
          className="h-10 px-4 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4 bg-base-elevated border border-border rounded-xl">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search customers by name, email, or company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-md bg-base border border-border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="card overflow-hidden bg-base-elevated border border-border rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="text-xs uppercase bg-base text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Company</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Health Score</th>
                <th className="px-6 py-4 font-semibold">Tags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-6 py-4"><div className="h-4 bg-base rounded w-32 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-base rounded w-24 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-base rounded w-40 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-base rounded w-12 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-base rounded w-20 animate-pulse" /></td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <p className="text-text-secondary">No customers found.</p>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border hover:bg-base/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">{customer.name}</td>
                    <td className="px-6 py-4">{customer.company}</td>
                    <td className="px-6 py-4">{customer.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        customer.health_score >= 80 ? 'bg-green-500/10 text-green-500' :
                        customer.health_score >= 50 ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {customer.health_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {customer.tags?.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'createCustomer' && <CustomerModal />}
    </div>
  );
}
