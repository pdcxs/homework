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
import HomeworkManagementPage from './pages/HomeworkManagement.page';
import GradingPage from './pages/Grading.page';
import CourseManagementPage from './pages/CourseManagement.page';

export function Router() {
  const { session, loading, userRole } = useAuth(); // 假设 useAuth 返回 userRole

  if (loading) {
    return <LoaderComponent>正在登陆中……</LoaderComponent>
  }

  const studentRoutes = [
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
  ];

  const teacherRoutes = [
    {
      path: '/',
      element: session ?
        <DashboardLayout><HomeworkManagementPage /></DashboardLayout> :
        <Navigate to="/" replace />,
    },
    {
      path: '/grading',
      element: session ?
        <DashboardLayout><GradingPage /></DashboardLayout> :
        <Navigate to="/" replace />,
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
      path: '/course-management',
      element: session ?
        <DashboardLayout><CourseManagementPage /></DashboardLayout> :
        <Navigate to="/" replace />,
    },
  ];

  // 合并路由
  const allRoutes = [
    ...(userRole === 'teacher' ? teacherRoutes : studentRoutes),
    {
      path: '*',
      element: <Navigate to="/" replace />,
    }
  ];

  const router = createBrowserRouter(allRoutes, {
    basename: '/homework'
  });

  return <RouterProvider router={router} />;
}