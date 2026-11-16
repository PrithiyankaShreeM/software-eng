import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AnswerScript,
  ApprovalHistoryItem,
  AssessmentItem,
  AssessmentKind,
  AuditLogEntry,
  Credential,
  CredentialVerificationStatus,
  DemoAccount,
  Examination,
  ExamQuestion,
  NavSectionId,
  RevaluationRequest,
  RoleId,
  Rubric,
  RubricConcept,
  Student,
  StudentNotification,
  SystemConfig,
  VerificationAttempt,
} from '../types/erp';
import {
  DEMO_ACCOUNTS,
  INITIAL_APPROVAL_HISTORY,
  INITIAL_ASSESSMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CREDENTIALS,
  INITIAL_EXAM_QUESTIONS,
  INITIAL_EXAMS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REVALUATIONS,
  INITIAL_RUBRICS,
  INITIAL_SCRIPTS,
  INITIAL_STUDENTS,
  INITIAL_SYSTEM_CONFIG,
  INITIAL_VERIFICATION_HISTORY,
} from '../data/mockData';
import {
  calculateModerationPriority,
  evaluateAnswerWithRubric,
} from '../utils/rubricEngine';

export interface NavItemConfig {
  id: NavSectionId;
  code: string;
  label: string;
  group: 'Operations' | 'Evaluation & Governance' | 'Credentials & Audit' | 'System';
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', code: '01', label: 'Overview', group: 'Operations' },
  { id: 'students', code: '02', label: 'Student Management', group: 'Operations' },
  { id: 'exams', code: '03', label: 'Examination Management', group: 'Operations' },
  {
    id: 'evaluation',
    code: '04',
    label: 'Answer Script Evaluation',
    group: 'Evaluation & Governance',
  },
  {
    id: 'rubrics',
    code: '05',
    label: 'Rubric-Based Assessment',
    group: 'Evaluation & Governance',
  },
  {
    id: 'moderation',
    code: '06',
    label: 'Moderation & Anomaly Detection',
    group: 'Evaluation & Governance',
  },
  {
    id: 'approval',
    code: '07',
    label: 'Mark Approval',
    group: 'Evaluation & Governance',
  },
  {
    id: 'revaluation',
    code: '08',
    label: 'Revaluation Requests',
    group: 'Evaluation & Governance',
  },
  {
    id: 'credentials',
    code: '09',
    label: 'Credential Management',
    group: 'Credentials & Audit',
  },
  {
    id: 'audit',
    code: '10',
    label: 'Audit Logs',
    group: 'Credentials & Audit',
  },
  {
    id: 'reports',
    code: '11',
    label: 'Reports & Analytics',
    group: 'Credentials & Audit',
  },
  {
    id: 'redesign',
    code: 'T6',
    label: 'Redesign Scenario (Task 6)',
    group: 'System',
  },
  { id: 'settings', code: '12', label: 'System Settings', group: 'System' },
];

export const STUDENT_NAV_ITEMS: NavItemConfig[] = [
  { id: 'student-portal', code: '01', label: 'Student Dashboard', group: 'Operations' },
  {
    id: 'credentials',
    code: '02',
    label: 'My Credentials',
    group: 'Credentials & Audit',
  },
];

export const ROLE_ALLOWED_SECTIONS: Record<RoleId, NavSectionId[]> = {
  admin: [
    'overview',
    'students',
    'exams',
    'evaluation',
    'rubrics',
    'moderation',
    'approval',
    'revaluation',
    'credentials',
    'audit',
    'reports',
    'redesign',
    'settings',
  ],
  examiner: ['overview', 'exams', 'evaluation', 'rubrics', 'revaluation'],
  moderator: ['overview', 'moderation', 'rubrics', 'audit', 'redesign'],
  student: ['student-portal', 'credentials'],
};

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  tone: 'mint' | 'neutral' | 'warning';
}

interface PersistedState {
  activeRole: RoleId;
  activeStudentId: string;
  activeSection: NavSectionId;
  students: Student[];
  exams: Examination[];
  examQuestions: ExamQuestion[];
  assessments: AssessmentItem[];
  rubrics: Rubric[];
  scripts: AnswerScript[];
  approvalHistory: ApprovalHistoryItem[];
  revaluations: RevaluationRequest[];
  credentials: Credential[];
  verificationHistory: VerificationAttempt[];
  auditLogs: AuditLogEntry[];
  notifications: StudentNotification[];
  config: SystemConfig;
}

const STORAGE_KEY = 'kaveri_erp_state_v1';

function nowTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getInitialPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed && Array.isArray(parsed.scripts) && Array.isArray(parsed.students)) {
        const validRoles: RoleId[] = ['admin', 'examiner', 'moderator', 'student'];
        const safeRole: RoleId = validRoles.includes(parsed.activeRole as RoleId)
          ? (parsed.activeRole as RoleId)
          : 'admin';
        const allowed = ROLE_ALLOWED_SECTIONS[safeRole];
        const safeSection = allowed.includes(parsed.activeSection as NavSectionId)
          ? (parsed.activeSection as NavSectionId)
          : allowed[0];

        const safeExams = Array.isArray(parsed.exams)
          ? parsed.exams.map((ex) => {
              const seedMatch = INITIAL_EXAMS.find((s) => s.examId === ex.examId);
              return {
                ...ex,
                examTime: ex.examTime ?? seedMatch?.examTime ?? '09:30 AM – 12:30 PM',
                durationMinutes:
                  typeof ex.durationMinutes === 'number'
                    ? ex.durationMinutes
                    : seedMatch?.durationMinutes ?? 180,
              };
            })
          : INITIAL_EXAMS;

        return {
          ...(parsed as PersistedState),
          activeRole: safeRole,
          activeSection: safeSection,
          exams: safeExams,
          examQuestions: parsed.examQuestions ?? INITIAL_EXAM_QUESTIONS,
          assessments: parsed.assessments ?? INITIAL_ASSESSMENTS,
        };
      }
    }
  } catch {
    // fallback to seed state
  }

  return {
    activeRole: 'admin',
    activeStudentId: 'STU-2026-104',
    activeSection: 'overview',
    students: INITIAL_STUDENTS,
    exams: INITIAL_EXAMS,
    examQuestions: INITIAL_EXAM_QUESTIONS,
    assessments: INITIAL_ASSESSMENTS,
    rubrics: INITIAL_RUBRICS,
    scripts: INITIAL_SCRIPTS,
    approvalHistory: INITIAL_APPROVAL_HISTORY,
    revaluations: INITIAL_REVALUATIONS,
    credentials: INITIAL_CREDENTIALS,
    verificationHistory: INITIAL_VERIFICATION_HISTORY,
    auditLogs: INITIAL_AUDIT_LOGS,
    notifications: INITIAL_NOTIFICATIONS,
    config: INITIAL_SYSTEM_CONFIG,
  };
}

