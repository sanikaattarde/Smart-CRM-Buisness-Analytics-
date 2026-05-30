import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react';
import api from '../../services/api';
import useUiStore from '../../store/uiStore';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, in_progress, completed, all
  const addNotification = useUiStore((state) => state.addNotification);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks', {
        params: { status: filter === 'all' ? undefined : filter }
      });
      setTasks(data.data || []);
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to fetch tasks' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleMarkComplete = async (id) => {
    try {
      // Optimistic update
      setTasks(tasks.map(t => t.id === id ? { ...t, status: 'completed' } : t));
      await api.patch(`/tasks/${id}`, { status: 'completed' });
      addNotification({ type: 'success', message: 'Task marked as completed' });
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to update task status' });
      fetchTasks(); // Revert on failure
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-base border-border text-text-secondary';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Tasks</h1>
        <button
          onClick={() => addNotification({ type: 'info', message: 'Task creation coming soon!' })}
          className="h-10 px-4 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New Task
        </button>
      </div>

      <div className="flex space-x-2 border-b border-border pb-4">
        {['all', 'pending', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === status 
                ? 'bg-accent/10 text-accent' 
                : 'text-text-secondary hover:text-text-primary hover:bg-base-elevated'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary bg-base-elevated rounded-xl border border-border">
            <CheckCircle2 size={48} className="mb-4 opacity-50" />
            <p>No tasks found for this status.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div key={task.id} className="card p-5 bg-base-elevated border border-border rounded-xl hover:border-accent/50 transition-colors flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)} uppercase font-semibold tracking-wider`}>
                    {task.priority || 'Normal'}
                  </span>
                  {task.status !== 'completed' && (
                    <button
                      onClick={() => handleMarkComplete(task.id)}
                      className="text-text-secondary hover:text-accent transition-colors"
                      title="Mark Complete"
                    >
                      <Circle size={20} />
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <CheckCircle2 size={20} className="text-green-500" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2 flex-grow">
                  {task.title}
                </h3>
                
                <div className="flex items-center justify-between text-sm text-text-secondary mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                  </div>
                  <span className="capitalize text-xs font-medium bg-base px-2 py-1 rounded-md">
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
