import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ROLE_ALLOWED_SECTIONS, useErp } from '../../context/ErpContext';
import { formatExamDuration } from '../../utils/rubricEngine';
import {
  AssessmentItem,
  AssessmentKind,
  Examination,
  ExamQuestion,
} from '../../types/erp';
import {
  Button,
  Modal,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatusBadge,
  StatusTone,
} from '../ui/Primitives';

export const ExamManagementView: React.FC = () => {
  const {
    exams,
    examQuestions,
    assessments,
    scripts,
    activeRole,
    config,
    addExam,
    updateExamStatus,
    addExamQuestion,
    addAssessment,
    updateAssessmentStatus,
    setActiveSection,
  } = useErp();

  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'assessments'>(
    'exams'
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [examFilter, setExamFilter] = useState('All');
  const [kindFilter, setKindFilter] = useState('All');

  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showAddAssessmentModal, setShowAddAssessmentModal] = useState(false);

  const [examForm, setExamForm] = useState({
    examId: '',
    subjectCode: '',
    subjectName: '',
    department: 'Computer Science & Eng.',
    semester: 5,
    examDate: '2026-11-20',
    examTime: '09:30 AM – 12:30 PM',
    durationMinutes: 180,
    evaluationDeadline: '2026-11-28',
    totalEnrolled: 115,
    assignedExaminerId: 'EXM-104',
  });

  const [questionForm, setQuestionForm] = useState({
    examId: exams[0]?.examId ?? 'EXM-26-CS301',
    questionNumber: 'Q5(b)',
    questionType: 'Descriptive' as ExamQuestion['questionType'],
    bloomLevel: 'Analyze' as ExamQuestion['bloomLevel'],
    maxMarks: 10,
    promptText: '',
    conceptTitle: '',
    keywordsCsv: '',
  });

  const [assessmentForm, setAssessmentForm] = useState({
    title: '',
    kind: 'Assignment' as AssessmentKind,
    subjectCode: 'CS301',
    dueDate: '2026-11-25',
    maxMarks: 15,
    instructions: '',
    conceptTitle: '',
    keywordsCsv: '',
    publishImmediately: true,
  });

  const canModifyExams = activeRole === 'admin';
  const canAuthorAcademicItems =
    activeRole === 'examiner' || activeRole === 'admin';

  const filteredExams = useMemo(() => {
    return exams.filter((ex) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        ex.examId.toLowerCase().includes(q) ||
        ex.subjectCode.toLowerCase().includes(q) ||
        ex.subjectName.toLowerCase().includes(q);
      const matchS = statusFilter === 'All' || ex.status === statusFilter;
      return matchQ && matchS;
    });
  }, [exams, query, statusFilter]);

  const filteredQuestions = useMemo(() => {
    return examQuestions.filter((qItem) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        qItem.questionId.toLowerCase().includes(q) ||
        qItem.questionNumber.toLowerCase().includes(q) ||
        qItem.promptText.toLowerCase().includes(q) ||
        qItem.subjectCode.toLowerCase().includes(q);
      const matchExam = examFilter === 'All' || qItem.examId === examFilter;
      return matchQ && matchExam;
    });
  }, [examQuestions, query, examFilter]);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        a.assessmentId.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.subjectCode.toLowerCase().includes(q);
      const matchKind = kindFilter === 'All' || a.kind === kindFilter;
      return matchQ && matchKind;
    });
  }, [assessments, query, kindFilter]);

  const statusTone = (status: Examination['status']): StatusTone => {
    if (status === 'Results Published') return 'mint';
    if (status === 'Moderation Review') return 'warning';
    return 'neutral';
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.examId.trim() || !examForm.subjectCode.trim() || !examForm.subjectName.trim()) {
      return;
    }
    addExam({
      examId: examForm.examId.trim().toUpperCase(),
      subjectCode: examForm.subjectCode.trim().toUpperCase(),
      subjectName: examForm.subjectName.trim(),
      department: examForm.department,
      semester: Number(examForm.semester),
      examDate: examForm.examDate,
      examTime: examForm.examTime.trim() || '09:30 AM – 12:30 PM',
      durationMinutes: Math.max(30, Number(examForm.durationMinutes) || 180),
      evaluationDeadline: examForm.evaluationDeadline,
      totalEnrolled: Number(examForm.totalEnrolled),
      scriptsSubmitted: 0,
      assignedExaminerId: examForm.assignedExaminerId,
      status: 'Scheduled',
    });
    setShowAddExamModal(false);
    setExamForm({
      examId: '',
      subjectCode: '',
      subjectName: '',
      department: 'Computer Science & Eng.',
      semester: 5,
      examDate: '2026-11-20',
      examTime: '09:30 AM – 12:30 PM',
      durationMinutes: 180,
      evaluationDeadline: '2026-11-28',
      totalEnrolled: 115,
      assignedExaminerId: 'EXM-104',
    });
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.questionNumber.trim() || !questionForm.promptText.trim()) return;
    addExamQuestion({
      examId: questionForm.examId,
      questionNumber: questionForm.questionNumber,
      questionType: questionForm.questionType,
      bloomLevel: questionForm.bloomLevel,
      maxMarks: Number(questionForm.maxMarks),
      promptText: questionForm.promptText,
      conceptTitle: questionForm.conceptTitle,
      keywordsCsv: questionForm.keywordsCsv,
    });
    setShowAddQuestionModal(false);
    setQuestionForm({
      ...questionForm,
      questionNumber: '',
      promptText: '',
      conceptTitle: '',
      keywordsCsv: '',
    });
  };

  const handleCreateAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentForm.title.trim() || !assessmentForm.instructions.trim()) return;
    addAssessment({
      title: assessmentForm.title,
      kind: assessmentForm.kind,
      subjectCode: assessmentForm.subjectCode,
      dueDate: assessmentForm.dueDate,
      maxMarks: Number(assessmentForm.maxMarks),
      instructions: assessmentForm.instructions,
      conceptTitle: assessmentForm.conceptTitle,
      keywordsCsv: assessmentForm.keywordsCsv,
      publishImmediately: assessmentForm.publishImmediately,
    });
    setShowAddAssessmentModal(false);
    setAssessmentForm({
      ...assessmentForm,
      title: '',
      instructions: '',
      conceptTitle: '',
      keywordsCsv: '',
    });
  };

  return (
    <div>
      <PageHeader
        title="Examination, Questions & Assessments"
        subtitle="Manage examination schedules, author exam paper questions, and publish course assignments & internal assessments"
        badge={`${exams.length} Exams · ${examQuestions.length} Questions · ${assessments.length} Assessments`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canAuthorAcademicItems && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActiveTab('questions');
                    setShowAddQuestionModal(true);
                  }}
                >
                  Create Exam Question
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setActiveTab('assessments');
                    setShowAddAssessmentModal(true);
                  }}
                >
                  Create Assignment / Assessment
                </Button>
              </>
            )}
            {canModifyExams && (
              <Button variant="secondary" onClick={() => setShowAddExamModal(true)}>
                Schedule Examination
              </Button>
            )}
          </div>
        }
      />

      {/* Sub-navigation Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'exams' as const, label: `Examinations (${exams.length})` },
          {
            id: 'questions' as const,
            label: `Exam Question Bank (${examQuestions.length})`,
          },
          {
            id: 'assessments' as const,
            label: `Assignments & Assessments (${assessments.length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border border-[#a7e3ce] bg-[#ecf9f4] text-[#065f46]'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EXAMINATIONS */}
      {activeTab === 'exams' && (
        <SectionCard noPadding>
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exam ID or subject..."
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-[#0f9d76] focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-[#0f9d76] focus:outline-none"
            >
              <option value="All">All Session Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Scripts Collected">Scripts Collected</option>
              <option value="Evaluation In Progress">Evaluation In Progress</option>
              <option value="Moderation Review">Moderation Review</option>
              <option value="Results Published">Results Published</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">Exam ID</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Exam Date & Duration</th>
                  <th className="px-4 py-3">Eval Deadline</th>
                  <th className="px-4 py-3">Scripts / Questions</th>
                  <th className="px-4 py-3">Examiner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredExams.map((ex) => {
                  const trackedCount = scripts.filter(
                    (s) => s.subjectCode === ex.subjectCode
                  ).length;
                  const qCount = examQuestions.filter(
                    (q) => q.examId === ex.examId
                  ).length;
                  const isCs304Watch =
                    ex.subjectCode === 'CS304' && config.cs304DualModerationActive;

                  return (
                    <tr key={ex.examId} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3.5 font-mono font-medium text-gray-900">
                        {ex.examId}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <span>
                            {ex.subjectCode} · {ex.subjectName}
                          </span>
                          {isCs304Watch && (
                            <StatusBadge label="Dual Moderation" tone="warning" />
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {ex.department} · Sem {ex.semester}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-medium text-gray-800">
                          {ex.examDate}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {ex.examTime} · {formatExamDuration(ex.durationMinutes)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-700">
                        {ex.evaluationDeadline}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-gray-800">
                        <span className="font-semibold">{ex.scriptsSubmitted}</span> /{' '}
                        {ex.totalEnrolled}
                        <div className="text-[11px] text-gray-500">
                          {trackedCount} sample scripts · {qCount} questions
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-700">
                        {ex.assignedExaminerId}
                      </td>
                      <td className="px-4 py-3.5">
                        {canModifyExams ? (
                          <select
                            value={ex.status}
                            onChange={(e) =>
                              updateExamStatus(
                                ex.examId,
                                e.target.value as Examination['status']
                              )
                            }
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800"
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="Scripts Collected">Scripts Collected</option>
                            <option value="Evaluation In Progress">
                              Evaluation In Progress
                            </option>
                            <option value="Moderation Review">Moderation Review</option>
                            <option value="Results Published">Results Published</option>
                          </select>
                        ) : (
                          <StatusBadge label={ex.status} tone={statusTone(ex.status)} />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setExamFilter(ex.examId);
                              setActiveTab('questions');
                            }}
                          >
                            Questions
                          </Button>
                          {ROLE_ALLOWED_SECTIONS[activeRole].includes('evaluation') && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setActiveSection('evaluation')}
                            >
                              Evaluate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* TAB 2: EXAM QUESTION BANK */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <NoticeBox title="Examiner Question Authoring & Rubric Linkage" tone="mint">
            Examiners and Administrators can author descriptive and analytical exam questions
            directly here. Each new question automatically registers a linked deterministic
            rubric in Section 05 (Rubric-Based Assessment).
          </NoticeBox>

          <SectionCard noPadding>
            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search question number, text, or course..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-[#0f9d76] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={examFilter}
                  onChange={(e) => setExamFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800"
                >
                  <option value="All">All Examinations</option>
                  {exams.map((ex) => (
                    <option key={ex.examId} value={ex.examId}>
                      {ex.examId} · {ex.subjectCode}
                    </option>
                  ))}
                </select>
                {canAuthorAcademicItems && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowAddQuestionModal(true)}
                  >
                    + Add Question
                  </Button>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredQuestions.map((qItem) => (
                <div key={qItem.questionId} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {qItem.subjectCode} · {qItem.questionNumber}
                      </span>
                      <StatusBadge label={qItem.questionType} tone="neutral" />
                      <StatusBadge label={`Bloom: ${qItem.bloomLevel}`} tone="mint" />
                      <span className="font-mono text-xs font-semibold text-gray-700">
                        {qItem.maxMarks} Marks
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-gray-500">
                      {qItem.questionId} · Linked Rubric: {qItem.rubricId}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-800">
                    {qItem.promptText}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span>
                      Authored by {qItem.createdBy} on {qItem.createdAt}
                    </span>
                    {ROLE_ALLOWED_SECTIONS[activeRole].includes('rubrics') && (
                      <button
                        type="button"
                        onClick={() => setActiveSection('rubrics')}
                        className="font-medium text-[#065f46] hover:underline"
                      >
                        Inspect Linked Rubric →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredQuestions.length === 0 && (
                <div className="p-8 text-center text-xs text-gray-500">
                  No exam questions match the selected filter.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 3: ASSIGNMENTS & ASSESSMENTS */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <NoticeBox title="Course Assignments & Continuous Assessments" tone="neutral">
            Published assignments and internal assessments appear immediately in the Student
            Dashboard for enrolled students. Student submissions enter Answer Script Evaluation
            with deterministic rubric matching and full audit logging.
          </NoticeBox>

          <SectionCard noPadding>
            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assignment or assessment title..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-[#0f9d76] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800"
                >
                  <option value="All">All Types</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Internal Assessment">Internal Assessment</option>
                  <option value="Lab Practical">Lab Practical</option>
                  <option value="Quiz / Formative">Quiz / Formative</option>
                </select>
                {canAuthorAcademicItems && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowAddAssessmentModal(true)}
                  >
                    + New Assignment / Assessment
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3">ID / Type</th>
                    <th className="px-4 py-3">Title & Instructions</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Max Marks</th>
                    <th className="px-4 py-3">Submissions</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAssessments.map((item) => (
                    <tr key={item.assessmentId} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-semibold text-gray-900">
                          {item.assessmentId}
                        </div>
                        <div className="mt-1">
                          <StatusBadge label={item.kind} tone="neutral" />
                        </div>
                      </td>
                      <td className="max-w-sm px-4 py-3.5">
                        <div className="font-semibold text-gray-900">{item.title}</div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-600">
                          {item.instructions}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-medium text-gray-900">
                          {item.subjectCode}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          By {item.createdByName}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-700">
                        {item.dueDate}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-semibold tabular-nums">
                        {item.maxMarks}
                      </td>
                      <td className="px-4 py-3.5 font-mono tabular-nums text-gray-800">
                        {item.submissionsCount}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {canAuthorAcademicItems ? (
                          <select
                            value={item.status}
                            onChange={(e) =>
                              updateAssessmentStatus(
                                item.assessmentId,
                                e.target.value as AssessmentItem['status']
                              )
                            }
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800"
                          >
                            <option value="Draft">Draft</option>
                            <option value="Published">Published</option>
                            <option value="Closed">Closed</option>
                          </select>
                        ) : (
                          <StatusBadge
                            label={item.status}
                            tone={item.status === 'Published' ? 'mint' : 'neutral'}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredAssessments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                        No assignments or assessments match the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Modal 1: Schedule Examination */}
      <Modal
        open={showAddExamModal}
        onClose={() => setShowAddExamModal(false)}
        title="Schedule Examination"
        subtitle="Creates a new course examination entry in the registry"
      >
        <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">Exam ID</label>
              <input
                required
                value={examForm.examId}
                onChange={(e) => setExamForm({ ...examForm, examId: e.target.value })}
                placeholder="EXM-26-CS309"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Subject Code</label>
              <input
                required
                value={examForm.subjectCode}
                onChange={(e) =>
                  setExamForm({ ...examForm, subjectCode: e.target.value })
                }
                placeholder="CS309"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium text-gray-700">Subject Title</label>
              <input
                required
                value={examForm.subjectName}
                onChange={(e) =>
                  setExamForm({ ...examForm, subjectName: e.target.value })
                }
                placeholder="Distributed Systems & Fault Tolerance"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Exam Date</label>
              <input
                type="date"
                value={examForm.examDate}
                onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Evaluation Deadline
              </label>
              <input
                type="date"
                value={examForm.evaluationDeadline}
                onChange={(e) =>
                  setExamForm({ ...examForm, evaluationDeadline: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Time Window</label>
              <input
                required
                value={examForm.examTime}
                onChange={(e) => setExamForm({ ...examForm, examTime: e.target.value })}
                placeholder="09:30 AM – 12:30 PM"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={30}
                max={360}
                step={15}
                value={examForm.durationMinutes}
                onChange={(e) =>
                  setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddExamModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Schedule Exam
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Create Exam Question */}
      <Modal
        open={showAddQuestionModal}
        onClose={() => setShowAddQuestionModal(false)}
        title="Create Exam Question & Linked Rubric"
        subtitle="Examiners & faculty can author examination questions with deterministic evaluation keywords"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Target Examination
              </label>
              <select
                value={questionForm.examId}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, examId: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                {exams.map((ex) => (
                  <option key={ex.examId} value={ex.examId}>
                    {ex.examId} · {ex.subjectCode} ({ex.subjectName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Question Number
              </label>
              <input
                required
                value={questionForm.questionNumber}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, questionNumber: e.target.value })
                }
                placeholder="Q5(b)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Question Format
              </label>
              <select
                value={questionForm.questionType}
                onChange={(e) =>
                  setQuestionForm({
                    ...questionForm,
                    questionType: e.target.value as ExamQuestion['questionType'],
                  })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="Descriptive">Descriptive</option>
                <option value="Analytical Problem">Analytical Problem</option>
                <option value="Case Study">Case Study</option>
                <option value="Short Proof">Short Proof</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-medium text-gray-700">
                  Bloom Level
                </label>
                <select
                  value={questionForm.bloomLevel}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      bloomLevel: e.target.value as ExamQuestion['bloomLevel'],
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2"
                >
                  <option value="Understand">Understand</option>
                  <option value="Apply">Apply</option>
                  <option value="Analyze">Analyze</option>
                  <option value="Evaluate">Evaluate</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-700">Max Marks</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={questionForm.maxMarks}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      maxMarks: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Question Statement / Prompt
            </label>
            <textarea
              required
              rows={3}
              value={questionForm.promptText}
              onChange={(e) =>
                setQuestionForm({ ...questionForm, promptText: e.target.value })
              }
              placeholder="Write the complete descriptive or analytical question prompt..."
              className="w-full rounded-lg border border-gray-300 p-2.5"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Primary Rubric Concept Title
              </label>
              <input
                value={questionForm.conceptTitle}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, conceptTitle: e.target.value })
                }
                placeholder="e.g., Two-Phase Locking & Serializability"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Rule Keywords (comma-separated)
              </label>
              <input
                value={questionForm.keywordsCsv}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, keywordsCsv: e.target.value })
                }
                placeholder="two-phase locking, serializable, deadlock"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddQuestionModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Exam Question
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Create Assignment or Assessment */}
      <Modal
        open={showAddAssessmentModal}
        onClose={() => setShowAddAssessmentModal(false)}
        title="Create Assignment / Continuous Assessment"
        subtitle="Publishes coursework or internal tests to Student Dashboard and registers a grading rubric"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateAssessment} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium text-gray-700">
                Assignment / Assessment Title
              </label>
              <input
                required
                value={assessmentForm.title}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, title: e.target.value })
                }
                placeholder="e.g., Assignment 6: Distributed Consensus & Raft Protocol"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Assessment Type
              </label>
              <select
                value={assessmentForm.kind}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    kind: e.target.value as AssessmentKind,
                  })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="Assignment">Assignment</option>
                <option value="Internal Assessment">Internal Assessment</option>
                <option value="Lab Practical">Lab Practical</option>
                <option value="Quiz / Formative">Quiz / Formative</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Course</label>
              <select
                value={assessmentForm.subjectCode}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, subjectCode: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                {exams.map((ex) => (
                  <option key={ex.examId} value={ex.subjectCode}>
                    {ex.subjectCode} · {ex.subjectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                required
                value={assessmentForm.dueDate}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, dueDate: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Max Marks</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={assessmentForm.maxMarks}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    maxMarks: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Instructions / Problem Prompt
            </label>
            <textarea
              required
              rows={3}
              value={assessmentForm.instructions}
              onChange={(e) =>
                setAssessmentForm({ ...assessmentForm, instructions: e.target.value })
              }
              placeholder="Specify deliverables, concepts to address, and grading expectations..."
              className="w-full rounded-lg border border-gray-300 p-2.5"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Rubric Concept Name
              </label>
              <input
                value={assessmentForm.conceptTitle}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, conceptTitle: e.target.value })
                }
                placeholder="e.g., Leader Election & Log Replication"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Rule Keywords (comma-separated)
              </label>
              <input
                value={assessmentForm.keywordsCsv}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, keywordsCsv: e.target.value })
                }
                placeholder="quorum, heartbeat, term, commit"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={assessmentForm.publishImmediately}
              onChange={(e) =>
                setAssessmentForm({
                  ...assessmentForm,
                  publishImmediately: e.target.checked,
                })
              }
              className="accent-[#0f9d76]"
            />
            Publish immediately to Student Dashboard and notify enrolled students
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddAssessmentModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create {assessmentForm.kind}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
