import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Shield, Hash, TrendingUp, Database, Eye, X, CheckCircle } from 'lucide-react';
import api from '../../api/client';
import AuditTimeline from '../../components/AuditTimeline';
import type { VerifiedLoanRecord, Summary } from '../../types';

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      <svg viewBox="0 0 120 70" className="w-40">
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 157} 157`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="60" y="58" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">{score}</text>
        <text x="60" y="70" textAnchor="middle" fill="#64748b" fontSize="8">Data Quality Score</text>
      </svg>
    </div>
  );
}

function VerifiedRecordDetail({ record, onClose }: { record: VerifiedLoanRecord; onClose: () => void }) {
  const [tab, setTab] = useState<'data' | 'audit'>('data');

  const handleExport = async (format: 'json' | 'csv') => {
    const { data } = await api.post(`/verified-loans/${record.id}/export`, { format });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `loan-${record.loanId}.json`; a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-400" />
            <div>
              <div className="font-bold text-white">Verified Loan — {record.loanId}</div>
              <div className="text-xs text-surface-muted">{record.verifiedUser?.name} · {format(new Date(record.verificationTimestamp), 'MMM d, yyyy HH:mm')}</div>
            </div>
            <span className="px-2 py-0.5 bg-green-900/40 text-green-300 text-xs rounded-full border border-green-800">{record.reviewerDecision}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('json')} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
            <button onClick={onClose} className="text-surface-muted hover:text-white p-1"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex border-b border-surface-border px-6">
          {[{ key: 'data', label: 'Canonical Data' }, { key: 'audit', label: 'Audit Trail' }].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key as typeof tab)}
              className={`px-4 py-3 text-sm border-b-2 transition-colors ${tab === key ? 'border-primary-500 text-primary-400' : 'border-transparent text-surface-muted hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'data' ? (
            <div className="space-y-4">
              {/* SHA-256 Hash */}
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">Record Hash (SHA-256)</span>
                </div>
                <code className="text-xs text-emerald-300 font-mono break-all">{record.recordHash}</code>
              </div>

              {/* Canonical data */}
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Canonical Loan Data</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(record.canonicalData).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5 border-b border-surface-border/50">
                      <span className="text-surface-muted">{k}</span>
                      <span className="text-slate-200 font-mono">{v !== null && v !== undefined ? String(v) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation result */}
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Validation Summary</h3>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-surface rounded-lg p-3">
                    <div className="text-xl font-bold text-white">{record.validationResult.totalExceptions}</div>
                    <div className="text-surface-muted">Total Exceptions</div>
                  </div>
                  <div className="bg-surface rounded-lg p-3">
                    <div className="text-xl font-bold text-green-400">{record.validationResult.approvedExceptions}</div>
                    <div className="text-surface-muted">Approved</div>
                  </div>
                  <div className="bg-surface rounded-lg p-3">
                    <div className="text-xl font-bold text-orange-400">{record.validationResult.openExceptions}</div>
                    <div className="text-surface-muted">Open</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <AuditTimeline loanId={record.loanId} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConsumerDashboard() {
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<VerifiedLoanRecord | null>(null);

  const { data: summary } = useQuery<Summary>({
    queryKey: ['summary'],
    queryFn: () => api.get('/summary').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['verified-loans', page],
    queryFn: () => api.get(`/verified-loans?page=${page}&limit=15`).then((r) => r.data),
  });

  const records: VerifiedLoanRecord[] = data?.data ?? [];
  const pagination = data?.pagination;

  const exportAll = async () => {
    const allData = records.map((r) => r.canonicalData);
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'verified-loans.json'; a.click();
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Verified Records</h1>
          <p className="text-surface-muted text-sm mt-1">Browse verified loans — each record is immutable and SHA-256 hashed</p>
        </div>
        {records.length > 0 && (
          <button onClick={exportAll} className="btn-secondary flex items-center gap-2">
            <Download className="h-4 w-4" /> Export All
          </button>
        )}
      </div>

      {/* Stats + Quality Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card md:col-span-1 flex flex-col items-center">
          <ScoreGauge score={summary?.dataQualityScore ?? 0} />
          <div className="text-center mt-2">
            <div className="text-xs text-surface-muted">Formula: (verified/total) × 100 × (1 − exception_rate)</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-blue-900/40 p-3 rounded-xl text-blue-400"><Database className="h-6 w-6" /></div>
          <div>
            <div className="text-2xl font-bold text-white">{summary?.totalLoans ?? 0}</div>
            <div className="text-sm text-slate-400">Total Loans</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-green-900/40 p-3 rounded-xl text-green-400"><CheckCircle className="h-6 w-6" /></div>
          <div>
            <div className="text-2xl font-bold text-white">{summary?.totalVerified ?? 0}</div>
            <div className="text-sm text-slate-400">Verified Records</div>
          </div>
        </div>
      </div>

      {/* Verified records table */}
      <div className="card overflow-x-auto p-0">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-400" /> Verified Loan Records
          </h2>
          <span className="text-xs text-surface-muted">{pagination?.total ?? 0} records</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-surface-muted">
            <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mr-3" />
            Loading…
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-surface-muted">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No verified records yet</p>
            <p className="text-xs mt-1">Records appear here once a reviewer approves and verifies them</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-surface-muted text-left">
                {['Loan ID', 'Decision', 'Verified By', 'Hash (truncated)', 'Timestamp', 'Action'].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr key={rec.id} className="border-b border-surface-border/50 table-row-hover" onClick={() => setSelectedRecord(rec)}>
                  <td className="px-5 py-3 pl-6 font-mono text-primary-400 font-medium">{rec.loanId}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-green-900/40 text-green-300 text-xs rounded-full border border-green-800">{rec.reviewerDecision}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{rec.verifiedUser?.name ?? 'Unknown'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-emerald-400">{rec.recordHash.slice(0, 16)}…</td>
                  <td className="px-5 py-3 text-surface-muted text-xs">{format(new Date(rec.verificationTimestamp), 'MMM d, yyyy HH:mm')}</td>
                  <td className="px-5 py-3 pr-6">
                    <button className="flex items-center gap-1 text-primary-400 hover:text-primary-300 text-xs">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-muted">{pagination.total} verified records</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary text-xs px-3 py-1.5">← Prev</button>
            <span className="px-3 py-1.5 text-surface-muted">{page} / {pagination.pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.pages} className="btn-secondary text-xs px-3 py-1.5">Next →</button>
          </div>
        </div>
      )}

      {/* Record detail modal */}
      {selectedRecord && <VerifiedRecordDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    </div>
  );
}
