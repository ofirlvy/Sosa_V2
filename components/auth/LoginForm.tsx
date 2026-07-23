
import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import { AuthLayout } from './AuthLayout';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginFormProps {
  onRegisterClick: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
    } catch (err: any) {
      // Handle specific Supabase configuration error
      if (err.message?.includes('provider is not enabled') || err.message?.includes('Unsupported provider')) {
        setError('Google Login is disabled. Enable it in your Supabase Dashboard under Authentication > Providers.');
      } else {
        setError(err.message || 'Google login failed');
      }
    }
  };

  return (
    <AuthLayout 
      title="Welcome back" 
      subtitle="Sign in to your workspace to continue managing your brand strategy."
    >
      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-[13px] font-medium leading-tight">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#5F2427] mb-1.5 ml-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 text-[#1C1C1E] focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] transition-all outline-none text-[15px]"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="block text-[13px] font-semibold text-[#5F2427]">Password</label>
              <button type="button" className="text-[12px] font-medium text-gray-400 hover:text-[#5F2427] transition-colors">
                Forgot?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 text-[#1C1C1E] focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] transition-all outline-none text-[15px]"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#3A5C34] hover:bg-[#2d4a29] text-white rounded-full font-semibold text-[15px] shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-[12px] font-medium text-gray-400">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-12 bg-white border border-gray-200 hover:bg-gray-50 text-[#1C1C1E] rounded-full font-medium text-[15px] transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-[13px] text-gray-500">
          Don't have an account?{' '}
          <button 
            type="button" 
            onClick={onRegisterClick}
            className="text-[#3A5C34] font-semibold hover:underline"
          >
            Create account
          </button>
        </p>
      </form>
    </AuthLayout>
  );
};
