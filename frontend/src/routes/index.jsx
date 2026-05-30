import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import DashboardPage from '../features/dashboard/DashboardPage';
import LeadPipelinePage from '../features/leads/LeadPipelinePage';
import LoginPage from '../features/auth/LoginPage';
import CustomersPage from '../features/customers/CustomersPage';
import TasksPage from '../features/tasks/TasksPage';
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
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <PlaceholderPage title="Customer Detail" /> },
      { path: 'leads', element: <LeadPipelinePage /> },
      { path: 'tasks', element: <TasksPage /> },
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
