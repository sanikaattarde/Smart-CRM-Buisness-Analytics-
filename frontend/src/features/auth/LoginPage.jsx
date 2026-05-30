import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Pass org_id for demo purposes as needed by the backend
      await login({ 
        email, 
        password,
        org_id: '00000000-0000-0000-0000-000000000001' 
      });
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error?.message || 
        err.message || 
        'An error occurred during sign in.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4">
      <div className="card p-8 w-full max-w-md animate-slide-up border border-border bg-base-elevated rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Sign in to SmartCRM</h1>
        <p className="text-sm text-text-secondary mb-6">
          Enter your credentials to access your account.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-500 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-text-primary">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full h-10 px-3 rounded-md bg-base border border-border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-text-primary">
                Password
              </label>
              <a href="#" className="text-sm text-accent hover:text-accent-hover transition-colors">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-3 pr-10 rounded-md bg-base border border-border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary focus:outline-none"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 mt-2 rounded-md bg-accent text-white font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              'Sign in to SmartCRM'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
