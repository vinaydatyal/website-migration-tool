import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkUser = async (session: any) => {
      if (!session) {
        setIsAuthenticated(false);
        return;
      }
      
      const { data } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('id', session.user.id)
        .single();
        
      if (data) {
        setStatus(data.status);
      }
      setIsAuthenticated(true);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUser(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl border border-white/5 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Pending Approval</h2>
          <p className="text-gray-400 mb-6">
            Your account is currently pending admin approval. Once datyal.upwork@gmail.com approves your request, you will be able to access the tool.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="text-primary-500 hover:text-primary-400 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
