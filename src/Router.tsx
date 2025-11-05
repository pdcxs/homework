import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { UserProfilePage } from './pages/Profile.page';
import SignInPage from './pages/SignIn.page';
import LoaderComponent from './components/LoaderComponent';
import SignUpPage from './pages/SignUp.page';
import { DashboardLayout } from './components/DashboardLayout';
import ResetPasswordPage from './pages/ResetPassword.page';
import { useAuth } from './App';
import HomeworkPage from './pages/Homework.page';
import HomeworkEditPage from './pages/HomeworkEdit.page';

export function Router() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoaderComponent>正在登陆中……</LoaderComponent>
  }

  const router = createBrowserRouter([
    {
      path: '/',
      element: session ? <DashboardLayout><HomeworkPage /></DashboardLayout> : <SignInPage />,
    },
    {
      path: '/profile',
      element: session ? <DashboardLayout><UserProfilePage /></DashboardLayout> : <SignInPage />,
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
      path: '/tasks',
      element: session ? <DashboardLayout><HomeworkPage /></DashboardLayout> : <SignInPage />,
    },
    {
      path: '/edit/:id',
      element: session ? <DashboardLayout><HomeworkEditPage /></DashboardLayout> : <SignInPage />,
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    }
  ], {
    basename: '/homework'
  });


  return <RouterProvider router={router} />;
}
