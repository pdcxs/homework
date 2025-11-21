import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { Router } from './Router';
import { theme } from './theme';
import { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, Session } from '@supabase/supabase-js';
import '@mantine/dates/styles.css';

const queryClient = new QueryClient();

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_KEY!,
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
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);

  const fetchUserRole = async (userId: string | undefined) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('查询用户角色失败:', error);
        throw error;
      }

      setUserRole(data?.role as 'student' | 'teacher' | null);
    } catch (error) {
      console.error('获取用户角色失败:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const getInitialSessionWithTimeout = async () => {
      try {
        const sessionData = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: Session | null } }>((_, reject) =>
            timeoutId = setTimeout(() => reject(new Error('getSession timeout')), 5000)
          )
        ]);

        clearTimeout(timeoutId);

        if (!isMounted) return;

        const session = sessionData.data.session;
        setSession(session);

        if (session?.user?.id) {
          await fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('getInitialSession 超时或失败，强制视为未登录:', err);
        clearTimeout(timeoutId);

        if (!isMounted) return;

        setSession(null);
        setUserRole(null);
        setLoading(false);
      }
    };

    getInitialSessionWithTimeout();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setSession(session);

      if (session?.user?.id) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const value = {
    session,
    userRole,
    loading,
    supabaseClient: supabase,
    setSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
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