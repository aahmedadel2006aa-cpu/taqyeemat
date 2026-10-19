import { Navigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import type { ReactNode } from 'react';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}
