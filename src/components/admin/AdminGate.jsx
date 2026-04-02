import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Em produção com API real, exige sessão admin (cookie HttpOnly).
 * Em modo mock local, o painel continua acessível como antes.
 */
export default function AdminGate() {
  const { user, isLoadingAuth } = useAuth();
  if (import.meta.env.VITE_USE_REAL_API !== 'true') return <Outlet />;
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user?.role !== 'admin') return <Navigate to="/AdminLogin" replace />;
  return <Outlet />;
}
