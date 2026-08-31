import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, XCircle, AlertTriangle, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/client';

interface UploadResult {
  batchId: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  exceptionsFound?: number;
  summary?: { bySeverity: Record<string, number>; byRule: Record<string, number> };
}

interface FailedRow {
  rowNumber: number;
  rawContent: string;
  reason: string;
}

type FileType = 'loan-tape' | 'servicer-update' | 'document-manifest';

interface UploadZoneProps {
  type: FileType;
  label: string;
  description: string;
  onResult: (result: UploadResult) => void;
}

function UploadZone({ type, label, description, onResult }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/upload/${type}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onResult(data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [type, onResult]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
        ${isDragActive ? 'border-primary-500 bg-primary-900/20' : 'border-surface-border hover:border-primary-600/60 hover:bg-white/5'}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <Loader2 className="h-10 w-10 text-primary-400 animate-spin" />
        ) : (
          <div className="bg-primary-900/40 p-3 rounded-xl border border-primary-700/40">
            <Upload className="h-8 w-8 text-primary-400" />
          </div>
        )}
        <div>
          <div className="font-semibold text-white">{label}</div>
          <div className="text-sm text-surface-muted mt-1">{description}</div>
          <div className="text-xs text-primary-400 mt-2">
            {isDragActive ? 'Drop to upload' : 'Drag & drop CSV or click to browse'}
          </div>
        </div>
        {error && <div className="text-danger-400 text-sm">{error}</div>}
      </div>
    </div>
  );
}

function ResultCard({ result, onShowFailedRows }: { result: UploadResult; onShowFailedRows: () => void }) {
  const [showSummary, setShowSummary] = useState(false);
  const successRate = Math.round((result.importedRows / result.totalRows) * 100);

  return (
    <div className="card border-green-800/30 animate-slide-up">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-white">{result.fileName}</div>
          <div className="flex gap-6 mt-3 text-sm">
            <div>
              <div className="text-2xl font-bold text-white">{result.totalRows}</div>
              <div className="text-surface-muted text-xs">Total Rows</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{result.importedRows}</div>
              <div className="text-surface-muted text-xs">Imported</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{result.failedRows}</div>
              <div className="text-surface-muted text-xs">Failed</div>
              {result.failedRows > 0 && (
                <button onClick={onShowFailedRows} className="text-xs text-primary-400 hover:underline">
                  View failed rows →
                </button>
              )}
            </div>
            {result.exceptionsFound !== undefined && (
              <div>
                <div className="text-2xl font-bold text-yellow-400">{result.exceptionsFound}</div>
                <div className="text-surface-muted text-xs">Exceptions Found</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-surface-muted mb-1">
              <span>Import success rate</span><span>{successRate}%</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                   style={{ width: `${successRate}%` }} />
            </div>
          </div>

          {/* Exception summary */}
          {result.summary && result.exceptionsFound! > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
              >
                <AlertTriangle className="h-3 w-3" />
                Exception breakdown
                {showSummary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showSummary && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(result.summary.bySeverity).map(([sev, count]) => (
                    <div key={sev} className="flex items-center justify-between bg-surface px-2 py-1.5 rounded">
                      <span className={`badge-severity-${sev}`}>{sev}</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [results, setResults] = useState<Record<string, UploadResult>>({});
  const [failedRows, setFailedRows] = useState<FailedRow[] | null>(null);
  const [loadingFailed, setLoadingFailed] = useState(false);

  const handleResult = (type: string) => (result: UploadResult) => {
    setResults((prev) => ({ ...prev, [type]: result }));
  };

  const showFailedRows = async (batchId: string) => {
    setLoadingFailed(true);
    try {
      const { data } = await api.get(`/upload/failed-rows/${batchId}`);
      setFailedRows(data);
    } finally {
      setLoadingFailed(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Loan Data</h1>
        <p className="text-surface-muted text-sm mt-1">Upload CSV files in any order. Validation runs automatically after loan tape import.</p>
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UploadZone
          type="loan-tape"
          label="Loan Tape"
          description="loan_tape.csv — primary dataset (1,000–5,000 rows)"
          onResult={handleResult('loan-tape')}
        />
        <UploadZone
          type="servicer-update"
          label="Servicer Update"
          description="servicer_update.csv — partial field updates"
          onResult={handleResult('servicer-update')}
        />
        <UploadZone
          type="document-manifest"
          label="Document Manifest"
          description="document_manifest.csv — document availability"
          onResult={handleResult('document-manifest')}
        />
      </div>

      {/* Results */}
      {Object.entries(results).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Upload Results</h2>
          {Object.entries(results).map(([type, result]) => (
            <ResultCard
              key={type}
              result={result}
              onShowFailedRows={() => showFailedRows(result.batchId)}
            />
          ))}
        </div>
      )}

      {/* Failed rows modal */}
      {failedRows !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setFailedRows(null)}>
          <div className="card max-w-3xl w-full max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-white">Failed Rows ({failedRows.length})</h3>
              </div>
              <button onClick={() => setFailedRows(null)} className="text-surface-muted hover:text-white">✕</button>
            </div>
            <div className="space-y-2">
              {failedRows.map((row) => (
                <div key={row.rowNumber} className="bg-surface rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-red-400 font-semibold">Row {row.rowNumber}</span>
                    <span className="text-danger-400">{row.reason}</span>
                  </div>
                  <code className="text-surface-muted break-all">{row.rawContent}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card border-primary-800/30">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-primary-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Upload Tips</h3>
            <ul className="text-xs text-surface-muted space-y-1 list-disc list-inside">
              <li>Upload document_manifest.csv and servicer_update.csv before loan_tape.csv for best cross-validation results</li>
              <li>Malformed rows are isolated and reported — they never crash the entire import</li>
              <li>Raw data is stored alongside normalized data for full lineage</li>
              <li>Validation runs automatically after each loan tape upload — check Exception Queue for results</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
