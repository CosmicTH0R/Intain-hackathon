import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, Bot, ArrowRight } from 'lucide-react';
import api from '../../api/client';
import type { Summary, Exception } from '../../types';

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.FC<{ className?: string }>; color: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}><Icon className="h-6 w-6" /></div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`badge-severity-${severity}`}>{severity}</span>;
}

export default function ReviewerDashboard() {
  const { data: summary } = useQuery<Summary>({
    queryKey: ['summary'],
    queryFn: () => api.get('/summary').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: recentExceptions } = useQuery<{ data: Exception[] }>({
    queryKey: ['exceptions', 'recent'],
    queryFn: () => api.get('/exceptions?status=open&limit=5').then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reviewer Dashboard</h1>
          <p className="text-surface-muted text-sm mt-1">Review exceptions, use AI assistance, and approve verified records</p>
        </div>
        <Link to="/reviewer/exceptions" className="btn-primary flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Open Exception Queue
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Exceptions" value={summary?.openExceptions ?? 0} icon={AlertTriangle} color="bg-orange-900/40 text-orange-400" />
        <StatCard label="Approved" value={summary?.exceptionByStatus?.['approved'] ?? 0} icon={CheckCircle} color="bg-green-900/40 text-green-400" />
        <StatCard label="Verified Loans" value={summary?.totalVerified ?? 0} icon={CheckCircle} color="bg-blue-900/40 text-blue-400" />
        <StatCard label="Quality Score" value={`${summary?.dataQualityScore ?? 0}%`} icon={Bot} color="bg-purple-900/40 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Exception Queue Preview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Pending Exceptions</h2>
            <Link to="/reviewer/exceptions" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(recentExceptions?.data ?? []).length === 0 ? (
            <div className="text-center py-6 text-surface-muted text-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400 opacity-50" />
              No open exceptions — great data quality!
            </div>
          ) : (
            <div className="space-y-2">
              {recentExceptions?.data.map((ex) => (
                <Link
                  key={ex.id}
                  to={`/reviewer/exceptions?id=${ex.id}`}
                  className="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-white/5 transition-colors border border-surface-border"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{ex.loanId}</div>
                    <div className="text-xs text-surface-muted mt-0.5">{ex.rule?.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={ex.severity} />
                    <ArrowRight className="h-3 w-3 text-surface-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* AI Capabilities */}
        <div className="ai-panel">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-primary-400" />
            <h2 className="text-sm font-semibold text-white">AI Assistant Capabilities</h2>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            {[
              { icon: '💡', label: 'Explain why a record failed validation' },
              { icon: '🔧', label: 'Suggest likely field corrections' },
              { icon: '⚡', label: 'Compare loan tape vs. servicer update conflicts' },
              { icon: '📝', label: 'Draft reviewer notes automatically' },
              { icon: '🎯', label: 'Classify exception severity with reasoning' },
              { icon: '📊', label: 'Summarize a full batch of exceptions' },
              { icon: '⚙️', label: 'Generate new validation rules from natural language' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-primary-300 border-t border-primary-800/30 pt-3">
            ⚠️ All AI suggestions require explicit human approval before any data changes are made.
          </div>
        </div>
      </div>

      {/* Exception breakdown by severity */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Exception Severity Breakdown</h2>
        <div className="grid grid-cols-4 gap-3">
          {['critical', 'high', 'medium', 'low'].map((sev) => {
            const count = summary?.exceptionBySeverity?.[sev] ?? 0;
            return (
              <div key={sev} className="text-center p-3 bg-surface rounded-xl border border-surface-border">
                <div className="text-2xl font-bold text-white">{count}</div>
                <SeverityBadge severity={sev} />
              </div>
            );
          })}
        </div>
        {(summary?.openExceptions ?? 0) > 0 && (
          <Link to="/reviewer/exceptions" className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
            <AlertTriangle className="h-4 w-4" /> Review {summary?.openExceptions} Open Exception{summary?.openExceptions !== 1 ? 's' : ''}
          </Link>
        )}
      </div>
    </div>
  );
}
