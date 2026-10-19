import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminProvider } from './context/AdminContext';
import { AppLayout } from './components/layout/AppLayout';
import { AdminRoute } from './components/AdminRoute';
import { HomePage } from './pages/HomePage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { AssessmentHistoryPage } from './pages/AssessmentHistoryPage';
import { AdminPage } from './pages/AdminPage';
import { AdminLoginPage } from './pages/AdminLoginPage';

export default function App() {
  return (
    <ThemeProvider>
      <AdminProvider>
        <DataProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route
                  path="student/:studentId"
                  element={<StudentDashboardPage />}
                />
                <Route path="admin/login" element={<AdminLoginPage />} />
                <Route
                  path="admin"
                  element={
                    <AdminRoute>
                      <AdminPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="history"
                  element={
                    <AdminRoute>
                      <AssessmentHistoryPage />
                    </AdminRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AdminProvider>
    </ThemeProvider>
  );
}
