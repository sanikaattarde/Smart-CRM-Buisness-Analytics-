import React, { useState } from 'react';
import { Settings, Bell, CreditCard, Layout } from 'lucide-react';
import useUiStore from '../../store/uiStore';

// Reusable toggle switch component using standard Tailwind
function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex-1 pr-4">
        <h4 className="text-sm font-medium text-text-primary">{label}</h4>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-base ${
          checked ? 'bg-accent' : 'bg-base-surface border border-border'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-2' : '-translate-x-2'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const addNotification = useUiStore(state => state.addNotification);

  // Local state for toggles to simulate functionality
  const [settings, setSettings] = useState({
    darkMode: true,
    emailHotLeads: true,
    dailyKpiSummary: false,
    taskReminders: true
  });

  const handleToggle = (key) => (val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    addNotification({ type: 'success', message: 'Settings saved successfully.' });
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Layout },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your application preferences and workspace settings.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <nav className="w-full md:w-64 shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-base-elevated hover:text-text-primary'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="flex-1">
          <div className="card bg-base-elevated border border-border rounded-xl shadow-sm p-6">
            
            {activeTab === 'general' && (
              <div className="animate-fade-in">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Layout size={18} /> General Settings
                </h3>
                <div className="space-y-2">
                  <ToggleSwitch
                    label="Dark Mode"
                    description="Force dark mode instead of system preference."
                    checked={settings.darkMode}
                    onChange={handleToggle('darkMode')}
                  />
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="animate-fade-in">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Bell size={18} /> Notification Preferences
                </h3>
                <div className="space-y-2">
                  <ToggleSwitch
                    label="Email Alerts for Hot Leads"
                    description="Receive an email when a new lead is scored 'Hot' by AI."
                    checked={settings.emailHotLeads}
                    onChange={handleToggle('emailHotLeads')}
                  />
                  <ToggleSwitch
                    label="Daily KPI Summary"
                    description="Get a morning digest of your revenue and conversion trends."
                    checked={settings.dailyKpiSummary}
                    onChange={handleToggle('dailyKpiSummary')}
                  />
                  <ToggleSwitch
                    label="Task Reminders"
                    description="In-app and email notifications for upcoming tasks."
                    checked={settings.taskReminders}
                    onChange={handleToggle('taskReminders')}
                  />
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="animate-fade-in">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <CreditCard size={18} /> Billing Details
                </h3>
                <div className="p-4 bg-base border border-border rounded-lg text-center">
                  <p className="text-text-secondary text-sm">
                    Billing management is currently available only for Workspace Admins.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
