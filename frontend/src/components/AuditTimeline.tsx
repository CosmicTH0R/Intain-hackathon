import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Upload, AlertTriangle, CheckCircle, Bot, Edit2, MessageSquare,
  FileUp, Database, Shield, Activity, ChevronRight
} from 'lucide-react';
import api from '../api/client';
import type { AuditEntry } from '../types';

interface AuditTimelineProps {
  loanId: string;
}

const EVENT_META: Record<string, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  file_uploaded:             { icon: FileUp,       color: 'text-blue-400 bg-blue-900/30 border-blue-800',    label: 'File Uploaded' },
  loan_record_imported:      { icon: Database,      color: 'text-cyan-400 bg-cyan-900/30 border-cyan-800',    label: 'Record Imported' },
  validation_executed:       { icon: Activity,      color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800', label: 'Validation Run' },
  exception_created:         { icon: AlertTriangle, color: 'text-orange-400 bg-orange-900/30 border-orange-800', label: 'Exception Created' },
  ai_recommendation_generated: { icon: Bot,         color: 'text-purple-400 bg-purple-900/30 border-purple-800', label: 'AI Recommendation' },
  reviewer_comment_added:    { icon: MessageSquare, color: 'text-slate-400 bg-slate-900/30 border-slate-700', label: 'Comment Added' },
  field_edited:              { icon: Edit2,         color: 'text-amber-400 bg-amber-900/30 border-amber-800', label: 'Field Edited' },
  loan_approved:             { icon: CheckCircle,   color: 'text-green-400 bg-green-900/30 border-green-800', label: 'Loan Approved' },
  loan_rejected:             { icon: Shield,        color: 'text-red-400 bg-red-900/30 border-red-800',       label: 'Loan Rejected' },
  verified_record_created:   { icon: CheckCircle,   color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800', label: 'Verified Record Created' },
  verified_record_exported:  { icon: Upload,        color: 'text-teal-400 bg-teal-900/30 border-teal-800',   label: 'Record Exported' },
};

function DetailItem({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-surface-muted shrink-0">{label}:</span>
      <span className="text-slate-300 font-mono break-all">{String(value)}</span>
    </div>
  );
}

export default function AuditTimeline({ loanId }: AuditTimelineProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', loanId],
    queryFn: () => api.get(`/audit/${loanId}`).then((r) => r.data),
    enabled: !!loanId,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-surface-muted">
      <Activity className="h-5 w-5 animate-pulse mr-2" /> Loading audit trail…
    </div>
  );

  if (error) return (
    <div className="text-danger-400 text-sm py-4">Failed to load audit trail.</div>
  );

  const timeline: AuditEntry[] = data?.timeline ?? [];

  if (timeline.length === 0) return (
    <div className="text-center py-8 text-surface-muted text-sm">No audit events yet for this loan.</div>
  );

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Audit Trail</h3>
        <span className="text-xs text-surface-muted bg-surface-border px-2 py-1 rounded">
          {timeline.length} events
        </span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-surface-border" />

        <div className="space-y-1">
          {timeline.map((entry, idx) => {
            const meta = EVENT_META[entry.eventType] ?? {
              icon: ChevronRight,
              color: 'text-slate-400 bg-slate-900/30 border-slate-700',
              label: entry.eventType,
            };
            const Icon = meta.icon;
            const isLast = idx === timeline.length - 1;

            return (
              <div key={entry.id} className={`relative flex gap-4 pl-1 ${isLast ? '' : 'pb-2'} group`}>
                {/* Icon bubble */}
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${meta.color} transition-transform group-hover:scale-110`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 card py-3 px-4 mb-2 group-hover:border-primary-700/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white">{meta.label}</span>
                    <span className="text-xs text-surface-muted font-mono">
                      {format(new Date(entry.timestamp), 'MMM d, HH:mm:ss')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <DetailItem label="Actor" value={entry.actor} />
                    {!!entry.details.loanId && <DetailItem label="Loan ID" value={entry.details.loanId} />}
                    {!!entry.details.message && <DetailItem label="Message" value={entry.details.message} />}
                    {!!entry.details.action && <DetailItem label="Action" value={entry.details.action} />}
                    {!!entry.details.comment && <DetailItem label="Comment" value={entry.details.comment} />}
                    {!!entry.details.ruleName && <DetailItem label="Rule" value={entry.details.ruleName} />}
                    {!!entry.details.severity && <DetailItem label="Severity" value={entry.details.severity} />}
                    {!!entry.details.hash && (
                      <div className="text-xs mt-1.5 bg-surface rounded p-1.5 font-mono text-emerald-300 break-all">
                        SHA-256: {String(entry.details.hash)}
                      </div>
                    )}
                    {!!entry.details.before && (
                      <div className="text-xs mt-1">
                        <span className="text-red-400">Before: </span>
                        <span className="font-mono text-slate-400">{JSON.stringify(entry.details.before)}</span>
                        <span className="text-green-400 ml-2">After: </span>
                        <span className="font-mono text-slate-400">{JSON.stringify(entry.details.after)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
