import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SS_MOCK_ADMIN_SESSION } from '@/config/storageKeys';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      if (!useRealApi) {
        const expected =
          import.meta.env.VITE_MOCK_ADMIN_PASSWORD || 'dev-admin';
        if (password !== expected) {
          setErr('Senha incorreta');
          return;
        }
        try {
          sessionStorage.setItem(SS_MOCK_ADMIN_SESSION, '1');
        } catch {
          setErr('Não foi possível iniciar sessão neste browser.');
          return;
        }
        window.location.assign('/Admin');
        return;
      }

      const apiBase = import.meta.env.VITE_API_URL || '';
      const r = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || 'Falha no login');
        return;
      }
      window.location.assign('/Admin');
    } catch {
      setErr('Não foi possível contactar o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-white text-center">Painel admin</h1>
        {!useRealApi ? (
          <p className="text-gray-500 text-sm text-center">
            Modo local: usa a senha definida em{' '}
            <code className="text-gray-400">VITE_MOCK_ADMIN_PASSWORD</code> (predefinição:{' '}
            <code className="text-gray-400">dev-admin</code>).
          </p>
        ) : (
          <p className="text-gray-500 text-sm text-center">
            Entra com a conta de administrador da base de dados (API em produção).
          </p>
        )}
        {err ? <p className="text-red-400 text-sm text-center">{err}</p> : null}
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={useRealApi ? 'Email' : 'Email (opcional no modo local)'}
          required={useRealApi}
          className="bg-[#1A1A1A] border-white/10"
        />
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          required
          className="bg-[#1A1A1A] border-white/10"
        />
        <Button type="submit" disabled={loading} className="w-full bg-[#E50914] hover:bg-[#FF3D3D]">
          {loading ? 'A entrar…' : 'Entrar'}
        </Button>
        <Link to="/Home" className="block text-center text-sm text-gray-400 hover:text-white">
          Voltar ao site
        </Link>
      </form>
    </div>
  );
}
