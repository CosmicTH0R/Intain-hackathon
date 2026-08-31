import { Link, useLocation } from 'react-router-dom';
import { Shield, Upload, AlertTriangle, BarChart3, LogOut, User, Database } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';

const roleNav = {
  data_operator: [
    { to: '/operator', label: 'Dashboard', icon: BarChart3 },
    { to: '/operator/upload', label: 'Upload Data', icon: Upload },
  ],
  reviewer: [
    { to: '/reviewer', label: 'Dashboard', icon: BarChart3 },
    { to: '/reviewer/exceptions', label: 'Exception Queue', icon: AlertTriangle },
  ],
  data_consumer: [
    { to: '/consumer', label: 'Verified Records', icon: Database },
  ],
};

const roleBadge = {
  data_operator: { label: 'Data Operator', color: 'bg-blue-900/60 text-blue-300' },
  reviewer: { label: 'Reviewer', color: 'bg-purple-900/60 text-purple-300' },
  data_consumer: { label: 'Data Consumer', color: 'bg-green-900/60 text-green-300' },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const nav = roleNav[user.role] ?? [];
  const badge = roleBadge[user.role];

  return (
    <nav className="bg-surface-card border-b border-surface-border sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">Loan Verification</span>
              <span className="text-primary-400 font-bold text-sm"> Copilot</span>
              <div className="text-xs text-surface-muted leading-none">Intain 2026</div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === to
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-surface-muted" />
                <span className="text-sm text-slate-300">{user.name}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-danger-400 transition-colors px-3 py-2 rounded-lg hover:bg-danger-900/20"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
