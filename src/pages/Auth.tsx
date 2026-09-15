import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { Shield, Sparkles, Loader2, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate((location.state as any)?.from?.pathname || '/');
      }
    });
  }, [navigate, location]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate((location.state as any)?.from?.pathname || '/');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user) {
          fetch('/api/admin/request-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, userId: data.user.id })
          }).catch(console.error);
        }

        toast.success('Registration successful! Waiting for admin approval.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center p-4">
      <div className="max-w-md w-full relative">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="glass-panel p-8 rounded-2xl border border-white/5 relative z-10 backdrop-blur-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center border border-white/10 mb-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Shield className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 font-display">
              Migrate<span className="text-primary-400">Shield</span>
            </h1>
            <p className="text-gray-400 text-center">
              {isLogin ? 'Welcome back to your secure dashboard' : 'Create an account to get started'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1A1D24] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 transition-colors"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1A1D24] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white rounded-lg font-medium transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
