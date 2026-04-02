import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Bloqueia todas as rotas /Admin* para utilizadores com role !== admin.
 * Modo mock local: só após login em /AdminLogin (ver localMockClient + sessionStorage).
 * API real: cookie HttpOnly após POST /api/auth/login.
 */
export default function AdminGate() {
  const { user, isLoadingAuth } = useAuth();
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
