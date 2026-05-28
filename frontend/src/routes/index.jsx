import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import DashboardPage from '../features/dashboard/DashboardPage';
import LeadPipelinePage from '../features/leads/LeadPipelinePage';

/* --------------------------------------------------------------------------
   Placeholder (for pages not yet built)
   -------------------------------------------------------------------------- */

function PlaceholderPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-text-secondary animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
        <span className="text-accent text-lg font-semibold">{title.charAt(0)}</span>
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-1">{title}</h2>
      <p className="text-sm">This page is under construction.</p>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="card p-8 w-full max-w-md animate-slide-up">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Sign in to SmartCRM</h1>
        <p className="text-sm text-text-secondary mb-6">
          Login form will be built in a future phase.
        </p>
        <div className="space-y-4">
          <div className="h-10 rounded-md bg-base-elevated border border-border" />
          <div className="h-10 rounded-md bg-base-elevated border border-border" />
          <div className="h-10 rounded-md bg-accent" />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Route Tree
   -------------------------------------------------------------------------- */

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'customers', element: <PlaceholderPage title="Customers" /> },
      { path: 'customers/:id', element: <PlaceholderPage title="Customer Detail" /> },
      { path: 'leads', element: <LeadPipelinePage /> },
      { path: 'tasks', element: <PlaceholderPage title="Tasks" /> },
      { path: 'insights', element: <PlaceholderPage title="AI Insights" /> },
      { path: 'settings', element: <PlaceholderPage title="Settings" /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
