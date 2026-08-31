import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertTriangle, Search, Filter, ChevronRight, X, CheckCircle,
  XCircle, MessageSquare, RefreshCw, Bot, GitCompare, FileText, Hash
} from 'lucide-react';
import api from '../../api/client';
import AIPanel from '../../components/AIPanel';
import AuditTimeline from '../../components/AuditTimeline';
import type { Exception, ReviewAction } from '../../types';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['open', 'approved', 'rejected', 'corrected'];

function SeverityBadge({ s }: { s: string }) {
  return <span className={`badge-severity-${s}`}>{s}</span>;
}
function StatusBadge({ s }: { s: string }) {
  return <span className={`badge-status-${s}`}>{s}</span>;
}

interface ExceptionDetailProps {
  exception: Exception & {
    loanRecord: Record<string, unknown>;
    servicerUpdate: Record<string, unknown> | null;
    reviewActions: ReviewAction[];
    aiRecommendations: unknown[];
  };
  onClose: () => void;
}

function ExceptionDetail({ exception: ex, onClose }: ExceptionDetailProps) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'ai' | 'audit'>('details');

  const reviewMutation = useMutation({
    mutationFn: ({ action, comment }: { action: string; comment?: string }) =>
      api.post(`/exceptions/${ex.id}/review`, { action, comment }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exceptions'] }); onClose(); },
  });

  const commentMutation = useMutation({
    mutationFn: (comment: string) =>
      api.post(`/exceptions/${ex.id}/comment`, { comment }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exception', ex.id] }); setComment(''); },
  });

  const loan = ex.loanRecord;
  const svc = ex.servicerUpdate;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <div>
              <div className="font-bold text-white">Exception — Loan {ex.loanId}</div>
              <div className="text-xs text-surface-muted">{ex.rule?.description}</div>
            </div>
            <SeverityBadge s={ex.severity} />
            <StatusBadge s={ex.status} />
          </div>
          <button onClick={onClose} className="text-surface-muted hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-border px-6">
          {[
            { key: 'details', label: 'Loan Details', icon: FileText },
            { key: 'ai', label: 'AI Assistant', icon: Bot },
            { key: 'audit', label: 'Audit Trail', icon: Hash },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-surface-muted hover:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Error message */}
              <div className="bg-orange-900/20 border border-orange-800/40 rounded-lg p-3 text-sm text-orange-300">
                <strong>Issue:</strong> {ex.details.message as string}
              </div>

              {/* Loan data grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Normalized loan data */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary-400" /> Loan Tape Data
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {[
                      ['loan_id', loan['loanId']],
                      ['borrower_id', loan['borrowerId']],
                      ['origination_date', loan['originationDate']],
                      ['maturity_date', loan['maturityDate']],
                      ['original_principal', loan['originalPrincipal'] ? `$${loan['originalPrincipal']}` : null],
                      ['current_balance', loan['currentBalance'] ? `$${loan['currentBalance']}` : null],
                      ['interest_rate', loan['interestRate'] ? `${loan['interestRate']}%` : null],
                      ['payment_status', loan['paymentStatus']],
                      ['days_past_due', loan['daysPastDue']],
                      ['borrower_state', loan['borrowerState']],
                      ['document_status', loan['documentStatus']],
                      ['last_updated_at', loan['lastUpdatedAt']],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between py-1 border-b border-surface-border/50">
                        <span className="text-surface-muted">{String(k)}</span>
                        <span className="text-slate-200 font-mono">{v !== null && v !== undefined ? String(v) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Servicer update diff */}
                {svc ? (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <GitCompare className="h-4 w-4 text-yellow-400" /> Servicer Update (Diff)
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      {Object.entries(svc).filter(([k]) => !['loan_id', 'rawRowJson'].includes(k)).map(([k, v]) => {
                        const loanVal = loan[k] ?? loan[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
                        const isDiff = v !== null && String(v) !== String(loanVal) && v !== '';
                        return (
                          <div key={k} className={`flex justify-between py-1 border-b border-surface-border/50 ${isDiff ? 'bg-yellow-900/20 px-1.5 rounded' : ''}`}>
                            <span className={isDiff ? 'text-yellow-300' : 'text-surface-muted'}>{k}</span>
                            <div className="flex items-center gap-2 font-mono">
                              {isDiff && <span className="text-red-400 line-through">{String(loanVal ?? '—')}</span>}
                              <span className={isDiff ? 'text-yellow-300' : 'text-slate-200'}>{v !== null ? String(v) : '—'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="card flex items-center justify-center text-surface-muted text-sm">
                    No servicer update available for this loan.
                  </div>
                )}
              </div>

              {/* Reviewer actions */}
              {ex.status === 'open' && (
                <div className="card border-primary-800/30">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Reviewer Decision</h3>
                  <div className="flex gap-3 mb-3 flex-wrap">
                    <button
                      onClick={() => reviewMutation.mutate({ action: 'approve' })}
                      className="btn-success flex items-center gap-2"
                      disabled={reviewMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ action: 'reject' })}
                      className="btn-danger flex items-center gap-2"
                      disabled={reviewMutation.isPending}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ action: 'request_correction', comment })}
                      className="btn-secondary flex items-center gap-2"
                      disabled={reviewMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4" /> Request Correction
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="input text-sm flex-1"
                      placeholder="Add a comment (optional)…"
                    />
                    <button
                      onClick={() => comment && commentMutation.mutate(comment)}
                      className="btn-secondary flex items-center gap-2 shrink-0"
                      disabled={!comment || commentMutation.isPending}
                    >
                      <MessageSquare className="h-4 w-4" /> Comment
                    </button>
                  </div>
                </div>
              )}

              {/* Review history */}
              {ex.reviewActions.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Review History</h3>
                  <div className="space-y-2">
                    {ex.reviewActions.map((ra) => (
                      <div key={ra.id} className="flex items-start gap-3 text-xs border-b border-surface-border/50 pb-2">
                        <div className="bg-primary-900/40 p-1.5 rounded-lg border border-primary-800/40 shrink-0">
                          <MessageSquare className="h-3 w-3 text-primary-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{ra.reviewer?.name ?? 'Unknown'}</span>
                            <span className="text-surface-muted">·</span>
                            <span className="text-surface-muted">{format(new Date(ra.timestamp), 'MMM d, HH:mm')}</span>
                            <span className="px-1.5 py-0.5 bg-surface-border rounded text-surface-muted">{ra.action}</span>
                          </div>
                          {ra.comment && <p className="text-slate-300 mt-0.5">{ra.comment}</p>}
                          {ra.fieldChangesJson && (
                            <div className="mt-1 text-surface-muted font-mono bg-surface rounded p-1.5 text-[10px] break-all">
                              {ra.fieldChangesJson}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create verified record */}
              {ex.status === 'approved' && (
                <VerifyLoanButton loanRecordId={ex.loanRecordId} reviewerId="" />
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <AIPanel exceptionId={ex.id} loanId={ex.loanId} />
          )}

          {activeTab === 'audit' && (
            <AuditTimeline loanId={ex.loanId} />
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyLoanButton({ loanRecordId }: { loanRecordId: string; reviewerId: string }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.post('/verified-loans', { loanRecordId, reviewerDecision: 'approved', comment }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exceptions'] }); },
  });

  return (
    <div className="card border-green-800/30">
      <h3 className="text-sm font-semibold text-green-400 mb-2">✅ Ready to Verify</h3>
      <p className="text-xs text-surface-muted mb-3">This exception has been approved. Create an immutable verified record with a SHA-256 hash.</p>
      <input className="input text-sm mb-2" placeholder="Verification note (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button onClick={() => mutation.mutate()} className="btn-success w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : '🔐 Create Verified Record'}
      </button>
      {mutation.isSuccess && <p className="text-green-400 text-xs mt-2">✅ Verified record created successfully</p>}
      {mutation.isError && <p className="text-red-400 text-xs mt-2">❌ {(mutation.error as Error).message}</p>}
    </div>
  );
}

export default function ExceptionQueuePage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const queryParams = new URLSearchParams({
    page: String(page), limit: '15',
    ...filters,
    ...(search ? (search.match(/^[A-Z]{2}-\d+/i) ? { loanId: search } : { borrowerId: search }) : {}),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['exceptions', queryParams],
    queryFn: () => api.get(`/exceptions?${queryParams}`).then((r) => r.data),
  });

  const { data: selectedEx } = useQuery({
    queryKey: ['exception', selected],
    queryFn: () => api.get(`/exceptions/${selected}`).then((r) => r.data),
    enabled: !!selected,
  });

  const exceptions: Exception[] = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Exception Queue</h1>
        <p className="text-surface-muted text-sm mt-1">Review, comment on, and resolve validation exceptions</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="h-4 w-4 text-surface-muted shrink-0" />
            <input
              className="input text-sm"
              placeholder="Search by loan ID or borrower ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-surface-muted" />
            <select
              className="input text-sm w-36"
              value={filters.severity ?? ''}
              onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value || '' })); setPage(1); }}
            >
              <option value="">All Severities</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="input text-sm w-36"
              value={filters.status ?? ''}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value || '' })); setPage(1); }}
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(Object.values(filters).some(Boolean) || search) && (
            <button onClick={() => { setFilters({}); setSearch(''); setPage(1); }}
              className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-surface-muted">
            <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mr-3" />
            Loading exceptions…
          </div>
        ) : exceptions.length === 0 ? (
          <div className="text-center py-12 text-surface-muted">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No exceptions found</p>
            <p className="text-xs mt-1">Try different filters or upload a loan tape to run validation</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-surface-muted text-left">
                {['Loan ID', 'Rule', 'Severity', 'Status', 'Detected', 'Action'].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => (
                <tr
                  key={ex.id}
                  onClick={() => setSelected(ex.id)}
                  className="border-b border-surface-border/50 table-row-hover"
                >
                  <td className="px-5 py-3 pl-6 font-mono text-primary-400 font-medium">{ex.loanId}</td>
                  <td className="px-5 py-3 text-slate-300 max-w-xs">
                    <div className="truncate">{ex.rule?.name}</div>
                    <div className="text-xs text-surface-muted truncate">{ex.rule?.description}</div>
                  </td>
                  <td className="px-5 py-3"><SeverityBadge s={ex.severity} /></td>
                  <td className="px-5 py-3"><StatusBadge s={ex.status} /></td>
                  <td className="px-5 py-3 text-surface-muted text-xs">
                    {format(new Date(ex.detectedAt), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-5 py-3 pr-6">
                    <button onClick={() => setSelected(ex.id)} className="flex items-center gap-1 text-primary-400 hover:text-primary-300 text-xs">
                      Review <ChevronRight className="h-3.5 w-3.5" />
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
          <span className="text-surface-muted">{pagination.total} total exceptions</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary text-xs px-3 py-1.5">← Prev</button>
            <span className="px-3 py-1.5 text-surface-muted">{page} / {pagination.pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.pages} className="btn-secondary text-xs px-3 py-1.5">Next →</button>
          </div>
        </div>
      )}

      {/* Exception detail modal */}
      {selected && selectedEx && (
        <ExceptionDetail exception={selectedEx} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
