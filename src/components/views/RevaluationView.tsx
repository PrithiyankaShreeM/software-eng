import React, { useMemo, useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { RevaluationRequest } from '../../types/erp';
import {
  Button,
  Drawer,
  Modal,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';

const EXAMINER_DIRECTORY = [
  { id: 'EXM-104', name: 'Prof. Arvind Menon' },
  { id: 'EXM-109', name: 'Dr. Deepa Venkatesh' },
  { id: 'EXM-115', name: 'Dr. K. Balasubramanian (External Panel)' },
];

export const RevaluationView: React.FC = () => {
  const {
    revaluations,
    students,
    activeRole,
    submitRevaluation,
    assignRevaluationExaminer,
    resolveRevaluation,
  } = useErp();

  const [statusFilter, setStatusFilter] = useState('All');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState<RevaluationRequest | null>(null);
  const [assignExaminerId, setAssignExaminerId] = useState('EXM-109');
  const [updatedMarksInput, setUpdatedMarksInput] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const [newReqForm, setNewReqForm] = useState({
    studentId: 'STU-2026-104',
    subjectCode: 'CS301',
    reason: '',
  });
  const [submitErr, setSubmitErr] = useState('');

  const canAssign = activeRole === 'admin';
  const canResolve = activeRole === 'admin' || activeRole === 'examiner';

  const metrics = useMemo(() => {
    const open = revaluations.filter((r) => !r.status.startsWith('Resolved')).length;
    const updated = revaluations.filter(
      (r) => r.status === 'Resolved - Updated'
    ).length;
    const unchanged = revaluations.filter(
      (r) => r.status === 'Resolved - No Change'
    ).length;
    return { total: revaluations.length, open, updated, unchanged };
  }, [revaluations]);

  const filtered = useMemo(() => {
    return revaluations.filter(
      (r) => statusFilter === 'All' || r.status === statusFilter
    );
  }, [revaluations, statusFilter]);

  const selectedStudent = students.find(
    (s) => s.studentId === newReqForm.studentId
  );
  const publishedSubs =
    selectedStudent?.results.filter((r) => r.published && r.totalMarks !== null) ?? [];

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const res = submitRevaluation(newReqForm);
    if (!res.ok) {
      setSubmitErr(res.error ?? 'Error submitting request.');
      return;
    }
    setSubmitErr('');
    setShowSubmitModal(false);
    setNewReqForm({ ...newReqForm, reason: '' });
  };

  const openReview = (req: RevaluationRequest) => {
    setSelectedReq(req);
    setAssignExaminerId(req.assignedExaminerId ?? 'EXM-109');
    setUpdatedMarksInput(String(req.updatedMarks ?? req.originalMarks));
    setResolutionNotes(req.resolutionNotes);
  };

  const currentReq = selectedReq
    ? revaluations.find((r) => r.requestId === selectedReq.requestId) ?? selectedReq
    : null;

  return (
    <div>
      <PageHeader
        title="Revaluation Requests"
        subtitle="Manage student mark-review requests, independent examiner assignment, and non-destructive mark revisions"
        actions={
          canAssign ? (
            <Button variant="primary" onClick={() => setShowSubmitModal(true)}>
              New Revaluation Request
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Requests" value={metrics.total} />
        <StatCard
          label="Open / In Review"
          value={metrics.open}
          accent={metrics.open > 0 ? 'warning' : 'mint'}
        />
        <StatCard
          label="Resolved — Marks Updated"
          value={metrics.updated}
          accent="mint"
        />
        <StatCard label="Resolved — Original Upheld" value={metrics.unchanged} />
      </div>

      <SectionCard noPadding>
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 px-5 py-3.5">
          {[
            'All',
            'Submitted',
            'Assigned',
            'Under Review',
            'Resolved - Updated',
            'Resolved - No Change',
          ].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                statusFilter === st
                  ? 'border border-[#a7e3ce] bg-[#ecf9f4] text-[#065f46]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Request ID</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Original Marks</th>
                <th className="px-4 py-3">Reason for Revaluation</th>
                <th className="px-4 py-3">Assigned Examiner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated Marks</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((req) => (
                <tr key={req.requestId} className="hover:bg-gray-50/70">
                  <td className="px-5 py-3.5 font-mono font-semibold text-gray-900">
                    {req.requestId}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-gray-900">{req.studentId}</div>
                    <div className="text-[11px] text-gray-500">{req.studentName}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">{req.subjectCode}</div>
                    <div className="text-[11px] text-gray-500">{req.subjectName}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-medium tabular-nums">
                    {req.originalMarks}/100
                  </td>
                  <td className="max-w-xs px-4 py-3.5 text-gray-700">
                    <div className="line-clamp-2">{req.reason}</div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-700">
                    {req.assignedExaminerId ? (
                      <>
                        <div className="font-mono">{req.assignedExaminerId}</div>
                        <div className="text-[11px] text-gray-500">
                          {req.assignedExaminerName}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
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
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold tabular-nums">
                    {req.updatedMarks !== null ? `${req.updatedMarks}/100` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openReview(req)}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Review & Resolution Drawer */}
      <Drawer
        open={Boolean(currentReq)}
        onClose={() => setSelectedReq(null)}
        title={currentReq ? `Revaluation Review · ${currentReq.requestId}` : ''}
        subtitle={
          currentReq
            ? `${currentReq.studentId} (${currentReq.studentName}) · ${currentReq.subjectCode}`
            : ''
        }
      >
        {currentReq && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <div className="text-gray-500">Original Published Marks</div>
                <div className="mt-1 font-mono text-xl font-semibold text-gray-900">
                  {currentReq.originalMarks}/100
                </div>
              </div>
              <div>
                <div className="text-gray-500">Revalued Marks</div>
                <div className="mt-1 font-mono text-xl font-semibold text-[#065f46]">
                  {currentReq.updatedMarks !== null
                    ? `${currentReq.updatedMarks}/100`
                    : 'Pending Resolution'}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="font-semibold text-gray-900">Student Appeal Statement</div>
              <p className="mt-1 text-gray-700">{currentReq.reason}</p>
              <div className="mt-2 font-mono text-[11px] text-gray-500">
                Linked Script: {currentReq.scriptId} · Filed: {currentReq.submittedAt}
              </div>
            </div>

            {canAssign && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="font-semibold text-gray-900">
                  Assign Independent Examiner
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={assignExaminerId}
                    onChange={(e) => setAssignExaminerId(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {EXAMINER_DIRECTORY.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.id} · {ex.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const ex = EXAMINER_DIRECTORY.find(
                        (e) => e.id === assignExaminerId
                      );
                      if (ex) {
                        assignRevaluationExaminer(
                          currentReq.requestId,
                          ex.id,
                          ex.name
                        );
                      }
                    }}
                  >
                    Assign Examiner
                  </Button>
                </div>
              </div>
            )}

            {canResolve && (
              <div className="rounded-xl border border-[#c8ede0] bg-[#f7fcfa] p-4 space-y-3">
                <div className="font-semibold text-gray-900">
                  Resolve Revaluation (Preserves Original Record Version)
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-gray-700">Final Revalued Marks (0–100):</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={updatedMarksInput}
                    onChange={(e) => setUpdatedMarksInput(e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-mono font-semibold"
                  />
                </div>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail verification findings across sub-parts..."
                  className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs"
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!resolutionNotes.trim()}
                  onClick={() => {
                    const num = Number(updatedMarksInput);
                    if (Number.isNaN(num) || num < 0 || num > 100) return;
                    resolveRevaluation({
                      requestId: currentReq.requestId,
                      updatedMarks: num,
                      resolutionNotes,
                    });
                    setSelectedReq(null);
                  }}
                >
                  Confirm & Resolve Revaluation
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* New Revaluation Modal */}
      <Modal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Revaluation Request"
        subtitle="File a revaluation appeal for any published subject mark"
      >
        <form onSubmit={handleSubmitNew} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-gray-700">Student</label>
            <select
              value={newReqForm.studentId}
              onChange={(e) => {
                const st = students.find((x) => x.studentId === e.target.value);
                const firstSub =
                  st?.results.find((r) => r.published)?.subjectCode ?? '';
                setNewReqForm({
                  ...newReqForm,
                  studentId: e.target.value,
                  subjectCode: firstSub,
                });
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              {students
                .filter((s) => s.results.some((r) => r.published))
                .map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.studentId} · {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Published Subject
            </label>
            <select
              value={newReqForm.subjectCode}
              onChange={(e) =>
                setNewReqForm({ ...newReqForm, subjectCode: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              {publishedSubs.map((r) => (
                <option key={r.subjectCode} value={r.subjectCode}>
                  {r.subjectCode} · {r.subjectName} (Marks: {r.totalMarks})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Reason for Revaluation
            </label>
            <textarea
              required
              rows={3}
              value={newReqForm.reason}
              onChange={(e) =>
                setNewReqForm({ ...newReqForm, reason: e.target.value })
              }
              placeholder="Explain discrepancy or missing part evaluation..."
              className="w-full rounded-lg border border-gray-300 p-2.5"
            />
          </div>
          {submitErr && <div className="text-red-700">{submitErr}</div>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSubmitModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