interface ErpContextValue {
  activeRole: RoleId;
  activeAccount: DemoAccount;
  activeStudentId: string;
  activeSection: NavSectionId;
  visibleNavItems: NavItemConfig[];
  students: Student[];
  exams: Examination[];
  examQuestions: ExamQuestion[];
  assessments: AssessmentItem[];
  rubrics: Rubric[];
  scripts: AnswerScript[];
  approvalHistory: ApprovalHistoryItem[];
  revaluations: RevaluationRequest[];
  credentials: Credential[];
  verificationHistory: VerificationAttempt[];
  auditLogs: AuditLogEntry[];
  notifications: StudentNotification[];
  config: SystemConfig;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  setActiveSection: (section: NavSectionId) => void;
  switchRole: (role: RoleId, studentId?: string) => void;
  setActiveStudentId: (studentId: string) => void;
  addStudent: (student: Omit<Student, 'results' | 'registeredExams'>) => void;
  addExam: (exam: Examination) => void;
  updateExamStatus: (examId: string, status: Examination['status']) => void;
  addExamQuestion: (params: {
    examId: string;
    questionNumber: string;
    questionType: ExamQuestion['questionType'];
    bloomLevel: ExamQuestion['bloomLevel'];
    maxMarks: number;
    promptText: string;
    conceptTitle: string;
    keywordsCsv: string;
  }) => void;
  addAssessment: (params: {
    title: string;
    kind: AssessmentKind;
    subjectCode: string;
    dueDate: string;
    maxMarks: number;
    instructions: string;
    conceptTitle: string;
    keywordsCsv: string;
    publishImmediately: boolean;
  }) => void;
  updateAssessmentStatus: (
    assessmentId: string,
    status: AssessmentItem['status']
  ) => void;
  submitStudentAssessment: (params: {
    assessmentId: string;
    studentId: string;
    answerText: string;
  }) => { ok: boolean; error?: string };
  createRubric: (params: {
    subjectCode: string;
    subjectName: string;
    questionNumber: string;
    conceptTitle: string;
    conceptDescription: string;
    maxPoints: number;
    keywordsCsv: string;
  }) => void;
  saveScriptEvaluation: (params: {
    scriptId: string;
    finalMarks: number;
    overrideReason: string;
    examinerNotes: string;
  }) => { ok: boolean; error?: string };
  flagScriptForModeration: (scriptId: string, comment: string) => void;
  addModeratorComment: (scriptId: string, comment: string) => void;
  resolveModerationDiscrepancy: (params: {
    scriptId: string;
    resolvedMarks: number;
    resolutionComment: string;
  }) => void;
  approveScript: (scriptId: string, notes: string) => { ok: boolean; error?: string };
  rejectScript: (scriptId: string, reason: string) => void;
  requestCorrection: (scriptId: string, reason: string) => void;
  publishScriptResult: (scriptId: string) => void;
  submitRevaluation: (params: {
    studentId: string;
    subjectCode: string;
    reason: string;
  }) => { ok: boolean; error?: string };
  assignRevaluationExaminer: (
    requestId: string,
    examinerId: string,
    examinerName: string
  ) => void;
  resolveRevaluation: (params: {
    requestId: string;
    updatedMarks: number;
    resolutionNotes: string;
  }) => void;
  issueCredential: (params: {
    studentId: string;
    degreeProgram: string;
    classification: string;
    partnerRegistryRequired: boolean;
  }) => Credential | null;
  verifyCredential: (certificateId: string) => VerificationAttempt;
  retryVerificationAttempt: (attemptId: string) => VerificationAttempt | null;
  recordDisputedCorrection: (params: {
    recordId: string;
    recordType: AuditLogEntry['recordType'];
    previousValue: string;
    updatedValue: string;
    reason: string;
    markStudentStandingActive?: string;
    updatedScriptMarks?: { scriptId: string; newMarks: number };
  }) => void;
  addRubricConcept: (rubricId: string, concept: Omit<RubricConcept, 'id'>) => void;
  updateRubricConcept: (rubricId: string, concept: RubricConcept) => void;
  toggleReducedResourceMode: (enabled: boolean) => void;
  togglePartnerWithdrawn: (withdrawn: boolean) => void;
  activateCs304DualModeration: (enabled: boolean) => void;
  updateSystemConfig: (partial: Partial<SystemConfig>) => void;
  markStudentNotificationRead: (id: string) => void;
  resetDemoData: () => void;
}

