import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { AssessmentItem } from '../../types/erp';
import { formatExamDuration } from '../../utils/rubricEngine';
import {
  Button,
  Modal,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';

export const StudentPortalView: React.FC = () => {
  const {
    activeStudentId,
    students,
    exams,
    assessments,
    revaluations,
    notifications,
    submitRevaluation,
    submitStudentAssessment,
    markStudentNotificationRead,
  } = useErp();

  const student = useMemo(
    () => students.find((s) => s.studentId === activeStudentId) ?? students[0],
    [students, activeStudentId]
  );

  const myExams = useMemo(
    () => exams.filter((ex) => student.registeredExams.includes(ex.examId)),
    [exams, student]
  );

  const mySubjectCodes = useMemo(
    () => new Set(myExams.map((e) => e.subjectCode)),
    [myExams]
  );

  const myAssessments = useMemo(
    () =>
      assessments.filter(
        (a) => a.status === 'Published' && mySubjectCodes.has(a.subjectCode)
      ),
    [assessments, mySubjectCodes]
  );

  const [submitModalItem, setSubmitModalItem] = useState<AssessmentItem | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionErr, setSubmissionErr] = useState('');

  const myPublishedSubjects = useMemo(
    () => student.results.filter((r) => r.published && r.totalMarks !== null),
    [student]
  );

  const myRevaluations = useMemo(
    () => revaluations.filter((r) => r.studentId === student.studentId),
    [revaluations, student.studentId]
  );

  const myNotifications = useMemo(
    () => notifications.filter((n) => n.studentId === student.studentId),
    [notifications, student.studentId]
  );

  const [selectedSubject, setSelectedSubject] = useState<string>(
    () => myPublishedSubjects[0]?.subjectCode ?? ''
  );
  const [reason, setReason] = useState('');
  const [formMsg, setFormMsg] = useState('');

  useEffect(() => {
    setSelectedSubject(myPublishedSubjects[0]?.subjectCode ?? '');
    setReason('');
    setFormMsg('');
  }, [student.studentId]);

  const selectedResult =
    myPublishedSubjects.find((r) => r.subjectCode === selectedSubject) ??
    myPublishedSubjects[0];

  const handleRevalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResult) return;
    const res = submitRevaluation({
      studentId: student.studentId,
      subjectCode: selectedResult.subjectCode,
      reason,
    });
    if (!res.ok) {
      setFormMsg(res.error ?? 'Unable to submit request.');
      return;
    }
    setReason('');
    setFormMsg('');
  };

  return (
    <div>
      <PageHeader
        title="Student Dashboard"
        subtitle={`Personal Academic Portal · Viewing strictly records belonging to ${student.studentId}`}
        badge="Private Student Scope"
      />

      <NoticeBox title="Role Scope Enforcement" tone="mint" className="mb-6">
        Authenticated as <strong>{student.name}</strong> (
        <span className="font-mono">{student.studentId}</span>). Access is strictly limited to
        your own profile, published subject marks, revaluation requests, and personal
        notifications. Unpublished marks remain withheld until formally approved and published
        by Examination Administration.
      </NoticeBox>

      {/* Profile & Quick Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Student ID & Program"
          value={student.studentId}
          sublabel={`${student.program} · Semester ${student.semester}`}
          accent="mint"
        />
        <StatCard
          label="Cumulative GPA"
          value={student.cgpa.toFixed(2)}
          sublabel={`Faculty Advisor: ${student.advisor}`}
        />
        <StatCard
          label="Published Subjects"
          value={`${myPublishedSubjects.length} / ${student.results.length || myExams.length}`}
          sublabel="Official published marks"
          accent="mint"
        />
        <StatCard
          label="My Revaluation Requests"
          value={myRevaluations.length}
          sublabel={`${
            myRevaluations.filter((r) => !r.status.startsWith('Resolved')).length
          } active in review`}
        />
      </div>

      {/* Student Profile Details */}
      <SectionCard
        title="Student Profile & Registered Examinations"
        subtitle={student.email}
        className="mb-6"
      >
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-gray-500">Full Name</div>
            <div className="mt-0.5 font-semibold text-gray-900">{student.name}</div>
          </div>
          <div>
            <div className="text-gray-500">Department</div>
            <div className="mt-0.5 font-medium text-gray-900">{student.department}</div>
          </div>
          <div>
            <div className="text-gray-500">Enrollment Standing</div>
            <div className="mt-1">
              <StatusBadge
                label={student.standing}
                tone={student.standing === 'Disputed Record' ? 'warning' : 'mint'}
              />
            </div>
          </div>
          <div>
            <div className="text-gray-500">Registered Exam Sessions</div>
            <div className="mt-0.5 font-mono text-gray-800">
              {myExams.map((e) => e.subjectCode).join(', ') || 'None'}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Registered Examination Schedule & Durations */}
      <SectionCard
        title="My Examination Schedule & Durations"
        subtitle="Dates, sitting windows, and official exam durations for your registered courses"
        className="mb-6"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Exam ID</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Exam Date</th>
                <th className="px-4 py-3">Time Window</th>
                <th className="px-4 py-3">Exam Duration</th>
                <th className="px-5 py-3">Session Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {myExams.map((ex) => (
                <tr key={ex.examId}>
                  <td className="px-5 py-3.5 font-mono font-semibold text-gray-900">
                    {ex.examId}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-gray-900">
                      {ex.subjectCode} · {ex.subjectName}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {ex.department} · Semester {ex.semester}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-gray-700">{ex.examDate}</td>
                  <td className="px-4 py-3.5 font-mono text-gray-700">{ex.examTime}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge
                      label={formatExamDuration(ex.durationMinutes)}
                      tone="mint"
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge
                      label={ex.status}
                      tone={ex.status === 'Results Published' ? 'mint' : 'neutral'}
                    />
                  </td>
                </tr>
              ))}
              {myExams.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-gray-500">
                    No examinations registered for this student account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Subject-wise Published Marks & Grades */}
      <SectionCard
        title="Subject-Wise Examination Results & Grade Information"
        subtitle="Only formally approved and published results display marks and grades"
        className="mb-6"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Course Code & Title</th>
                <th className="px-4 py-3">Exam Date</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Internal (40)</th>
                <th className="px-4 py-3">External (60)</th>
                <th className="px-4 py-3">Published Total (100)</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-5 py-3">Publication Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {student.results.map((r) => (
                <tr key={r.subjectCode}>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">
                      {r.subjectCode} · {r.subjectName}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-gray-700">{r.examDate}</td>
                  <td className="px-4 py-3.5 tabular-nums">{r.credits}</td>
                  <td className="px-4 py-3.5 font-mono tabular-nums">{r.internalMarks}</td>
                  <td className="px-4 py-3.5 font-mono tabular-nums">
                    {r.published && r.externalMarks !== null ? r.externalMarks : '—'}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold tabular-nums text-gray-900">
                    {r.published && r.totalMarks !== null ? `${r.totalMarks}/100` : 'Withheld'}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-gray-900">
                    {r.published && r.grade ? r.grade : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge
                      label={r.published ? 'Published' : 'Pending Approval'}
                      tone={r.published ? 'mint' : 'neutral'}
                    />
                  </td>
                </tr>
              ))}
              {student.results.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-gray-500">
                    No examination results recorded yet for this semester.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Course Assignments & Internal Assessments */}
      <SectionCard
        title="Course Assignments & Internal Assessments"
        subtitle="Published coursework and continuous assessments for your registered subjects"
        className="mb-6"
        noPadding
      >
        {myAssessments.length === 0 ? (
          <div className="p-5 text-xs text-gray-500">
            No active published assignments or internal assessments for your registered
            courses.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {myAssessments.map((asg) => {
              const submitted = asg.submittedByStudentIds.includes(student.studentId);
              return (
                <div
                  key={asg.assessmentId}
                  className="flex flex-col gap-3 px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-gray-900">
                        {asg.assessmentId}
                      </span>
                      <span className="font-semibold text-gray-900">{asg.title}</span>
                      <StatusBadge label={asg.kind} tone="neutral" />
                      {submitted && <StatusBadge label="Submitted" tone="mint" />}
                    </div>
                    <p className="mt-1 text-gray-600">{asg.instructions}</p>
                    <div className="mt-1 font-mono text-[11px] text-gray-500">
                      {asg.subjectCode} · Due {asg.dueDate} · Max Marks: {asg.maxMarks} ·
                      Faculty: {asg.createdByName}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={submitted ? 'secondary' : 'primary'}
                    disabled={submitted}
                    onClick={() => {
                      setSubmitModalItem(asg);
                      setSubmissionText('');
                      setSubmissionErr('');
                    }}
                  >
                    {submitted ? 'Submitted' : 'Submit Answer'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Revaluation Request Form */}
        <div className="lg:col-span-5">
          <SectionCard
            title="Submit Revaluation Request"
            subtitle="Request independent examiner verification for a published subject"
          >
            {myPublishedSubjects.length === 0 ? (
              <p className="text-xs text-gray-500">
                No published subject marks are available for revaluation at this time.
              </p>
            ) : (
              <form onSubmit={handleRevalSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="mb-1 block font-medium text-gray-700">
                    Published Subject
                  </label>
                  <select
                    value={selectedResult?.subjectCode ?? ''}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:border-[#0f9d76] focus:outline-none"
                  >
                    {myPublishedSubjects.map((sub) => (
                      <option key={sub.subjectCode} value={sub.subjectCode}>
                        {sub.subjectCode} · {sub.subjectName} (Marks: {sub.totalMarks})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <span className="text-gray-500">Original Published Marks: </span>
                  <span className="font-mono font-semibold text-gray-900">
                    {selectedResult?.totalMarks ?? '—'} / 100
                  </span>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-gray-700">
                    Reason for Revaluation <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Specify question numbers or totalling discrepancy..."
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-[#0f9d76] focus:outline-none"
                  />
                </div>

                {formMsg && (
                  <div className="text-xs font-medium text-red-700">{formMsg}</div>
                )}

                <Button type="submit" variant="primary">
                  Submit Revaluation Request
                </Button>
              </form>
            )}
          </SectionCard>
        </div>

        {/* Revaluation Status + Personal Notifications */}
        <div className="space-y-6 lg:col-span-7">
          <SectionCard
            title="My Revaluation Request Status"
            subtitle="Track progress and updated marks from independent re-evaluation"
            noPadding
          >
            {myRevaluations.length === 0 ? (
              <div className="p-5 text-xs text-gray-500">
                You have not filed any revaluation requests.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {myRevaluations.map((req) => (
                  <div key={req.requestId} className="px-5 py-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">
                          {req.requestId}
                        </span>
                        <span className="font-medium text-gray-800">
                          {req.subjectCode} · {req.subjectName}
                        </span>
                      </div>
                      <StatusBadge
                        label={req.status}
                        tone={
                          req.status === 'Resolved - Updated'
                            ? 'mint'
                            : req.status === 'Resolved - No Change'
                            ? 'neutral'
                            : 'warning'
                        }
                      />
                    </div>
                    <p className="mt-1 text-gray-600">{req.reason}</p>
                    <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-gray-500">
                      <span>Original: {req.originalMarks}/100</span>
                      <span>
                        Updated:{' '}
                        <strong className="text-gray-900">
                          {req.updatedMarks !== null ? `${req.updatedMarks}/100` : 'Pending'}
                        </strong>
                      </span>
                      <span>Submitted: {req.submittedAt}</span>
                    </div>
                    {req.resolutionNotes && (
                      <div className="mt-1.5 rounded bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-700">
                        Resolution: {req.resolutionNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Personal Notifications"
            subtitle="Examination results, revaluation updates, and credential notices"
            noPadding
          >
            {myNotifications.length === 0 ? (
              <div className="p-5 text-xs text-gray-500">No notifications yet.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {myNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start justify-between gap-3 px-5 py-3.5 text-xs ${
                      n.read ? 'bg-white' : 'bg-[#f7fcfa]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{n.title}</span>
                        <StatusBadge
                          label={n.category}
                          tone={n.read ? 'neutral' : 'mint'}
                        />
                      </div>
                      <p className="mt-1 text-gray-600">{n.message}</p>
                      <div className="mt-1 font-mono text-[11px] text-gray-400">
                        {n.date}
                      </div>
                    </div>
                    {!n.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markStudentNotificationRead(n.id)}
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal
        open={Boolean(submitModalItem)}
        onClose={() => setSubmitModalItem(null)}
        title={
          submitModalItem
            ? `Submit ${submitModalItem.kind} · ${submitModalItem.assessmentId}`
            : ''
        }
        subtitle={
          submitModalItem
            ? `${submitModalItem.subjectCode} · ${submitModalItem.title} (${submitModalItem.maxMarks} marks)`
            : ''
        }
        maxWidth="max-w-2xl"
      >
        {submitModalItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = submitStudentAssessment({
                assessmentId: submitModalItem.assessmentId,
                studentId: student.studentId,
                answerText: submissionText,
              });
              if (!res.ok) {
                setSubmissionErr(res.error ?? 'Failed to submit.');
                return;
              }
              setSubmitModalItem(null);
              setSubmissionText('');
            }}
            className="space-y-4 text-xs"
          >
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-700">
              {submitModalItem.instructions}
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Your Written Answer / Submission <span className="text-red-600">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={submissionText}
                onChange={(e) => {
                  setSubmissionText(e.target.value);
                  setSubmissionErr('');
                }}
                placeholder="Write your complete structured solution..."
                className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-[#0f9d76] focus:outline-none"
              />
            </div>
            {submissionErr && (
              <div className="text-xs font-medium text-red-700">{submissionErr}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSubmitModalItem(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Submit for Evaluation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
