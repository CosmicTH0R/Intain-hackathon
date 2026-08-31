export interface User {
  id: string;
  name: string;
  email: string;
  role: 'data_operator' | 'reviewer' | 'data_consumer';
}

export interface LoanRecord {
  id: string;
  loanId: string;
  borrowerId: string;
  loanType: string | null;
  originationDate: string | null;
  maturityDate: string | null;
  originalPrincipal: number | null;
  currentBalance: number | null;
  interestRate: number | null;
  termMonths: number | null;
  borrowerState: string | null;
  loanPurpose: string | null;
  creditGrade: string | null;
  paymentStatus: string | null;
  daysPastDue: number | null;
  documentStatus: string | null;
  sourceSystem: string | null;
  importBatchId: string;
  createdAt: string;
  exceptionsCount?: number;
  openExceptionsCount?: number;
  isVerified?: boolean;
}

export interface Exception {
  id: string;
  loanId: string;
  loanRecordId: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'approved' | 'rejected' | 'corrected';
  detectedAt: string;
  details: Record<string, unknown>;
  rule?: { name: string; description: string; type: string };
  loanRecord?: Partial<LoanRecord>;
}

export interface ReviewAction {
  id: string;
  exceptionId: string;
  reviewerId: string;
  action: string;
  comment: string | null;
  fieldChangesJson: string | null;
  timestamp: string;
  reviewer?: { name: string; email: string };
}

export interface AIRecommendation {
  id: string;
  exceptionId: string | null;
  loanId: string | null;
  endpoint: string;
  prompt: string;
  model: string;
  responseText: string;
  suggestedAction: string | null;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
}

export interface VerifiedLoanRecord {
  id: string;
  loanId: string;
  loanRecordId: string;
  canonicalData: Record<string, unknown>;
  sourceFileReference: string;
  validationResult: {
    totalExceptions: number;
    openExceptions: number;
    approvedExceptions: number;
    severities: Record<string, number>;
  };
  reviewerDecision: string;
  aiRecommendationRef: string | null;
  verificationTimestamp: string;
  verifiedBy: string;
  recordHash: string;
  verifiedUser?: { name: string; email: string };
}

export interface AuditEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  status: string;
}

export interface Summary {
  totalLoans: number;
  totalVerified: number;
  totalExceptions: number;
  openExceptions: number;
  dataQualityScore: number;
  exceptionByStatus: Record<string, number>;
  exceptionBySeverity: Record<string, number>;
  recentBatches: ImportBatch[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}