const ErpContext = createContext<ErpContextValue | null>(null);

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(() => getInitialPersistedState());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota error
    }
  }, [state]);

  const pushToast = (title: string, detail?: string, tone: ToastMessage['tone'] = 'mint') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, detail, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const activeAccount = useMemo<DemoAccount>(() => {
    if (state.activeRole === 'student') {
      const student = state.students.find((s) => s.studentId === state.activeStudentId);
      if (student) {
        return {
          id: student.studentId,
          name: student.name,
          role: 'student',
          roleLabel: 'Student',
          department: student.department,
          designation: `${student.program} · Semester ${student.semester}`,
          studentId: student.studentId,
        };
      }
    }
    return (
      DEMO_ACCOUNTS.find((a) => a.role === state.activeRole) ?? DEMO_ACCOUNTS[0]
    );
  }, [state.activeRole, state.activeStudentId, state.students]);

  const visibleNavItems = useMemo(() => {
    if (state.activeRole === 'student') {
      return STUDENT_NAV_ITEMS;
    }
    const allowed = new Set(ROLE_ALLOWED_SECTIONS[state.activeRole]);
    return ALL_NAV_ITEMS.filter((item) => allowed.has(item.id));
  }, [state.activeRole]);

  const makeAuditEntry = (
    logs: AuditLogEntry[],
    entry: Omit<AuditLogEntry, 'auditId' | 'versionNumber' | 'timestamp'>
  ): AuditLogEntry => {
    const existingCount = logs.filter((l) => l.recordId === entry.recordId).length;
    const nextNum = 1043 + logs.length;
    return {
      ...entry,
      auditId: `AUD-${nextNum}`,
      versionNumber: existingCount + 1,
      timestamp: nowTimestamp(),
    };
  };

  const setActiveSection = (section: NavSectionId) => {
    const allowed = ROLE_ALLOWED_SECTIONS[state.activeRole];
    if (!allowed.includes(section)) {
      pushToast(
        'Access Restricted',
        `Role "${activeAccount.roleLabel}" does not have permission for that section.`,
        'warning'
      );
      return;
    }
    setState((prev) => ({ ...prev, activeSection: section }));
  };

  const switchRole = (role: RoleId, studentId?: string) => {
    const allowed = ROLE_ALLOWED_SECTIONS[role];
    const nextSection = allowed.includes(state.activeSection)
      ? state.activeSection
      : allowed[0];

    setState((prev) => ({
      ...prev,
      activeRole: role,
      activeStudentId: studentId ?? prev.activeStudentId,
      activeSection: nextSection,
    }));

    const accountLabel =
      role === 'student'
        ? state.students.find((s) => s.studentId === (studentId ?? state.activeStudentId))
            ?.name ?? 'Student'
        : DEMO_ACCOUNTS.find((a) => a.role === role)?.roleLabel ?? role;

    pushToast(`Switched Role View: ${accountLabel}`, 'Navigation and permissions updated.');
  };

  const setActiveStudentId = (studentId: string) => {
    setState((prev) => ({ ...prev, activeStudentId: studentId }));
  };

  const addStudent = (studentData: Omit<Student, 'results' | 'registeredExams'>) => {
    const newStudent: Student = {
      ...studentData,
      registeredExams: ['EXM-26-CS301'],
      results: [],
    };
    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: newStudent.studentId,
        recordType: 'StudentRecord',
        action: 'Student Registered',
        previousValue: 'None',
        updatedValue: `${newStudent.name} (${newStudent.program})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'New university student profile created.',
      });
      return {
        ...prev,
        students: [newStudent, ...prev.students],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Student Added', `${studentData.studentId} · ${studentData.name}`);
  };

  const addExam = (exam: Examination) => {
    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: exam.examId,
        recordType: 'Examination',
        action: 'Examination Scheduled',
        previousValue: 'None',
        updatedValue: `${exam.subjectCode} (${exam.examDate})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Scheduled examination session in registry.',
      });
      return {
        ...prev,
        exams: [exam, ...prev.exams],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Examination Scheduled', `${exam.examId} · ${exam.subjectCode}`);
  };

  const updateExamStatus = (examId: string, status: Examination['status']) => {
    setState((prev) => {
      const target = prev.exams.find((e) => e.examId === examId);
      if (!target) return prev;
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: examId,
        recordType: 'Examination',
        action: 'Exam Status Updated',
        previousValue: target.status,
        updatedValue: status,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: `Updated examination phase to ${status}.`,
      });
      return {
        ...prev,
        exams: prev.exams.map((e) => (e.examId === examId ? { ...e, status } : e)),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Exam Status Updated', `${examId} is now ${status}`);
  };

  const saveScriptEvaluation: ErpContextValue['saveScriptEvaluation'] = ({
    scriptId,
    finalMarks,
    overrideReason,
    examinerNotes,
  }) => {
    const script = state.scripts.find((s) => s.scriptId === scriptId);
    if (!script) return { ok: false, error: 'Script not found.' };

    if (finalMarks < 0 || finalMarks > script.maxMarks || Number.isNaN(finalMarks)) {
      return {
        ok: false,
        error: `Marks must be between 0 and ${script.maxMarks}.`,
      };
    }

    const isOverride = Math.abs(finalMarks - script.suggestedMarks) > 0.01;
    if (isOverride && state.config.requireOverrideReason && !overrideReason.trim()) {
      return {
        ok: false,
        error:
          'Mandatory reason required whenever examiner marks differ from rule-based suggestion.',
      };
    }

    const rubric = state.rubrics.find((r) => r.rubricId === script.rubricId);
    const modBreakdown = calculateModerationPriority({
      suggestedMarks: script.suggestedMarks,
      finalMarks,
      maxMarks: script.maxMarks,
      subjectCode: script.subjectCode,
      examinerId: script.examinerId,
      cs304DualModerationActive: state.config.cs304DualModerationActive,
      missingConceptCount: script.missingConcepts.length,
      totalConceptCount: rubric?.concepts.length ?? 4,
    });

    const diffPct = (Math.abs(finalMarks - script.suggestedMarks) / script.maxMarks) * 100;
    const autoFlag =
      diffPct >= state.config.moderationVarianceThresholdPct ||
      (script.subjectCode === 'CS304' && state.config.cs304DualModerationActive);

    setState((prev) => {
      const prevDesc =
        script.finalMarks === null
          ? `Pending (Suggested: ${script.suggestedMarks}/${script.maxMarks})`
          : `Final Marks: ${script.finalMarks}/${script.maxMarks}`;

      const updatedScript: AnswerScript = {
        ...script,
        evaluationStatus: 'Evaluated',
        finalMarks,
        overrideReason: isOverride ? overrideReason.trim() : '',
        examinerNotes: examinerNotes.trim(),
        evaluatedAt: nowTimestamp(),
        moderationPriorityScore: modBreakdown.score,
        moderationStatus: autoFlag
          ? 'Flagged'
          : script.moderationStatus === 'Under Review'
          ? 'Resolved'
          : 'None',
        moderatorComments: autoFlag
          ? `Auto-flagged: deterministic delta ${diffPct.toFixed(0)}% (Priority ${modBreakdown.score}).`
          : script.moderatorComments,
        approvalStatus: 'Pending',
        version: script.version + 1,
      };

      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: script.scriptId,
        recordType: 'AnswerScript',
        action: isOverride ? 'Mark Override' : 'Mark Saved',
        previousValue: prevDesc,
        updatedValue: `Final Marks: ${finalMarks}/${script.maxMarks}${
          autoFlag ? ' [Flagged for Moderation]' : ''
        }`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: isOverride
          ? overrideReason.trim()
          : 'Accepted rule-based suggestion after human verification.',
      });

      return {
        ...prev,
        scripts: prev.scripts.map((s) => (s.scriptId === scriptId ? updatedScript : s)),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast(
      autoFlag ? 'Evaluation Saved & Flagged for Moderation' : 'Evaluation Saved',
      `${script.scriptId} awarded ${finalMarks}/${script.maxMarks}`
    );
    return { ok: true };
  };

  const flagScriptForModeration = (scriptId: string, comment: string) => {
    setState((prev) => {
      const target = prev.scripts.find((s) => s.scriptId === scriptId);
      if (!target) return prev;
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: scriptId,
        recordType: 'AnswerScript',
        action: 'Moderation Flagged',
        previousValue: `Moderation: ${target.moderationStatus}`,
        updatedValue: 'Moderation: Flagged',
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: comment.trim() || 'Manual moderation flag raised.',
      });
      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId
            ? {
                ...s,
                moderationStatus: 'Flagged',
                moderatorComments: comment.trim() || s.moderatorComments,
                moderationReviewedBy: activeAccount.id,
              }
            : s
        ),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Flagged for Moderation', `${scriptId} queued for moderation review`, 'warning');
  };

  const addModeratorComment = (scriptId: string, comment: string) => {
    if (!comment.trim()) return;
    setState((prev) => {
      const target = prev.scripts.find((s) => s.scriptId === scriptId);
      if (!target) return prev;
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: scriptId,
        recordType: 'AnswerScript',
        action: 'Moderation Comment Added',
        previousValue: target.moderatorComments || 'No comments',
        updatedValue: comment.trim(),
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Moderator review documentation.',
      });
      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId
            ? {
                ...s,
                moderationStatus:
                  s.moderationStatus === 'None' ? 'Under Review' : s.moderationStatus,
                moderatorComments: comment.trim(),
                moderationReviewedBy: activeAccount.id,
              }
            : s
        ),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Moderation Comment Saved', scriptId);
  };

  const resolveModerationDiscrepancy = ({
    scriptId,
    resolvedMarks,
    resolutionComment,
  }: {
    scriptId: string;
    resolvedMarks: number;
    resolutionComment: string;
  }) => {
    setState((prev) => {
      const target = prev.scripts.find((s) => s.scriptId === scriptId);
      if (!target) return prev;
      const prevMarks = target.finalMarks ?? target.suggestedMarks;
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: scriptId,
        recordType: 'AnswerScript',
        action: 'Discrepancy Resolved',
        previousValue: `Marks: ${prevMarks}/${target.maxMarks} (${target.moderationStatus})`,
        updatedValue: `Marks: ${resolvedMarks}/${target.maxMarks} (Resolved)`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: resolutionComment.trim() || 'Moderation discrepancy formally resolved.',
      });
      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId
            ? {
                ...s,
                finalMarks: resolvedMarks,
                moderationStatus: 'Resolved',
                moderatorComments: resolutionComment.trim() || s.moderatorComments,
                moderationReviewedBy: activeAccount.id,
                moderationResolvedAt: nowTimestamp(),
                version: s.version + 1,
              }
            : s
        ),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Moderation Discrepancy Resolved', `${scriptId} cleared for mark approval`);
  };

  const approveScript = (scriptId: string, notes: string) => {
    const target = state.scripts.find((s) => s.scriptId === scriptId);
    if (!target) return { ok: false, error: 'Script not found.' };
    if (target.evaluationStatus !== 'Evaluated' || target.finalMarks === null) {
      return { ok: false, error: 'Script must complete evaluation before approval.' };
    }
    if (
      target.moderationStatus === 'Flagged' ||
      target.moderationStatus === 'Under Review'
    ) {
      return {
        ok: false,
        error:
          'Script has an unresolved moderation flag. Resolve discrepancy in Moderation before approval.',
      };
    }

    const awarded = target.finalMarks;
    setState((prev) => {
      const hist: ApprovalHistoryItem = {
        id: `APR-${906 + prev.approvalHistory.length}`,
        scriptId: target.scriptId,
        studentId: target.studentId,
        subjectCode: target.subjectCode,
        action: 'Approved',
        awardedMarks: awarded,
        actorId: activeAccount.id,
        actorName: activeAccount.name,
        timestamp: nowTimestamp(),
        notes: notes.trim() || 'Approved by Examination Administrator.',
      };
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: target.scriptId,
        recordType: 'AnswerScript',
        action: 'Mark Approved',
        previousValue: `Approval: ${target.approvalStatus}`,
        updatedValue: `Approval: Approved (${awarded}/${target.maxMarks})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: notes.trim() || 'Approved for result publication.',
      });
      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId
            ? {
                ...s,
                approvalStatus: 'Approved',
                approvedBy: activeAccount.id,
                approvalTimestamp: nowTimestamp(),
                approvalNotes: notes.trim() || 'Approved.',
              }
            : s
        ),
        approvalHistory: [hist, ...prev.approvalHistory],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Marks Approved', `${scriptId} approved (${awarded}/${target.maxMarks})`);
    return { ok: true };
  };

  const rejectScript = (scriptId: string, reason: string) => {
    const target = state.scripts.find((s) => s.scriptId === scriptId);
    if (!target) return;
    setState((prev) => {
      const hist: ApprovalHistoryItem = {
        id: `APR-${906 + prev.approvalHistory.length}`,
        scriptId: target.scriptId,
        studentId: target.studentId,
        subjectCode: target.subjectCode,
        action: 'Rejected',
        awardedMarks: target.finalMarks ?? 0,
        actorId: activeAccount.id,
        actorName: activeAccount.name,
        timestamp: nowTimestamp(),
        notes: reason.trim() || 'Rejected by Examination Administrator.',
      };
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: target.scriptId,
        recordType: 'AnswerScript',
        action: 'Mark Rejected',
        previousValue: `Approval: ${target.approvalStatus}`,
        updatedValue: 'Approval: Rejected',
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: reason.trim() || 'Rejected pending formal re-evaluation.',
      });
      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId
            ? {
                ...s,
                approvalStatus: 'Rejected',
                approvedBy: activeAccount.id,
                approvalTimestamp: nowTimestamp(),
                approvalNotes: reason.trim() || 'Rejected.',
                published: false,
              }
            : s
        ),
        approvalHistory: [hist, ...prev.approvalHistory],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Evaluation Rejected', `${scriptId} marked Rejected`, 'warning');
  };

  const requestCorrection = (scriptId: string, reason: string) => {
    const target = state.scripts.find((s) => s.scriptId === scriptId);
    if (!target) return;
    setState((prev) => {
      const hist: ApprovalHistoryItem = {
        id: `APR-${906 + prev.approvalHistory.length}`,
        scriptId: target.scriptId,
        studentId: target.studentId,
        subjectCode: target.subjectCode,
        action: 'Correction Requested',
        awardedMarks: target.finalMarks ?? 0,
        actorId: activeAccount.id,
        actorName: activeAccount.name,
        timestamp: nowTimestamp(),
        notes: reason.trim() || 'Returned to examiner for correction.',
      };
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: target.scriptId,
        recordType: 'AnswerScript',
        action: 'Correction Requested',
        previousValue: `Approval: ${target.approvalStatus}`,
        updatedValue: 'Approval: Correction Requested',
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: reason.trim() || 'Returned to examiner for review.',
      });
      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId
            ? {
                ...s,
                evaluationStatus: 'Correction Requested',
                approvalStatus: 'Correction Requested',
                approvedBy: activeAccount.id,
                approvalTimestamp: nowTimestamp(),
                approvalNotes: reason.trim() || 'Returned for correction.',
                published: false,
              }
            : s
        ),
        approvalHistory: [hist, ...prev.approvalHistory],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Returned for Correction', `${scriptId} sent back to Examiner`);
  };

  const computeGrade = (total: number): string => {
    if (total >= 90) return 'O';
    if (total >= 80) return 'A+';
    if (total >= 70) return 'A';
    if (total >= 60) return 'B+';
    if (total >= 50) return 'B';
    if (total >= 40) return 'C';
    return 'F';
  };

  const publishScriptResult = (scriptId: string) => {
    const target = state.scripts.find((s) => s.scriptId === scriptId);
    if (!target || target.approvalStatus !== 'Approved' || target.finalMarks === null) return;

    setState((prev) => {
      const scaledExternal = Math.round((target.finalMarks! / target.maxMarks) * 60);
      const updatedStudents = prev.students.map((st) => {
        if (st.studentId !== target.studentId) return st;
        const existingResult = st.results.find((r) => r.subjectCode === target.subjectCode);
        if (existingResult) {
          return {
            ...st,
            results: st.results.map((r) => {
              if (r.subjectCode !== target.subjectCode) return r;
              const total = r.internalMarks + scaledExternal;
              return {
                ...r,
                externalMarks: scaledExternal,
                totalMarks: total,
                grade: computeGrade(total),
                published: true,
              };
            }),
          };
        }
        const total = 34 + scaledExternal;
        return {
          ...st,
          results: [
            ...st.results,
            {
              subjectCode: target.subjectCode,
              subjectName: target.subjectName,
              credits: 4,
              examDate: '2026-11-08',
              internalMarks: 34,
              externalMarks: scaledExternal,
              totalMarks: total,
              grade: computeGrade(total),
              published: true,
              scriptId: target.scriptId,
            },
          ],
        };
      });

      const hist: ApprovalHistoryItem = {
        id: `APR-${906 + prev.approvalHistory.length}`,
        scriptId: target.scriptId,
        studentId: target.studentId,
        subjectCode: target.subjectCode,
        action: 'Published',
        awardedMarks: target.finalMarks!,
        actorId: activeAccount.id,
        actorName: activeAccount.name,
        timestamp: nowTimestamp(),
        notes: 'Published to student portal.',
      };

      const notif: StudentNotification = {
        id: `NOTIF-${Date.now()}`,
        studentId: target.studentId,
        title: `${target.subjectCode} Result Published`,
        message: `Your result for ${target.subjectName} has been officially published.`,
        date: todayDate(),
        category: 'Result',
        read: false,
      };

      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: target.scriptId,
        recordType: 'AnswerScript',
        action: 'Result Published',
        previousValue: 'Published: No',
        updatedValue: `Published: Yes (${target.subjectCode})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Final result published to student record.',
      });

      return {
        ...prev,
        scripts: prev.scripts.map((s) =>
          s.scriptId === scriptId ? { ...s, published: true } : s
        ),
        students: updatedStudents,
        approvalHistory: [hist, ...prev.approvalHistory],
        notifications: [notif, ...prev.notifications],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Result Published', `${target.studentId} · ${target.subjectCode} now live`);
  };

  const submitRevaluation: ErpContextValue['submitRevaluation'] = ({
    studentId,
    subjectCode,
    reason,
  }) => {
    const student = state.students.find((s) => s.studentId === studentId);
    if (!student) return { ok: false, error: 'Student not found.' };
    const result = student.results.find(
      (r) => r.subjectCode === subjectCode && r.published && r.totalMarks !== null
    );
    if (!result || result.totalMarks === null) {
      return { ok: false, error: 'Only published subjects are eligible for revaluation.' };
    }
    if (!reason.trim()) {
      return { ok: false, error: 'Please state a valid reason for revaluation.' };
    }

    const newReq: RevaluationRequest = {
      requestId: `REV-2026-0${45 + state.revaluations.length}`,
      studentId: student.studentId,
      studentName: student.name,
      subjectCode: result.subjectCode,
      subjectName: result.subjectName,
      scriptId: result.scriptId ?? `SCR-${result.subjectCode}-${student.studentId.slice(-3)}`,
      originalMarks: result.totalMarks,
      reason: reason.trim(),
      submittedAt: nowTimestamp(),
      assignedExaminerId: null,
      assignedExaminerName: null,
      status: 'Submitted',
      updatedMarks: null,
      resolutionNotes: '',
      resolvedAt: null,
    };

    setState((prev) => {
      const notif: StudentNotification = {
        id: `NOTIF-${Date.now()}`,
        studentId: student.studentId,
        title: `Revaluation ${newReq.requestId} Submitted`,
        message: `Your revaluation request for ${result.subjectCode} (Original Marks: ${result.totalMarks}) has been registered.`,
        date: todayDate(),
        category: 'Revaluation',
        read: false,
      };
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: newReq.requestId,
        recordType: 'Revaluation',
        action: 'Revaluation Submitted',
        previousValue: `Published Marks: ${result.totalMarks}/100`,
        updatedValue: `Request Submitted (${result.subjectCode})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: reason.trim(),
      });
      return {
        ...prev,
        revaluations: [newReq, ...prev.revaluations],
        notifications: [notif, ...prev.notifications],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast('Revaluation Request Filed', `${newReq.requestId} · ${subjectCode}`);
    return { ok: true };
  };

  const assignRevaluationExaminer = (
    requestId: string,
    examinerId: string,
    examinerName: string
  ) => {
    setState((prev) => {
      const target = prev.revaluations.find((r) => r.requestId === requestId);
      if (!target) return prev;
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: requestId,
        recordType: 'Revaluation',
        action: 'Revaluation Assigned',
        previousValue: target.assignedExaminerId ?? 'Unassigned',
        updatedValue: `${examinerId} (${examinerName})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Assigned independent examiner for revaluation.',
      });
      return {
        ...prev,
        revaluations: prev.revaluations.map((r) =>
          r.requestId === requestId
            ? {
                ...r,
                assignedExaminerId: examinerId,
                assignedExaminerName: examinerName,
                status: 'Assigned',
              }
            : r
        ),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Examiner Assigned', `${requestId} assigned to ${examinerName}`);
  };

  const resolveRevaluation = ({
    requestId,
    updatedMarks,
    resolutionNotes,
  }: {
    requestId: string;
    updatedMarks: number;
    resolutionNotes: string;
  }) => {
    const target = state.revaluations.find((r) => r.requestId === requestId);
    if (!target) return;
    const changed = updatedMarks !== target.originalMarks;
    const status = changed ? 'Resolved - Updated' : 'Resolved - No Change';

    setState((prev) => {
      const updatedStudents = changed
        ? prev.students.map((st) => {
            if (st.studentId !== target.studentId) return st;
            return {
              ...st,
              results: st.results.map((res) =>
                res.subjectCode === target.subjectCode
                  ? {
                      ...res,
                      totalMarks: updatedMarks,
                      grade: computeGrade(updatedMarks),
                    }
                  : res
              ),
            };
          })
        : prev.students;

      const notif: StudentNotification = {
        id: `NOTIF-${Date.now()}`,
        studentId: target.studentId,
        title: `Revaluation ${requestId} Resolved`,
        message: changed
          ? `${target.subjectCode} marks updated from ${target.originalMarks} to ${updatedMarks}.`
          : `${target.subjectCode} original marks (${target.originalMarks}) upheld after review.`,
        date: todayDate(),
        category: 'Revaluation',
        read: false,
      };

      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: requestId,
        recordType: 'Revaluation',
        action: 'Revaluation Resolved',
        previousValue: `${target.subjectCode} Original: ${target.originalMarks}/100`,
        updatedValue: `${target.subjectCode} Revalued: ${updatedMarks}/100 (${status})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: resolutionNotes.trim() || 'Revaluation assessment concluded.',
      });

      return {
        ...prev,
        revaluations: prev.revaluations.map((r) =>
          r.requestId === requestId
            ? {
                ...r,
                status,
                updatedMarks,
                resolutionNotes: resolutionNotes.trim(),
                resolvedAt: nowTimestamp(),
              }
            : r
        ),
        students: updatedStudents,
        notifications: [notif, ...prev.notifications],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast('Revaluation Resolved', `${requestId}: ${status}`);
  };

  const issueCredential: ErpContextValue['issueCredential'] = ({
    studentId,
    degreeProgram,
    classification,
    partnerRegistryRequired,
  }) => {
    const student = state.students.find((s) => s.studentId === studentId);
    if (!student) return null;

    const certId = `CERT-KU-2026-0${920 + state.credentials.length}`;
    const newCred: Credential = {
      certificateId: certId,
      studentId: student.studentId,
      studentName: student.name,
      degreeProgram,
      classification,
      cgpa: student.cgpa,
      issueDate: todayDate(),
      status: 'Valid',
      localIntegrityHash: `sha256:${Math.random().toString(16).slice(2, 10)}...${Math.random()
        .toString(16)
        .slice(2, 6)}`,
      partnerRegistryRequired,
    };

    setState((prev) => {
      const notif: StudentNotification = {
        id: `NOTIF-${Date.now()}`,
        studentId: student.studentId,
        title: `Degree Credential ${certId} Issued`,
        message: `Your ${degreeProgram} certificate (${certId}) has been issued in the local university registry.`,
        date: todayDate(),
        category: 'Credential',
        read: false,
      };
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: certId,
        recordType: 'Credential',
        action: 'Credential Issued',
        previousValue: 'Not Issued',
        updatedValue: `Valid · ${student.studentId} (${degreeProgram})`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Issued verified degree credential in local registry.',
      });
      return {
        ...prev,
        credentials: [newCred, ...prev.credentials],
        notifications: [notif, ...prev.notifications],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast('Credential Issued', `${certId} for ${student.name}`);
    return newCred;
  };

  const verifyCredential = (certificateId: string): VerificationAttempt => {
    const trimmed = certificateId.trim().toUpperCase();
    const cred = state.credentials.find(
      (c) => c.certificateId.toUpperCase() === trimmed
    );

    const externalOffline =
      !state.config.externalVerificationOnline || state.config.partnerWithdrawn;

    let outcome: CredentialVerificationStatus = 'Invalid';
    let note = '';
    let retryEligible = false;

    if (!cred) {
      if (externalOffline) {
        outcome = 'Verification Unavailable';
        note =
          'Certificate not found locally and external partner federation is offline; cannot rule out partner-issued record. Safe retry enabled.';
        retryEligible = true;
      } else {
        outcome = 'Invalid';
        note = 'No matching credential record found in university registry.';
      }
    } else if (cred.status === 'Invalid') {
      outcome = 'Invalid';
      note = cred.revocationReason ?? 'Credential is marked revoked or invalid.';
    } else if (externalOffline && cred.partnerRegistryRequired) {
      outcome = 'Verification Unavailable';
      note =
        'External verification / partner institution node unavailable. Local signed record preserved intact; queued for safe retry.';
      retryEligible = true;
    } else if (externalOffline && !cred.partnerRegistryRequired) {
      outcome = 'Valid';
      note =
        'Partner federation offline, verified solely against preserved local university registry digest.';
      retryEligible = false;
    } else {
      outcome = 'Valid';
      note = 'Verified against local university registry and active partner check.';
    }

    const attempt: VerificationAttempt = {
      id: `VER-${504 + state.verificationHistory.length}`,
      certificateId: trimmed || 'EMPTY',
      queriedBy: `${activeAccount.id} (${activeAccount.name})`,
      timestamp: nowTimestamp(),
      externalServiceState: externalOffline
        ? 'Unavailable (Partner Withdrawn)'
        : 'Online (Simulated)',
      outcome,
      note,
      retryEligible,
    };

    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: attempt.certificateId,
        recordType: 'Credential',
        action: 'Credential Verified',
        previousValue: prev.config.partnerWithdrawn
          ? 'External Node: Offline'
          : 'External Node: Online',
        updatedValue: `Outcome: ${outcome}`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: note,
      });
      return {
        ...prev,
        verificationHistory: [attempt, ...prev.verificationHistory],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast(
      `Verification: ${outcome}`,
      `${attempt.certificateId}`,
      outcome === 'Valid' ? 'mint' : 'warning'
    );
    return attempt;
  };

  const retryVerificationAttempt = (attemptId: string): VerificationAttempt | null => {
    const prevAttempt = state.verificationHistory.find((v) => v.id === attemptId);
    if (!prevAttempt) return null;
    return verifyCredential(prevAttempt.certificateId);
  };

  const recordDisputedCorrection: ErpContextValue['recordDisputedCorrection'] = ({
    recordId,
    recordType,
    previousValue,
    updatedValue,
    reason,
    markStudentStandingActive,
    updatedScriptMarks,
  }) => {
    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId,
        recordType,
        action: 'Record Correction (Non-Destructive)',
        previousValue,
        updatedValue,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason,
      });

      const students = markStudentStandingActive
        ? prev.students.map((st) =>
            st.studentId === markStudentStandingActive
              ? { ...st, standing: 'Active' as const }
              : st
          )
        : prev.students;

      const scripts = updatedScriptMarks
        ? prev.scripts.map((sc) =>
            sc.scriptId === updatedScriptMarks.scriptId
              ? {
                  ...sc,
                  finalMarks: updatedScriptMarks.newMarks,
                  moderationStatus: 'Resolved' as const,
                  approvalStatus: 'Approved' as const,
                  version: sc.version + 1,
                }
              : sc
          )
        : prev.scripts;

      return {
        ...prev,
        students,
        scripts,
        config: { ...prev.config, disputedRecordCorrected: true },
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Versioned Correction Recorded', `Appended new audit version for ${recordId}`);
  };

  const addRubricConcept = (rubricId: string, concept: Omit<RubricConcept, 'id'>) => {
    setState((prev) => {
      const updatedRubrics = prev.rubrics.map((r) => {
        if (r.rubricId !== rubricId) return r;
        const newConcept: RubricConcept = {
          ...concept,
          id: `C-${r.concepts.length + 1}`,
        };
        const newMax = r.concepts.reduce((acc, c) => acc + c.maxPoints, 0) + concept.maxPoints;
        return {
          ...r,
          maxMarks: newMax,
          concepts: [...r.concepts, newConcept],
        };
      });

      const updatedScripts = prev.scripts.map((sc) => {
        if (sc.rubricId !== rubricId || sc.published) return sc;
        const r = updatedRubrics.find((x) => x.rubricId === rubricId);
        const evalOut = evaluateAnswerWithRubric(sc.answerText, r);
        return {
          ...sc,
          maxMarks: r?.maxMarks ?? sc.maxMarks,
          suggestedMarks: evalOut.suggestedMarks,
          matchedConcepts: evalOut.matchedConcepts,
          missingConcepts: evalOut.missingConcepts,
        };
      });

      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: rubricId,
        recordType: 'Rubric',
        action: 'Rubric Concept Added',
        previousValue: 'Concept list updated',
        updatedValue: `Added "${concept.title}" (${concept.maxPoints} pts)`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Updated deterministic grading rubric definition.',
      });

      return {
        ...prev,
        rubrics: updatedRubrics,
        scripts: updatedScripts,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Rubric Concept Added', `${rubricId} updated`);
  };

  const updateRubricConcept = (rubricId: string, concept: RubricConcept) => {
    setState((prev) => {
      const updatedRubrics = prev.rubrics.map((r) => {
        if (r.rubricId !== rubricId) return r;
        const concepts = r.concepts.map((c) => (c.id === concept.id ? concept : c));
        const newMax = concepts.reduce((acc, c) => acc + c.maxPoints, 0);
        return { ...r, maxMarks: newMax, concepts };
      });
      const updatedScripts = prev.scripts.map((sc) => {
        if (sc.rubricId !== rubricId || sc.published) return sc;
        const r = updatedRubrics.find((x) => x.rubricId === rubricId);
        const evalOut = evaluateAnswerWithRubric(sc.answerText, r);
        return {
          ...sc,
          maxMarks: r?.maxMarks ?? sc.maxMarks,
          suggestedMarks: evalOut.suggestedMarks,
          matchedConcepts: evalOut.matchedConcepts,
          missingConcepts: evalOut.missingConcepts,
        };
      });
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: rubricId,
        recordType: 'Rubric',
        action: 'Rubric Rule Edited',
        previousValue: concept.title,
        updatedValue: `Keywords: ${concept.keywords.join(', ')} (${concept.maxPoints} pts)`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Refined deterministic keyword rules.',
      });
      return {
        ...prev,
        rubrics: updatedRubrics,
        scripts: updatedScripts,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Rubric Updated', `${concept.title} rules saved`);
  };

  const toggleReducedResourceMode = (enabled: boolean) => {
    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: 'SYS-COMPUTE-MODE',
        recordType: 'SystemConfig',
        action: 'Operating Mode Changed',
        previousValue: prev.config.reducedResourceMode
          ? '50% Reduced-Resource Mode'
          : 'Standard 100% Budget Mode',
        updatedValue: enabled ? '50% Reduced-Resource Mode' : 'Standard 100% Budget Mode',
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: enabled
          ? 'Task 6: Computing budget reduced by 50%; enabling lightweight deterministic mode.'
          : 'Restored standard computing budget configuration.',
      });
      return {
        ...prev,
        config: { ...prev.config, reducedResourceMode: enabled },
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast(
      enabled ? '50% Reduced-Resource Mode Enabled' : 'Standard Compute Mode Restored',
      enabled
        ? 'Lightweight deterministic evaluation active; live background tasks paused.'
        : 'Full dashboard refresh restored.',
      enabled ? 'warning' : 'mint'
    );
  };

  const togglePartnerWithdrawn = (withdrawn: boolean) => {
    setState((prev) => {
      const updatedCreds = prev.credentials.map((c) => {
        if (c.status === 'Invalid') return c;
        if (withdrawn && c.partnerRegistryRequired) {
          return { ...c, status: 'Verification Unavailable' as const };
        }
        return { ...c, status: 'Valid' as const };
      });
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: 'EXT-PARTNER-NODE',
        recordType: 'SystemConfig',
        action: 'Partner Verification Changed',
        previousValue: prev.config.partnerWithdrawn
          ? 'Partner Withdrawn (Offline)'
          : 'Partner Online',
        updatedValue: withdrawn
          ? 'Partner Withdrawn — Local Records Preserved'
          : 'Partner Online',
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: withdrawn
          ? 'Task 6: Partner institution withdrew from shared credential-verification arrangement.'
          : 'External partner verification endpoint restored.',
      });
      return {
        ...prev,
        credentials: updatedCreds,
        config: {
          ...prev.config,
          partnerWithdrawn: withdrawn,
          externalVerificationOnline: !withdrawn,
        },
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast(
      withdrawn ? 'Partner Verification Withdrawn' : 'External Verification Online',
      withdrawn
        ? 'Local credential records preserved; federated checks return Unavailable with Safe Retry.'
        : 'All credentials verified online.',
      withdrawn ? 'warning' : 'mint'
    );
  };

  const activateCs304DualModeration = (enabled: boolean) => {
    setState((prev) => {
      const updatedScripts = prev.scripts.map((sc) => {
        if (sc.subjectCode !== 'CS304') return sc;
        const rubric = prev.rubrics.find((r) => r.rubricId === sc.rubricId);
        const modOut = calculateModerationPriority({
          suggestedMarks: sc.suggestedMarks,
          finalMarks: sc.finalMarks,
          maxMarks: sc.maxMarks,
          subjectCode: sc.subjectCode,
          examinerId: sc.examinerId,
          cs304DualModerationActive: enabled,
          missingConceptCount: sc.missingConcepts.length,
          totalConceptCount: rubric?.concepts.length ?? 4,
        });
        return {
          ...sc,
          moderationPriorityScore: modOut.score,
          moderationStatus:
            enabled && sc.evaluationStatus === 'Evaluated' && sc.moderationStatus === 'None'
              ? ('Flagged' as const)
              : sc.moderationStatus,
        };
      });
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: 'EXM-26-CS304',
        recordType: 'SystemConfig',
        action: 'Subject Dual Moderation Updated',
        previousValue: prev.config.cs304DualModerationActive
          ? 'Dual Moderation: Active'
          : 'Dual Moderation: Standard',
        updatedValue: enabled ? 'Dual Moderation: Mandatory for CS304' : 'Standard',
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason:
          'Task 6: Addressing historical examiner mark inconsistency in CS304.',
      });
      return {
        ...prev,
        scripts: updatedScripts,
        config: { ...prev.config, cs304DualModerationActive: enabled },
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast(
      enabled ? 'CS304 Mandatory Dual Moderation Active' : 'CS304 Dual Moderation Cleared',
      enabled
        ? 'CS304 scripts elevated in Moderation & Anomaly Detection.'
        : 'Standard threshold restored.'
    );
  };

  const updateSystemConfig = (partial: Partial<SystemConfig>) => {
    setState((prev) => ({
      ...prev,
      config: { ...prev.config, ...partial },
    }));
    pushToast('Settings Saved', 'System configuration updated');
  };

  const markStudentNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  };

  const addExamQuestion: ErpContextValue['addExamQuestion'] = ({
    examId,
    questionNumber,
    questionType,
    bloomLevel,
    maxMarks,
    promptText,
    conceptTitle,
    keywordsCsv,
  }) => {
    const exam = state.exams.find((e) => e.examId === examId);
    if (!exam) return;

    const cleanQ = questionNumber.trim();
    const questionId = `QST-${exam.subjectCode}-${Date.now().toString().slice(-4)}`;
    const rubricId = `RUB-${exam.subjectCode}-${cleanQ.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || Date.now().toString().slice(-3)}`;

    const keywords = keywordsCsv
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const newQuestion: ExamQuestion = {
      questionId,
      examId: exam.examId,
      subjectCode: exam.subjectCode,
      subjectName: exam.subjectName,
      questionNumber: cleanQ,
      questionType,
      bloomLevel,
      maxMarks,
      promptText: promptText.trim(),
      rubricId,
      createdBy: `${activeAccount.id} (${activeAccount.name})`,
      createdAt: todayDate(),
    };

    const existingRubric = state.rubrics.find((r) => r.rubricId === rubricId);
    const newRubric: Rubric | null = existingRubric
      ? null
      : {
          rubricId,
          subjectCode: exam.subjectCode,
          subjectName: exam.subjectName,
          questionNumber: cleanQ,
          maxMarks,
          concepts: [
            {
              id: 'C1',
              title: conceptTitle.trim() || `${cleanQ} Core Concept`,
              description: promptText.trim().slice(0, 120),
              maxPoints: maxMarks,
              keywords: keywords.length ? keywords : [exam.subjectCode.toLowerCase()],
            },
          ],
        };

    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: questionId,
        recordType: 'Question',
        action: 'Exam Question Created',
        previousValue: 'None',
        updatedValue: `${exam.subjectCode} ${cleanQ} (${maxMarks} marks)`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: `Added ${questionType} question linked to rubric ${rubricId}.`,
      });
      return {
        ...prev,
        examQuestions: [newQuestion, ...prev.examQuestions],
        rubrics: newRubric ? [newRubric, ...prev.rubrics] : prev.rubrics,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast(
      'Exam Question Created',
      `${exam.subjectCode} ${cleanQ} added with linked rubric ${rubricId}`
    );
  };

  const addAssessment: ErpContextValue['addAssessment'] = ({
    title,
    kind,
    subjectCode,
    dueDate,
    maxMarks,
    instructions,
    conceptTitle,
    keywordsCsv,
    publishImmediately,
  }) => {
    const exam = state.exams.find((e) => e.subjectCode === subjectCode);
    const subjectName = exam?.subjectName ?? subjectCode;
    const department = exam?.department ?? activeAccount.department;
    const prefix =
      kind === 'Assignment'
        ? 'ASG'
        : kind === 'Internal Assessment'
        ? 'CIA'
        : kind === 'Lab Practical'
        ? 'LAB'
        : 'QUZ';
    const assessmentId = `${prefix}-${subjectCode}-${String(
      state.assessments.length + 10
    )}`;
    const rubricId = `RUB-${assessmentId}`;

    const keywords = keywordsCsv
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const newAssessment: AssessmentItem = {
      assessmentId,
      title: title.trim(),
      kind,
      subjectCode,
      subjectName,
      department,
      dueDate,
      maxMarks,
      instructions: instructions.trim(),
      rubricId,
      createdBy: activeAccount.id,
      createdByName: activeAccount.name,
      status: publishImmediately ? 'Published' : 'Draft',
      submissionsCount: 0,
      submittedByStudentIds: [],
    };

    const newRubric: Rubric = {
      rubricId,
      subjectCode,
      subjectName,
      questionNumber: assessmentId,
      maxMarks,
      concepts: [
        {
          id: 'A1',
          title: conceptTitle.trim() || `${kind} Core Criteria`,
          description: instructions.trim().slice(0, 120) || title.trim(),
          maxPoints: maxMarks,
          keywords: keywords.length ? keywords : [subjectCode.toLowerCase()],
        },
      ],
    };

    setState((prev) => {
      const notifs: StudentNotification[] = publishImmediately
        ? prev.students
            .filter((st) =>
              st.registeredExams.some((eid) => eid.endsWith(subjectCode))
            )
            .map((st, idx) => ({
              id: `NOTIF-ASG-${Date.now()}-${idx}`,
              studentId: st.studentId,
              title: `New ${kind}: ${title.trim()}`,
              message: `${subjectCode} ${kind} published (Due ${dueDate}, ${maxMarks} marks).`,
              date: todayDate(),
              category: 'Notice' as const,
              read: false,
            }))
        : [];

      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: assessmentId,
        recordType: 'Assessment',
        action: `${kind} Created`,
        previousValue: 'None',
        updatedValue: `${title.trim()} (${newAssessment.status}, ${maxMarks} marks)`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: `Created ${kind} for ${subjectCode} with rubric ${rubricId}.`,
      });

      return {
        ...prev,
        assessments: [newAssessment, ...prev.assessments],
        rubrics: [newRubric, ...prev.rubrics],
        notifications: [...notifs, ...prev.notifications],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast(`${kind} Created`, `${assessmentId} · ${title.trim()}`);
  };

  const updateAssessmentStatus = (
    assessmentId: string,
    status: AssessmentItem['status']
  ) => {
    setState((prev) => {
      const target = prev.assessments.find((a) => a.assessmentId === assessmentId);
      if (!target) return prev;
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: assessmentId,
        recordType: 'Assessment',
        action: 'Assessment Status Updated',
        previousValue: target.status,
        updatedValue: status,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: `Changed ${target.kind} status to ${status}.`,
      });
      return {
        ...prev,
        assessments: prev.assessments.map((a) =>
          a.assessmentId === assessmentId ? { ...a, status } : a
        ),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Assessment Updated', `${assessmentId} is now ${status}`);
  };

  const submitStudentAssessment: ErpContextValue['submitStudentAssessment'] = ({
    assessmentId,
    studentId,
    answerText,
  }) => {
    const assessment = state.assessments.find((a) => a.assessmentId === assessmentId);
    const student = state.students.find((s) => s.studentId === studentId);
    if (!assessment || !student) {
      return { ok: false, error: 'Assessment or student not found.' };
    }
    if (assessment.status !== 'Published') {
      return { ok: false, error: 'This assessment is not currently accepting submissions.' };
    }
    if (!answerText.trim()) {
      return { ok: false, error: 'Please enter your response before submitting.' };
    }

    const rubric = state.rubrics.find((r) => r.rubricId === assessment.rubricId);
    const evalOut = evaluateAnswerWithRubric(answerText, rubric);
    const scriptId = `SUB-${assessment.subjectCode}-${Date.now().toString().slice(-4)}`;

    const newSubmissionScript: AnswerScript = {
      scriptId,
      sourceType:
        assessment.kind === 'Internal Assessment' ? 'Internal Assessment' : 'Assignment',
      studentId: student.studentId,
      studentName: student.name,
      examId: assessment.assessmentId,
      subjectCode: assessment.subjectCode,
      subjectName: assessment.subjectName,
      questionNumber: assessment.assessmentId,
      maxMarks: assessment.maxMarks,
      submittedAt: nowTimestamp(),
      answerText: answerText.trim(),
      rubricId: assessment.rubricId,
      examinerId: assessment.createdBy,
      examinerName: assessment.createdByName,
      evaluationStatus: 'Pending Evaluation',
      suggestedMarks: evalOut.suggestedMarks,
      matchedConcepts: evalOut.matchedConcepts,
      missingConcepts: evalOut.missingConcepts,
      finalMarks: null,
      overrideReason: '',
      examinerNotes: '',
      evaluatedAt: null,
      moderationPriorityScore: 0,
      moderationStatus: 'None',
      moderatorComments: '',
      moderationReviewedBy: null,
      moderationResolvedAt: null,
      approvalStatus: 'Pending',
      approvedBy: null,
      approvalTimestamp: null,
      approvalNotes: '',
      published: false,
      version: 1,
    };

    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: scriptId,
        recordType: 'Assessment',
        action: `${assessment.kind} Submitted`,
        previousValue: 'Not Submitted',
        updatedValue: `Submitted by ${student.studentId} (${assessment.assessmentId})`,
        userResponsible: `${student.studentId} (${student.name})`,
        userRole: 'Student',
        reason: `Student submitted ${assessment.kind} response for rubric evaluation.`,
      });
      return {
        ...prev,
        assessments: prev.assessments.map((a) =>
          a.assessmentId === assessmentId
            ? {
                ...a,
                submissionsCount: a.submissionsCount + 1,
                submittedByStudentIds: Array.from(
                  new Set([...a.submittedByStudentIds, student.studentId])
                ),
              }
            : a
        ),
        scripts: [newSubmissionScript, ...prev.scripts],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    pushToast(
      `${assessment.kind} Submitted`,
      `Queued as ${scriptId} for examiner evaluation`
    );
    return { ok: true };
  };

  const createRubric: ErpContextValue['createRubric'] = ({
    subjectCode,
    subjectName,
    questionNumber,
    conceptTitle,
    conceptDescription,
    maxPoints,
    keywordsCsv,
  }) => {
    const cleanQ = questionNumber.trim();
    const rubricId = `RUB-${subjectCode.trim().toUpperCase()}-${cleanQ
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase() || Date.now().toString().slice(-3)}`;

    const keywords = keywordsCsv
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const newRubric: Rubric = {
      rubricId,
      subjectCode: subjectCode.trim().toUpperCase(),
      subjectName: subjectName.trim() || subjectCode.trim().toUpperCase(),
      questionNumber: cleanQ,
      maxMarks: maxPoints,
      concepts: [
        {
          id: 'C1',
          title: conceptTitle.trim(),
          description: conceptDescription.trim() || 'Defined concept criterion.',
          maxPoints,
          keywords: keywords.length ? keywords : [subjectCode.trim().toLowerCase()],
        },
      ],
    };

    setState((prev) => {
      const audit = makeAuditEntry(prev.auditLogs, {
        recordId: rubricId,
        recordType: 'Rubric',
        action: 'Rubric Created',
        previousValue: 'None',
        updatedValue: `${newRubric.subjectCode} ${cleanQ} (${maxPoints} marks)`,
        userResponsible: `${activeAccount.id} (${activeAccount.name})`,
        userRole: activeAccount.roleLabel,
        reason: 'Created deterministic grading rubric.',
      });
      return {
        ...prev,
        rubrics: [newRubric, ...prev.rubrics],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
    pushToast('Rubric Created', `${rubricId} ready for concept expansion`);
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      activeRole: state.activeRole,
      activeStudentId: 'STU-2026-104',
      activeSection: ROLE_ALLOWED_SECTIONS[state.activeRole][0],
      students: INITIAL_STUDENTS,
      exams: INITIAL_EXAMS,
      examQuestions: INITIAL_EXAM_QUESTIONS,
      assessments: INITIAL_ASSESSMENTS,
      rubrics: INITIAL_RUBRICS,
      scripts: INITIAL_SCRIPTS,
      approvalHistory: INITIAL_APPROVAL_HISTORY,
      revaluations: INITIAL_REVALUATIONS,
      credentials: INITIAL_CREDENTIALS,
      verificationHistory: INITIAL_VERIFICATION_HISTORY,
      auditLogs: INITIAL_AUDIT_LOGS,
      notifications: INITIAL_NOTIFICATIONS,
      config: INITIAL_SYSTEM_CONFIG,
    });
    pushToast('Demonstration Dataset Restored', 'All mock records reset to clean baseline.');
  };

  return (
    <ErpContext.Provider
      value={{
        activeRole: state.activeRole,
        activeAccount,
        activeStudentId: state.activeStudentId,
        activeSection: state.activeSection,
        visibleNavItems,
        students: state.students,
        exams: state.exams,
        examQuestions: state.examQuestions,
        assessments: state.assessments,
        rubrics: state.rubrics,
        scripts: state.scripts,
        approvalHistory: state.approvalHistory,
        revaluations: state.revaluations,
        credentials: state.credentials,
        verificationHistory: state.verificationHistory,
        auditLogs: state.auditLogs,
        notifications: state.notifications,
        config: state.config,
        toasts,
        dismissToast,
        setActiveSection,
        switchRole,
        setActiveStudentId,
        addStudent,
        addExam,
        updateExamStatus,
        addExamQuestion,
        addAssessment,
        updateAssessmentStatus,
        submitStudentAssessment,
        createRubric,
        saveScriptEvaluation,
        flagScriptForModeration,
        addModeratorComment,
        resolveModerationDiscrepancy,
        approveScript,
        rejectScript,
        requestCorrection,
        publishScriptResult,
        submitRevaluation,
        assignRevaluationExaminer,
        resolveRevaluation,
        issueCredential,
        verifyCredential,
        retryVerificationAttempt,
        recordDisputedCorrection,
        addRubricConcept,
        updateRubricConcept,
        toggleReducedResourceMode,
        togglePartnerWithdrawn,
        activateCs304DualModeration,
        updateSystemConfig,
        markStudentNotificationRead,
        resetDemoData,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
};

export function useErp(): ErpContextValue {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used inside ErpProvider');
  return ctx;
}
