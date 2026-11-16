import React, { useMemo, useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { AnswerScript } from '../../types/erp';
import {
  Button,
  Modal,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';

export const MarkApprovalView: React.FC = () => {
  const {
    scripts,
    approvalHistory,
    activeRole,
    approveScript,
    rejectScript,
    requestCorrection,
    publishScriptResult,
  } = useErp();

  const [tab, setTab] = useState<'All' | 'Pending' | 'Approved' | 'Returned'>('All');
  const [actionModal, setActionModal] = useState<{
    script: AnswerScript;
    type: 'Reject' | 'Correction';
  } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const canApprove = activeRole === 'admin';

  const evaluated = useMemo(
    () => scripts.filter((s) => s.finalMarks !== null),
    [scripts]
  );

  const counts = useMemo(() => {
    const pending = evaluated.filter((s) => s.approvalStatus === 'Pending').length;
    const approved = evaluated.filter((s) => s.approvalStatus === 'Approved').length;
    const returned = evaluated.filter(
      (s) =>
        s.approvalStatus === 'Rejected' || s.approvalStatus === 'Correction Requested'
    ).length;
    const published = evaluated.filter((s) => s.published).length;
    return { pending, approved, returned, published };
  }, [evaluated]);

  const filtered = useMemo(() => {
    return evaluated.filter((s) => {
      if (tab === 'Pending') return s.approvalStatus === 'Pending';
      if (tab === 'Approved') return s.approvalStatus === 'Approved';
      if (tab === 'Returned')
        return (
          s.approvalStatus === 'Rejected' || s.approvalStatus === 'Correction Requested'
        );
      return true;
    });
  }, [evaluated, tab]);

  const handleConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal || !reasonInput.trim()) return;
    if (actionModal.type === 'Reject') {
      rejectScript(actionModal.script.scriptId, reasonInput);
    } else {
      requestCorrection(actionModal.script.scriptId, reasonInput);
    }
    setActionModal(null);
    setReasonInput('');
  };

  return (
    <div>
      <PageHeader
        title="Mark Approval & Result Publication"
        subtitle="Final sign-off, correction returns, result publication, and approval audit trail"
        badge="Administrator Governance"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Approval"
          value={counts.pending}
          sublabel="Evaluated scripts awaiting administrator decision"
          accent={counts.pending > 0 ? 'warning' : 'mint'}
        />
        <StatCard
          label="Approved Results"
          value={counts.approved}
          sublabel="Authorized by Examination Administrator"
          accent="mint"
        />
        <StatCard
          label="Rejected / Returned"
          value={counts.returned}
          sublabel="Sent back for examiner re-verification"
        />
        <StatCard
          label="Final Published Results"
          value={counts.published}
          sublabel="Visible in Student Dashboard"
          accent="mint"
        />
      </div>

      {feedbackError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {feedbackError}
        </div>
      )}

      <SectionCard
        title="Evaluated Answer Scripts"
        subtitle="Scripts with unresolved moderation flags cannot be approved until moderation discrepancy is resolved"
        noPadding
      >
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 px-5 py-3.5">
          {(['All', 'Pending', 'Approved', 'Returned'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === t
                  ? 'border border-[#a7e3ce] bg-[#ecf9f4] text-[#065f46]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'Returned' ? 'Rejected / Returned' : t}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Script / Subject</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Marks</th>
                <th className="px-4 py-3">Moderation Status</th>
                <th className="px-4 py-3">Approval Status</th>
                <th className="px-4 py-3">Publication</th>
                <th className="px-5 py-3 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((sc) => {
                const modBlocked =
                  sc.moderationStatus === 'Flagged' ||
                  sc.moderationStatus === 'Under Review';

                return (
                  <tr key={sc.scriptId} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-semibold text-gray-900">
                        {sc.scriptId}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {sc.subjectCode} ({sc.questionNumber}) · {sc.examinerId}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-800">
                      {sc.studentId}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold tabular-nums text-gray-900">
                      {sc.finalMarks}/{sc.maxMarks}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={
                          sc.moderationStatus === 'None'
                            ? 'Cleared'
                            : sc.moderationStatus
                        }
                        tone={
                          sc.moderationStatus === 'Resolved' ||
                          sc.moderationStatus === 'None'
                            ? 'mint'
                            : 'warning'
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={sc.approvalStatus}
                        tone={
                          sc.approvalStatus === 'Approved'
                            ? 'mint'
                            : sc.approvalStatus === 'Rejected'
                            ? 'danger'
                            : sc.approvalStatus === 'Correction Requested'
                            ? 'warning'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={sc.published ? 'Published' : 'Unpublished'}
                        tone={sc.published ? 'mint' : 'neutral'}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {canApprove ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {sc.approvalStatus !== 'Approved' && (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={modBlocked}
                              title={
                                modBlocked
                                  ? 'Resolve moderation flag before approving'
                                  : 'Approve evaluation'
                              }
                              onClick={() => {
                                setFeedbackError('');
                                const res = approveScript(
                                  sc.scriptId,
                                  'Approved after verification.'
                                );
                                if (!res.ok) setFeedbackError(res.error ?? '');
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {sc.approvalStatus === 'Approved' && !sc.published && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => publishScriptResult(sc.scriptId)}
                            >
                              Publish Result
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReasonInput('');
                              setActionModal({ script: sc, type: 'Correction' });
                            }}
                          >
                            Request Correction
                          </Button>
                          {sc.approvalStatus !== 'Rejected' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setReasonInput('');
                                setActionModal({ script: sc, type: 'Reject' });
                              }}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">Administrator Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Approval History */}
      <SectionCard
        title="Approval & Publication History"
        subtitle="Chronological log of all examination mark sign-off and publication decisions"
        className="mt-6"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Approval ID</th>
                <th className="px-4 py-3">Script ID</th>
                <th className="px-4 py-3">Student / Course</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Marks</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {approvalHistory.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-mono text-gray-700">{item.id}</td>
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    {item.scriptId}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.studentId} · {item.subjectCode}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={item.action}
                      tone={
                        item.action === 'Approved' || item.action === 'Published'
                          ? 'mint'
                          : item.action === 'Rejected'
                          ? 'danger'
                          : 'warning'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{item.awardedMarks}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.actorName} ({item.actorId})
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                    {item.timestamp}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Modal
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={
          actionModal?.type === 'Reject'
            ? `Reject Evaluation · ${actionModal.script.scriptId}`
            : `Request Correction · ${actionModal?.script.scriptId}`
        }
        subtitle="Specify mandatory justification recorded in Approval History & Audit Logs"
      >
        <form onSubmit={handleConfirmModal} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Reason / Instructions <span className="text-red-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder={
                actionModal?.type === 'Reject'
                  ? 'State reason for rejecting awarded marks...'
                  : 'Specify sub-question or rubric criterion requiring examiner re-evaluation...'
              }
              className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-[#0f9d76] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setActionModal(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={actionModal?.type === 'Reject' ? 'danger' : 'primary'}
            >
              Confirm {actionModal?.type}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
