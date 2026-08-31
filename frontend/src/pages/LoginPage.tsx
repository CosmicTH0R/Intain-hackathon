import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';

const DEMO_CREDENTIALS = [
  { role: 'Data Operator', email: 'operator@demo.com', password: 'operator123', color: 'text-blue-400' },
  { role: 'Reviewer', email: 'reviewer@demo.com', password: 'reviewer123', color: 'text-purple-400' },
  { role: 'Data Consumer', email: 'consumer@demo.com', password: 'consumer123', color: 'text-green-400' },
];

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password. Try the demo credentials below.');
    }
  };

  const quickLogin = async (cred: typeof DEMO_CREDENTIALS[0]) => {
    setError('');
    try {
      await login(cred.email, cred.password);
      navigate('/');
    } catch {
      setError('Login failed. Make sure the backend is running.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
         style={{ background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 60%)' }}>
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-2xl shadow-primary-900">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Loan Verification</h1>
          <p className="text-primary-400 font-semibold text-lg">Copilot</p>
          <p className="text-surface-muted text-sm mt-2">Intain Campus FinTech Challenge 2026</p>
        </div>

        {/* Login form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-surface-muted hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger-900/40 border border-danger-800 text-danger-300 rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-5 card">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-slate-300">Quick Login (Demo)</span>
          </div>
          <div className="space-y-2">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.email}
                onClick={() => quickLogin(cred)}
                disabled={isLoading}
                className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg
                           bg-surface hover:bg-white/5 border border-surface-border transition-all duration-200
                           disabled:opacity-50 group"
              >
                <div>
                  <div className={`text-sm font-semibold ${cred.color}`}>{cred.role}</div>
                  <div className="text-xs text-surface-muted">{cred.email}</div>
                </div>
                <div className="text-xs text-surface-muted bg-surface-border px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to login
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
