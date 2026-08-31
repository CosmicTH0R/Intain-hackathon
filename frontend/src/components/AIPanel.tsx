import { useState } from 'react';
import { Bot, Check, X, Edit2, Clock, Cpu, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/client';
import type { AIRecommendation } from '../types';

interface AIPanelProps {
  exceptionId?: string;
  loanId?: string;
  onDecision?: (recId: string, status: 'accepted' | 'rejected' | 'edited') => void;
}

const ENDPOINTS = [
  { key: 'explain-exception', label: 'Explain Exception', icon: '💡', requiresException: true },
  { key: 'suggest-correction', label: 'Suggest Correction', icon: '🔧', requiresException: true },
  { key: 'compare-conflict', label: 'Compare Conflict', icon: '⚡', requiresLoan: true },
  { key: 'draft-note', label: 'Draft Reviewer Note', icon: '📝', requiresException: true },
  { key: 'classify-severity', label: 'Classify Severity', icon: '🎯', requiresException: true },
];

export default function AIPanel({ exceptionId, loanId, onDecision }: AIPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AIRecommendation & { id: string }>>({});
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const callAI = async (endpoint: string) => {
    setLoading(endpoint);
    try {
      const payload: Record<string, string> = {};
      if (exceptionId) payload.exceptionId = exceptionId;
      if (loanId) payload.loanId = loanId;

      const { data } = await api.post(`/ai/${endpoint}`, payload);
      setResults((prev) => ({ ...prev, [endpoint]: { ...data, status: 'pending' } }));
      setExpanded(endpoint);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'AI call failed';
      setResults((prev) => ({
        ...prev,
        [endpoint]: {
          id: 'error',
          responseText: `Error: ${errorMessage}`,
          status: 'pending',
          endpoint,
          prompt: '',
          model: '',
          suggestedAction: null,
          timestamp: new Date().toISOString(),
          exceptionId: exceptionId || null,
          loanId: loanId || null,
        },
      }));
    } finally {
      setLoading(null);
    }
  };

  const handleDecision = async (endpoint: string, status: 'accepted' | 'rejected' | 'edited') => {
    const rec = results[endpoint];
    if (!rec || rec.id === 'error') return;

    const payload: Record<string, string> = { status };
    if (status === 'edited') payload.editedResponse = editedText;

    await api.post(`/ai/recommendations/${rec.recommendationId || rec.id}/decision`, payload);
    setResults((prev) => ({ ...prev, [endpoint]: { ...rec, status } }));
    setEditMode(null);
    onDecision?.(rec.id, status);
  };

  const availableEndpoints = ENDPOINTS.filter((ep) => {
    if (ep.requiresException && !exceptionId) return false;
    if (ep.requiresLoan && !loanId && !exceptionId) return false;
    return true;
  });

  return (
    <div className="ai-panel animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-primary-600/30 p-2 rounded-lg border border-primary-600/40">
          <Bot className="h-5 w-5 text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">AI Review Assistant</h3>
          <p className="text-xs text-primary-300">Claude — suggestions only, human approval required</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-surface-muted">
          <Cpu className="h-3 w-3" />
          <span>claude-3-5-haiku</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {availableEndpoints.map((ep) => (
          <button
            key={ep.key}
            onClick={() => callAI(ep.key)}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                       bg-primary-900/40 hover:bg-primary-800/60 text-primary-300 border border-primary-700/50
                       transition-all duration-200 disabled:opacity-50"
          >
            {loading === ep.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{ep.icon}</span>}
            {ep.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {Object.entries(results).map(([endpoint, rec]) => (
        <div key={endpoint} className="mb-3 bg-black/20 rounded-lg border border-primary-800/30 overflow-hidden">
          {/* Result header */}
          <button
            onClick={() => setExpanded(expanded === endpoint ? null : endpoint)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{ENDPOINTS.find((e) => e.key === endpoint)?.icon}</span>
              <span className="text-sm font-medium text-slate-200">
                {ENDPOINTS.find((e) => e.key === endpoint)?.label}
              </span>
              {rec.status !== 'pending' && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  rec.status === 'accepted' ? 'bg-green-900/60 text-green-300' :
                  rec.status === 'rejected' ? 'bg-red-900/60 text-red-300' :
                  'bg-yellow-900/60 text-yellow-300'
                }`}>
                  {rec.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-surface-muted">
              <Clock className="h-3 w-3" />
              <span className="text-xs">{format(new Date(rec.timestamp), 'HH:mm:ss')}</span>
              {expanded === endpoint ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          {expanded === endpoint && (
            <div className="px-4 pb-4">
              {/* AI response — visually distinct */}
              {editMode === endpoint ? (
                <textarea
                  className="input text-sm h-32 font-mono resize-none mb-3"
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                />
              ) : (
                <div className="text-sm text-slate-300 whitespace-pre-wrap bg-black/30 rounded-lg p-3 mb-3 leading-relaxed">
                  {rec.responseText}
                </div>
              )}

              {rec.suggestedAction && (
                <div className="flex items-start gap-2 bg-primary-900/30 rounded-lg p-2.5 mb-3 border border-primary-800/30">
                  <span className="text-primary-400 text-xs font-semibold shrink-0 mt-0.5">Suggested Action:</span>
                  <span className="text-primary-300 text-xs">{rec.suggestedAction}</span>
                </div>
              )}

              {/* Decision controls — REQUIRED by spec, always visible */}
              {rec.status === 'pending' && rec.id !== 'error' && (
                <div className="flex items-center gap-2 pt-2 border-t border-primary-800/30">
                  <span className="text-xs text-surface-muted mr-1">Your decision:</span>
                  <button
                    onClick={() => handleDecision(endpoint, 'accepted')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-success-900/40 hover:bg-success-800/60
                               text-success-300 text-xs rounded-lg border border-success-800/40 transition-all"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  {editMode === endpoint ? (
                    <button
                      onClick={() => handleDecision(endpoint, 'edited')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-yellow-900/40 hover:bg-yellow-800/60
                                 text-yellow-300 text-xs rounded-lg border border-yellow-800/40 transition-all"
                    >
                      <Check className="h-3 w-3" /> Save Edit
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditMode(endpoint); setEditedText(rec.responseText); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-yellow-900/40 hover:bg-yellow-800/60
                                 text-yellow-300 text-xs rounded-lg border border-yellow-800/40 transition-all"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleDecision(endpoint, 'rejected')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-danger-900/40 hover:bg-danger-800/60
                               text-danger-300 text-xs rounded-lg border border-danger-800/40 transition-all"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {Object.keys(results).length === 0 && (
        <div className="text-center py-6 text-surface-muted text-sm">
          <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Select an AI capability above to get started.</p>
          <p className="text-xs mt-1">All responses require your explicit approval before any action is taken.</p>
        </div>
      )}
    </div>
  );
}
