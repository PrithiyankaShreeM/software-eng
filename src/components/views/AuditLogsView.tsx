import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import {
  Button,
  Modal,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../ui/Primitives';

export const AuditLogsView: React.FC = () => {
  const { auditLogs, scripts, activeRole, recordDisputedCorrection } = useErp();

  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [inspectRecordId, setInspectRecordId] = useState<string | null>(null);
  const [showCorrectModal, setShowCorrectModal] = useState(false);

  const [correctForm, setCorrectForm] = useState({
    scriptId: 'SCR-2026-8806',
    newMarks: '10',
    reason:
      'Clerical transcription discrepancy verified against physical script SCR-2026-8806 (Dispute Ticket #DISP-2026-19).',
  });

  const canCorrect = activeRole === 'admin';

  const uniqueUsers = useMemo(
    () => ['All', ...Array.from(new Set(auditLogs.map((l) => l.userResponsible)))],
    [auditLogs]
  );

  const uniqueActions = useMemo(
    () => ['All', ...Array.from(new Set(auditLogs.map((l) => l.action)))],
    [auditLogs]
  );

  const filtered = useMemo(() => {
    return auditLogs.filter((l) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        l.recordId.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q) ||
        l.previousValue.toLowerCase().includes(q) ||
        l.updatedValue.toLowerCase().includes(q);
      const matchUser = userFilter === 'All' || l.userResponsible === userFilter;
      const matchAction = actionFilter === 'All' || l.action === actionFilter;
      const logDate = l.timestamp.slice(0, 10);
      const matchFrom = !dateFrom || logDate >= dateFrom;
      const matchTo = !dateTo || logDate <= dateTo;
      return matchQ && matchUser && matchAction && matchFrom && matchTo;
    });
  }, [auditLogs, query, userFilter, actionFilter, dateFrom, dateTo]);

  const versionTimeline = useMemo(() => {
    if (!inspectRecordId) return [];
    return auditLogs
      .filter((l) => l.recordId === inspectRecordId)
      .slice()
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }, [auditLogs, inspectRecordId]);

  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    const sc = scripts.find((s) => s.scriptId === correctForm.scriptId);
    if (!sc || !correctForm.reason.trim()) return;
    const numeric = Number(correctForm.newMarks);
    if (Number.isNaN(numeric) || numeric < 0 || numeric > sc.maxMarks) return;

    recordDisputedCorrection({
      recordId: sc.scriptId,
      recordType: 'AnswerScript',
      previousValue: `Marks: ${sc.finalMarks ?? 'Pending'}/${sc.maxMarks} (${sc.approvalStatus})`,
      updatedValue: `Corrected Marks: ${numeric}/${sc.maxMarks} (Versioned Audit Amendment)`,
      reason: correctForm.reason.trim(),
      markStudentStandingActive: sc.studentId,
      updatedScriptMarks: { scriptId: sc.scriptId, newMarks: numeric },
    });
    setShowCorrectModal(false);
    setInspectRecordId(sc.scriptId);
  };

  return (
    <div>
      <PageHeader
        title="Versioned Audit Logs"
        subtitle="Immutable append-only history tracking every evaluation, override, moderation, approval, and correction"
        badge="Append-Only History"
        actions={
          canCorrect ? (
            <Button variant="primary" onClick={() => setShowCorrectModal(true)}>
              Record Disputed Correction
            </Button>
          ) : undefined
        }
      />

      <NoticeBox
        title="Non-Destructive Correction Guarantee"
        tone="mint"
        className="mb-6"
      >
        Historical records are never silently overwritten. Every disputed mark or sensitive
        student record amendment appends a new versioned entry preserving the previous value,
        updated value, accountable actor, timestamp, and justification. Click any Record ID
        below to view its complete version timeline.
      </NoticeBox>

      <SectionCard noPadding>
        {/* Multi-Filter Toolbar */}
        <div className="grid grid-cols-1 gap-3 border-b border-gray-200 px-5 py-4 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Record ID, values, or reason..."
              className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-[#0f9d76] focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800"
            >
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u === 'All' ? 'All Users Responsible' : u}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800"
            >
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a === 'All' ? 'All Actions' : a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 md:col-span-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
            />
            {(query || userFilter !== 'All' || actionFilter !== 'All' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setUserFilter('All');
                  setActionFilter('All');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="shrink-0 rounded-md border border-gray-300 px-2 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Version / Record ID</th>
                <th className="px-4 py-3">Action Performed</th>
                <th className="px-4 py-3">Previous Value</th>
                <th className="px-4 py-3">Updated Value</th>
                <th className="px-4 py-3">User Responsible</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-5 py-3">Reason for Modification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((log) => (
                <tr key={log.auditId} className="hover:bg-gray-50/70">
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => setInspectRecordId(log.recordId)}
                      className="font-mono font-semibold text-[#065f46] underline decoration-[#a7e3ce] underline-offset-2 hover:text-[#0f9d76]"
                    >
                      {log.recordId}
                    </button>
                    <div className="mt-0.5 font-mono text-[11px] text-gray-500">
                      {log.auditId} · v{log.versionNumber}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge
                      label={log.action}
                      tone={
                        log.action.includes('Correction') ||
                        log.action.includes('Flagged') ||
                        log.action.includes('Rejected')
                          ? 'warning'
                          : log.action.includes('Approved') ||
                            log.action.includes('Resolved') ||
                            log.action.includes('Published')
                          ? 'mint'
                          : 'neutral'
                      }
                    />
                  </td>
                  <td className="max-w-[190px] px-4 py-3.5 text-gray-600">
                    {log.previousValue}
                  </td>
                  <td className="max-w-[190px] px-4 py-3.5 font-medium text-gray-900">
                    {log.updatedValue}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700">
                    <div>{log.userResponsible}</div>
                    <div className="text-[11px] text-gray-500">{log.userRole}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="max-w-xs px-5 py-3.5 text-gray-700">{log.reason}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-xs text-gray-500">
                    No audit log entries match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Version History Modal */}
      <Modal
        open={Boolean(inspectRecordId)}
        onClose={() => setInspectRecordId(null)}
        title={`Version History · ${inspectRecordId}`}
        subtitle="Chronological immutable chain showing preserved previous states"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          {versionTimeline.map((item) => (
            <div
              key={item.auditId}
              className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#ecf9f4] px-2 py-0.5 font-mono font-semibold text-[#065f46]">
                    v{item.versionNumber}
                  </span>
                  <span className="font-semibold text-gray-900">{item.action}</span>
                </div>
                <span className="font-mono text-[11px] text-gray-500">
                  {item.timestamp} · {item.auditId}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded border border-gray-200 bg-white p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-gray-400">
                    Previous State (Preserved)
                  </div>
                  <div className="mt-1 text-gray-700">{item.previousValue}</div>
                </div>
                <div className="rounded border border-[#c8ede0] bg-white p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-[#065f46]">
                    Updated State
                  </div>
                  <div className="mt-1 font-medium text-gray-900">
                    {item.updatedValue}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-gray-600">
                <strong>Reason:</strong> {item.reason} · <strong>By:</strong>{' '}
                {item.userResponsible}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Record Disputed Correction Modal */}
      <Modal
        open={showCorrectModal}
        onClose={() => setShowCorrectModal(false)}
        title="Record Non-Destructive Disputed Correction"
        subtitle="Appends a corrected version without erasing the original evaluation entry"
      >
        <form onSubmit={handleSubmitCorrection} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Target Answer Script
            </label>
            <select
              value={correctForm.scriptId}
              onChange={(e) =>
                setCorrectForm({ ...correctForm, scriptId: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              {scripts.map((s) => (
                <option key={s.scriptId} value={s.scriptId}>
                  {s.scriptId} · {s.studentId} ({s.subjectCode}) — Current:{' '}
                  {s.finalMarks ?? 'Pending'}/{s.maxMarks}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Corrected Marks
            </label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={15}
              required
              value={correctForm.newMarks}
              onChange={(e) =>
                setCorrectForm({ ...correctForm, newMarks: e.target.value })
              }
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 font-mono font-semibold"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Mandatory Dispute & Verification Reference
            </label>
            <textarea
              required
              rows={3}
              value={correctForm.reason}
              onChange={(e) =>
                setCorrectForm({ ...correctForm, reason: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 p-2.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCorrectModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Append Versioned Correction
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
