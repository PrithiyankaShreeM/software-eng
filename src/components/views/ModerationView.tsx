import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { AnswerScript } from '../../types/erp';
import { calculateModerationPriority } from '../../utils/rubricEngine';
import {
  Button,
  Drawer,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';

export const ModerationView: React.FC = () => {
  const {
    scripts,
    rubrics,
    config,
    activeRole,
    flagScriptForModeration,
    addModeratorComment,
    resolveModerationDiscrepancy,
  } = useErp();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [resolvedMarksInput, setResolvedMarksInput] = useState('');

  const canAct = activeRole === 'moderator' || activeRole === 'admin';

  const evaluatedScripts = useMemo(
    () => scripts.filter((s) => s.finalMarks !== null),
    [scripts]
  );

  const metrics = useMemo(() => {
    const flagged = evaluatedScripts.filter(
      (s) => s.moderationStatus === 'Flagged' || s.moderationStatus === 'Under Review'
    ).length;
    const highPriority = evaluatedScripts.filter(
      (s) => s.moderationPriorityScore >= 65
    ).length;
    const resolved = evaluatedScripts.filter(
      (s) => s.moderationStatus === 'Resolved'
    ).length;
    const unusualDelta = evaluatedScripts.filter((s) => {
      if (s.finalMarks === null) return false;
      const pct = (Math.abs(s.finalMarks - s.suggestedMarks) / s.maxMarks) * 100;
      return pct >= config.moderationVarianceThresholdPct;
    }).length;
    return { flagged, highPriority, resolved, unusualDelta };
  }, [evaluatedScripts, config.moderationVarianceThresholdPct]);

  const filtered = useMemo(() => {
    return evaluatedScripts
      .filter((s) => {
        const q = query.trim().toLowerCase();
        const matchQ =
          !q ||
          s.scriptId.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q) ||
          s.examinerId.toLowerCase().includes(q) ||
          s.subjectCode.toLowerCase().includes(q);
        const matchStatus =
          statusFilter === 'All' || s.moderationStatus === statusFilter;
        return matchQ && matchStatus;
      })
      .sort((a, b) => b.moderationPriorityScore - a.moderationPriorityScore);
  }, [evaluatedScripts, query, statusFilter]);

  const selectedScript = useMemo(
    () => scripts.find((s) => s.scriptId === selectedScriptId) ?? null,
    [scripts, selectedScriptId]
  );

  const selectedBreakdown = useMemo(() => {
    if (!selectedScript) return null;
    const rubric = rubrics.find((r) => r.rubricId === selectedScript.rubricId);
    return calculateModerationPriority({
      suggestedMarks: selectedScript.suggestedMarks,
      finalMarks: selectedScript.finalMarks,
      maxMarks: selectedScript.maxMarks,
      subjectCode: selectedScript.subjectCode,
      examinerId: selectedScript.examinerId,
      cs304DualModerationActive: config.cs304DualModerationActive,
      missingConceptCount: selectedScript.missingConcepts.length,
      totalConceptCount: rubric?.concepts.length ?? 4,
    });
  }, [selectedScript, rubrics, config.cs304DualModerationActive]);

  const openReviewDrawer = (script: AnswerScript) => {
    setSelectedScriptId(script.scriptId);
    setCommentInput(script.moderatorComments);
    setResolvedMarksInput(String(script.finalMarks ?? script.suggestedMarks));
  };

  return (
    <div>
      <PageHeader
        title="Moderation & Anomaly Detection"
        subtitle="Audit unusual examiner-vs-rubric variances and resolve grading discrepancies before mark approval"
        badge={`Threshold >= ${config.moderationVarianceThresholdPct}% Delta`}
      />

      <NoticeBox
        title="Deterministic Priority Index Disclosure"
        tone="neutral"
        className="mb-6"
      >
        Moderation Priority Scores (0–100) are computed arithmetically from mark difference
        against rule-based suggestions, uncovered rubric concepts, and subject variance watch
        rules (such as CS304). They are <strong>not</strong> calibrated AI confidence
        probabilities.
      </NoticeBox>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Flagged / Under Review"
          value={metrics.flagged}
          sublabel="Scripts requiring moderation clearance"
          accent={metrics.flagged > 0 ? 'warning' : 'mint'}
        />
        <StatCard
          label="High Priority Index (>= 65)"
          value={metrics.highPriority}
          sublabel="Elevated deterministic variance"
          accent={metrics.highPriority > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Unusual Mark Deltas"
          value={metrics.unusualDelta}
          sublabel={`Exceeds ${config.moderationVarianceThresholdPct}% variance policy`}
        />
        <StatCard
          label="Resolved Discrepancies"
          value={metrics.resolved}
          sublabel="Cleared for final approval"
          accent="mint"
        />
      </div>

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student, examiner, script..."
              className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-[#0f9d76] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['All', 'Flagged', 'Under Review', 'Resolved', 'None'].map((st) => (
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
                {st === 'None' ? 'Unflagged' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Script / Course</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Examiner ID</th>
                <th className="px-4 py-3">Suggested Marks</th>
                <th className="px-4 py-3">Final Awarded</th>
                <th className="px-4 py-3">Difference</th>
                <th className="px-4 py-3">Priority Index</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((sc) => {
                const finalM = sc.finalMarks ?? 0;
                const diff = finalM - sc.suggestedMarks;
                const diffPct = (Math.abs(diff) / sc.maxMarks) * 100;
                const unusual =
                  diffPct >= config.moderationVarianceThresholdPct ||
                  (sc.subjectCode === 'CS304' && sc.examinerId === 'EXM-112');

                return (
                  <tr
                    key={sc.scriptId}
                    className={unusual ? 'bg-amber-50/35 hover:bg-amber-50/60' : 'hover:bg-gray-50/70'}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-semibold text-gray-900">
                        {sc.scriptId}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {sc.subjectCode} ({sc.questionNumber})
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-800">{sc.studentId}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-gray-800">{sc.examinerId}</div>
                      <div className="text-[11px] text-gray-500">{sc.examinerName}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-gray-700">
                      {sc.suggestedMarks}/{sc.maxMarks}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold tabular-nums text-gray-900">
                      {finalM}/{sc.maxMarks}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold tabular-nums">
                      <span
                        className={
                          unusual
                            ? 'rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-900'
                            : 'text-gray-700'
                        }
                      >
                        {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold tabular-nums text-gray-900">
                          {sc.moderationPriorityScore}
                        </span>
                        <span className="text-[11px] text-gray-500">/ 100</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={
                          sc.moderationStatus === 'None'
                            ? 'No Anomaly'
                            : sc.moderationStatus
                        }
                        tone={
                          sc.moderationStatus === 'Resolved'
                            ? 'mint'
                            : sc.moderationStatus === 'Flagged'
                            ? 'danger'
                            : sc.moderationStatus === 'Under Review'
                            ? 'warning'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openReviewDrawer(sc)}
                        >
                          Review
                        </Button>
                        {canAct && sc.moderationStatus === 'None' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              flagScriptForModeration(
                                sc.scriptId,
                                'Flagged manually by Moderator for review.'
                              )
                            }
                          >
                            Flag
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-xs text-gray-500">
                    No evaluated scripts match the moderation filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Moderation Review Drawer */}
      <Drawer
        open={Boolean(selectedScript)}
        onClose={() => setSelectedScriptId(null)}
        title={
          selectedScript
            ? `Moderation Review · ${selectedScript.scriptId}`
            : ''
        }
        subtitle={
          selectedScript
            ? `${selectedScript.studentId} · ${selectedScript.subjectCode} · Examiner ${selectedScript.examinerId}`
            : ''
        }
      >
        {selectedScript && selectedBreakdown && (
          <div className="space-y-5">
            {/* Mark Comparison Grid */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
              <div>
                <div className="text-gray-500">Rule-Based Suggested</div>
                <div className="mt-1 font-mono text-lg font-semibold text-gray-900">
                  {selectedScript.suggestedMarks}/{selectedScript.maxMarks}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Examiner Awarded</div>
                <div className="mt-1 font-mono text-lg font-semibold text-gray-900">
                  {selectedScript.finalMarks}/{selectedScript.maxMarks}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Deterministic Priority</div>
                <div className="mt-1 font-mono text-lg font-semibold text-gray-900">
                  {selectedBreakdown.score}/100 ({selectedBreakdown.level})
                </div>
              </div>
            </div>

            {/* Deterministic Priority Factor Breakdown */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-semibold text-gray-900">
                Deterministic Priority Factor Breakdown (Not an AI Score)
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-600">
                {selectedBreakdown.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            {/* Student Answer & Examiner Override Reason */}
            <div>
              <div className="mb-1.5 text-xs font-semibold text-gray-800">
                Student Descriptive Answer ({selectedScript.questionNumber})
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3.5 text-xs leading-relaxed text-gray-800">
                {selectedScript.answerText}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3.5 text-xs">
              <div className="font-semibold text-gray-800">
                Examiner Override Reason & Notes
              </div>
              <p className="mt-1 text-gray-700">
                {selectedScript.overrideReason ||
                  selectedScript.examinerNotes ||
                  'No override reason recorded.'}
              </p>
              <div className="mt-2 text-[11px] text-gray-500">
                Matched concepts: {selectedScript.matchedConcepts.join(', ') || 'None'} ·
                Missing: {selectedScript.missingConcepts.join(', ') || 'None'}
              </div>
            </div>

            {/* Moderator Controls */}
            {canAct ? (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-800">
                    Moderation Review Comments
                  </label>
                  <textarea
                    rows={3}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Document review findings, rubric alignment check, or moderation directive..."
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs focus:border-[#0f9d76] focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        addModeratorComment(selectedScript.scriptId, commentInput)
                      }
                    >
                      Save Review Comment
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        flagScriptForModeration(
                          selectedScript.scriptId,
                          commentInput || 'Flagged for manual moderation.'
                        )
                      }
                    >
                      Flag for Moderation
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#c8ede0] bg-[#f7fcfa] p-4 space-y-3">
                  <div className="text-xs font-semibold text-gray-900">
                    Resolve Discrepancy & Confirm Moderated Marks
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-gray-700">
                      Confirmed Marks (0–{selectedScript.maxMarks}):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={selectedScript.maxMarks}
                      value={resolvedMarksInput}
                      onChange={(e) => setResolvedMarksInput(e.target.value)}
                      className="w-24 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        const val = Number(resolvedMarksInput);
                        if (
                          Number.isNaN(val) ||
                          val < 0 ||
                          val > selectedScript.maxMarks
                        ) {
                          return;
                        }
                        resolveModerationDiscrepancy({
                          scriptId: selectedScript.scriptId,
                          resolvedMarks: val,
                          resolutionComment:
                            commentInput ||
                            `Discrepancy resolved at ${val}/${selectedScript.maxMarks}.`,
                        });
                        setSelectedScriptId(null);
                      }}
                    >
                      Resolve Discrepancy
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <NoticeBox title="Read-Only Moderation View" tone="neutral">
                Your current role ({activeRole}) can inspect moderation statuses. Switch to
                Moderator or Administrator to modify moderation flags or resolve discrepancies.
              </NoticeBox>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
