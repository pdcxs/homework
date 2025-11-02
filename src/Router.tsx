import { createBrowserRouter, Navigate, RouterProvider, useNavigate } from 'react-router-dom';
import { HomePage } from './pages/Home.page';
import SignInPage from './pages/SignIn.page';
import LoaderComponent from './components/LoaderComponent';
import SignUpPage from './pages/SignUp.page';
import { DashboardLayout } from './components/DashboardLayout';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { useAuth } from './App';
import HomeworkPage from './pages/Homework.page';

export function Router() {
  const { session, loading } = useAuth();

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
      path: '/homework',
      element: session ? <DashboardLayout><HomeworkPage /></DashboardLayout> : <SignInPage />,
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    }
  ], { basename: '/homework' });


  return <RouterProvider router={router} />;
}
