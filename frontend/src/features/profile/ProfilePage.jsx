import React, { useState } from 'react';
import { User, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const addNotification = useUiStore((state) => state.addNotification);

  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    // Simulate API call
    addNotification({ type: 'success', message: 'Profile updated successfully!' });
    setIsEditing(false);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setIsChangingPassword(true);
    // Simulate API call delay
    setTimeout(() => {
      setIsChangingPassword(false);
      addNotification({ type: 'success', message: 'Password changed successfully.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }, 1000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Profile</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your personal information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Personal Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="card bg-base-elevated border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <User size={18} /> Personal Information
              </h2>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-sm font-medium text-accent hover:text-accent-hover"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Full Name</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60 disabled:bg-base-surface"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Email Address</label>
                <input
                  type="email"
                  disabled={!isEditing}
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60 disabled:bg-base-surface"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Role</label>
                <input
                  type="text"
                  disabled
                  value={profileForm.role.replace('_', ' ')}
                  className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60 disabled:bg-base-surface capitalize"
                />
              </div>
              {isEditing && (
                <div className="pt-2 flex justify-end">
                  <button type="submit" className="h-10 px-4 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors">
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Security */}
          <div className="card bg-base-elevated border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Lock size={18} /> Security
              </h2>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isChangingPassword}
                  className="h-10 px-4 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isChangingPassword ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Right column */}
        <div className="md:col-span-1 space-y-6">
          <div className="card bg-base-elevated border border-border rounded-xl shadow-sm p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mb-4 border border-accent/20">
              <span className="text-3xl font-semibold text-accent">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <h3 className="font-semibold text-text-primary text-lg">{user?.name}</h3>
            <p className="text-text-secondary text-sm capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
