import { createBrowserRouter, Navigate, RouterProvider, useNavigate } from 'react-router-dom';
import { HomePage } from './pages/Home.page';
import supabase from './client';
import SignInPage from './pages/SignIn.page';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import LoaderComponent from './components/LoaderComponent';
import SignUpPage from './pages/SignUp.page';
import { DashboardLayout } from './components/DashboardLayout';
import ResetPasswordPage from './pages/ResetPasswordPage';

export function Router() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    checkSession();
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <LoaderComponent>正在登陆中……</LoaderComponent>
  }

  const router = createBrowserRouter([
    {
      path: '/',
      element: session ? <DashboardLayout><HomePage /></DashboardLayout> : <SignInPage />,
    },
    {
      path: '/sign-in',
      element: session ? <Navigate to="/" replace /> : <SignInPage />,
    },
    {
      path: '/reset-password',
      element: <ResetPasswordPage />,
    },
    {
      path: '/sign-up',
      element: session ? <Navigate to="/" replace /> : <SignUpPage />,
    },
    {
      path: '*',
      element: <Navigate to={session ? '/' : '/sign-in'} replace />,
    }
  ]);


  return <RouterProvider router={router} />;
}
