import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Router } from './Router';
import { theme } from './theme';

const queryClient = new QueryClient();

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);

interface GlobalContextType {
  supabaseClient: typeof supabase;
  session: Session | null;
  userRole: 'student' | 'teacher' | null;
  loading: boolean;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
}

const AuthContext = createContext<GlobalContextType | undefined>(undefined);

function GlobalContextProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;

      setSession(currentSession);
      setLoading(false);

      if (currentSession?.user?.id) {
        fetchUserRole(currentSession.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('start fetch user role for', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;

      console.log('finish fetch user role:', data?.role);
      setUserRole(data?.role as 'student' | 'teacher' | null);
    } catch (err: any) {
      console.error('Failed to fetch user role:', err.message);

      if (err.message?.includes('invalid') || err.status === 401) {
        supabase.auth.signOut();
      }
      setUserRole(null);
    }
  };

  const value: GlobalContextType = {
    supabaseClient: supabase,
    session,
    userRole,
    loading,
    setSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within GlobalContextProvider');
  }
  return context;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <GlobalContextProvider>
          <Router />
        </GlobalContextProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
