import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Upload, AlertTriangle, CheckCircle, FileText, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../api/client';
import type { Summary } from '../../types';

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: React.FC<{ className?: string }>; color: string; sub?: string;
}) {
  return (
    <div className="card flex items-start gap-4 hover:border-primary-600/50 transition-all duration-200">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
        {sub && <div className="text-xs text-surface-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
};

export default function OperatorDashboard() {
  const { data: summary, isLoading } = useQuery<Summary>({
    queryKey: ['summary'],
    queryFn: () => api.get('/summary').then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-muted">
        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mr-3" />
        Loading dashboard…
      </div>
    );
  }

  const severityChartData = Object.entries(summary?.exceptionBySeverity ?? {}).map(([name, count]) => ({ name, count }));
  const statusChartData = Object.entries(summary?.exceptionByStatus ?? {}).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Operator Dashboard</h1>
          <p className="text-surface-muted text-sm mt-1">Monitor uploads, validation results, and data quality</p>
        </div>
        <Link to="/operator/upload" className="btn-primary flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload Data
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Loans" value={summary?.totalLoans ?? 0} icon={FileText} color="bg-blue-900/40 text-blue-400" />
        <StatCard label="Verified Records" value={summary?.totalVerified ?? 0} icon={CheckCircle} color="bg-green-900/40 text-green-400" />
        <StatCard label="Open Exceptions" value={summary?.openExceptions ?? 0} icon={AlertTriangle} color="bg-orange-900/40 text-orange-400" sub="Corrections needed" />
        <StatCard label="Data Quality Score" value={`${summary?.dataQualityScore ?? 0}%`} icon={TrendingUp}
          color={`${(summary?.dataQualityScore ?? 0) >= 70 ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Exceptions by Severity</h2>
          {severityChartData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-surface-muted text-sm">No exceptions yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={severityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityChartData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Exceptions by Status</h2>
          {statusChartData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-surface-muted text-sm">No exceptions yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Batches */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Import History</h2>
          <Link to="/operator/upload" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
            Upload new <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {(summary?.recentBatches ?? []).length === 0 ? (
          <div className="text-center py-8 text-surface-muted">
            <Upload className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No uploads yet. Start by uploading a loan tape.</p>
            <Link to="/operator/upload" className="btn-primary inline-flex items-center gap-2 mt-3 text-sm">
              <Upload className="h-4 w-4" /> Upload Now
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-surface-muted text-left">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Imported</th>
                  <th className="pb-2 font-medium text-right">Failed</th>
                  <th className="pb-2 font-medium text-right">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {summary?.recentBatches.map((batch) => (
                  <tr key={batch.id} className="border-b border-surface-border/50 table-row-hover">
                    <td className="py-2.5 text-slate-300 font-medium">{batch.fileName}</td>
                    <td className="py-2.5 text-surface-muted">{batch.fileType}</td>
                    <td className="py-2.5 text-right text-green-400">{batch.importedRows}</td>
                    <td className="py-2.5 text-right text-red-400">{batch.failedRows}</td>
                    <td className="py-2.5 text-right text-surface-muted">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(batch.uploadedAt), 'MMM d, HH:mm')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
