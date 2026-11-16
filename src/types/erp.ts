export type RoleId = 'admin' | 'examiner' | 'moderator' | 'student';

export type NavSectionId =
  | 'overview'
  | 'students'
  | 'exams'
  | 'evaluation'
  | 'rubrics'
  | 'moderation'
  | 'approval'
  | 'revaluation'
  | 'credentials'
  | 'audit'
  | 'reports'
  | 'redesign'
  | 'settings'
  | 'student-portal';

export interface DemoAccount {
  id: string;
  name: string;
  role: RoleId;
  roleLabel: string;
  department: string;
  designation: string;
  studentId?: string;
}

export interface StudentSubjectResult {
  subjectCode: string;
  subjectName: string;
  credits: number;
  examDate: string;
  internalMarks: number;
  externalMarks: number | null;
  totalMarks: number | null;
  grade: string | null;
  published: boolean;
  scriptId?: string;
}

export interface StudentNotification {
  id: string;
  studentId: string;
  title: string;
  message: string;
  date: string;
  category: 'Result' | 'Revaluation' | 'Credential' | 'Notice';
  read: boolean;
}

export interface Student {
  studentId: string;
  name: string;
  email: string;
  department: string;
  program: string;
  semester: number;
  cgpa: number;
  advisor: string;
  standing: 'Active' | 'Disputed Record' | 'Graduating';
  registeredExams: string[];
  results: StudentSubjectResult[];
}

export interface Examination {
  examId: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  semester: number;
  examDate: string;
  examTime: string;
  durationMinutes: number;
  evaluationDeadline: string;
  totalEnrolled: number;
  scriptsSubmitted: number;
  assignedExaminerId: string;
  status:
    | 'Scheduled'
    | 'Scripts Collected'
    | 'Evaluation In Progress'
    | 'Moderation Review'
    | 'Results Published';
}

export interface ExamQuestion {
  questionId: string;
  examId: string;
  subjectCode: string;
  subjectName: string;
  questionNumber: string;
  questionType: 'Descriptive' | 'Analytical Problem' | 'Case Study' | 'Short Proof';
  bloomLevel: 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
  maxMarks: number;
  promptText: string;
  rubricId: string;
  createdBy: string;
  createdAt: string;
}

export type AssessmentKind =
  | 'Assignment'
  | 'Internal Assessment'
  | 'Lab Practical'
  | 'Quiz / Formative';

export interface AssessmentItem {
  assessmentId: string;
  title: string;
  kind: AssessmentKind;
  subjectCode: string;
  subjectName: string;
  department: string;
  dueDate: string;
  maxMarks: number;
  instructions: string;
  rubricId: string;
  createdBy: string;
  createdByName: string;
  status: 'Draft' | 'Published' | 'Closed';
  submissionsCount: number;
  submittedByStudentIds: string[];
}

export interface RubricConcept {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  keywords: string[];
}

export interface Rubric {
  rubricId: string;
  subjectCode: string;
  subjectName: string;
  questionNumber: string;
  maxMarks: number;
  concepts: RubricConcept[];
}

export type ModerationStatus = 'None' | 'Flagged' | 'Under Review' | 'Resolved';
export type ApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Correction Requested';

export interface AnswerScript {
  scriptId: string;
  sourceType?: 'End-Sem Script' | 'Assignment' | 'Internal Assessment';
  studentId: string;
  studentName: string;
  examId: string;
  subjectCode: string;
  subjectName: string;
  questionNumber: string;
  maxMarks: number;
  submittedAt: string;
  answerText: string;
  rubricId: string;
  examinerId: string;
  examinerName: string;
  evaluationStatus: 'Pending Evaluation' | 'Evaluated' | 'Correction Requested';
  suggestedMarks: number;
  matchedConcepts: string[];
  missingConcepts: string[];
  finalMarks: number | null;
  overrideReason: string;
  examinerNotes: string;
  evaluatedAt: string | null;
  moderationPriorityScore: number;
  moderationStatus: ModerationStatus;
  moderatorComments: string;
  moderationReviewedBy: string | null;
  moderationResolvedAt: string | null;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  approvalTimestamp: string | null;
  approvalNotes: string;
  published: boolean;
  version: number;
}

export interface ApprovalHistoryItem {
  id: string;
  scriptId: string;
  studentId: string;
  subjectCode: string;
  action: 'Approved' | 'Rejected' | 'Correction Requested' | 'Published';
  awardedMarks: number;
  actorId: string;
  actorName: string;
  timestamp: string;
  notes: string;
}

export type RevaluationStatus =
  | 'Submitted'
  | 'Assigned'
  | 'Under Review'
  | 'Resolved - Updated'
  | 'Resolved - No Change';

export interface RevaluationRequest {
  requestId: string;
  studentId: string;
  studentName: string;
  subjectCode: string;
  subjectName: string;
  scriptId: string;
  originalMarks: number;
  reason: string;
  submittedAt: string;
  assignedExaminerId: string | null;
  assignedExaminerName: string | null;
  status: RevaluationStatus;
  updatedMarks: number | null;
  resolutionNotes: string;
  resolvedAt: string | null;
}

export type CredentialVerificationStatus =
  | 'Valid'
  | 'Invalid'
  | 'Verification Unavailable';

export interface Credential {
  certificateId: string;
  studentId: string;
  studentName: string;
  degreeProgram: string;
  classification: string;
  cgpa: number;
  issueDate: string;
  status: CredentialVerificationStatus;
  localIntegrityHash: string;
  partnerRegistryRequired: boolean;
  revocationReason?: string;
}

export interface VerificationAttempt {
  id: string;
  certificateId: string;
  queriedBy: string;
  timestamp: string;
  externalServiceState: 'Online (Simulated)' | 'Unavailable (Partner Withdrawn)';
  outcome: CredentialVerificationStatus;
  note: string;
  retryEligible: boolean;
}

export interface AuditLogEntry {
  auditId: string;
  versionNumber: number;
  recordId: string;
  recordType:
    | 'AnswerScript'
    | 'StudentRecord'
    | 'Revaluation'
    | 'Credential'
    | 'Rubric'
    | 'Examination'
    | 'Question'
    | 'Assessment'
    | 'SystemConfig';
  action: string;
  previousValue: string;
  updatedValue: string;
  userResponsible: string;
  userRole: string;
  timestamp: string;
  reason: string;
}

export interface SystemConfig {
  reducedResourceMode: boolean;
  externalVerificationOnline: boolean;
  partnerWithdrawn: boolean;
  cs304DualModerationActive: boolean;
  disputedRecordCorrected: boolean;
  moderationVarianceThresholdPct: number;
  requireOverrideReason: boolean;
  academicSession: string;
}
