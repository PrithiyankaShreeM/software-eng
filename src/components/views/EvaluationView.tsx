import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import {
  evaluateAnswerWithRubric,
  highlightMatchedKeywords,
} from '../../utils/rubricEngine';
import {
  Button,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../ui/Primitives';

export const EvaluationView: React.FC = () => {
  const { scripts, rubrics, config, saveScriptEvaluation } = useErp();

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(
    () =>
      scripts.find((s) => s.evaluationStatus !== 'Evaluated')?.scriptId ??
      scripts[0]?.scriptId ??
      ''
  );

  const filteredScripts = useMemo(() => {
    return scripts.filter((s) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        s.scriptId.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Actionable' &&
          (s.evaluationStatus === 'Pending Evaluation' ||
            s.evaluationStatus === 'Correction Requested')) ||
        s.evaluationStatus === statusFilter;
      return matchQ && matchStatus;
    });
  }, [scripts, query, statusFilter]);

  const activeScript = useMemo(
    () => scripts.find((s) => s.scriptId === selectedId) ?? filteredScripts[0] ?? null,
    [scripts, selectedId, filteredScripts]
  );

  const activeRubric = useMemo(
    () => rubrics.find((r) => r.rubricId === activeScript?.rubricId),
    [rubrics, activeScript]
  );

  const evalAnalysis = useMemo(() => {
    if (!activeScript) return null;
    return evaluateAnswerWithRubric(activeScript.answerText, activeRubric);
  }, [activeScript, activeRubric]);

  const [finalMarksInput, setFinalMarksInput] = useState<string>('');
  const [overrideMode, setOverrideMode] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [examinerNotes, setExaminerNotes] = useState<string>('');
  const [highlightKeywords, setHighlightKeywords] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!activeScript) return;
    const initialMarks =
      activeScript.finalMarks !== null
        ? activeScript.finalMarks
        : activeScript.suggestedMarks;
    setFinalMarksInput(String(initialMarks));
    setOverrideMode(
      activeScript.finalMarks !== null &&
        Math.abs(activeScript.finalMarks - activeScript.suggestedMarks) > 0.01
    );
    setOverrideReason(activeScript.overrideReason);
    setExaminerNotes(activeScript.examinerNotes);
    setErrorMsg('');
    if (config.reducedResourceMode) {
      setHighlightKeywords(false);
    }
  }, [activeScript?.scriptId, config.reducedResourceMode]);

  const numericMarks = Number(finalMarksInput);
  const isOverriding =
    activeScript !== null &&
    !Number.isNaN(numericMarks) &&
    Math.abs(numericMarks - activeScript.suggestedMarks) > 0.01;

  const handleAcceptSuggestion = () => {
    if (!activeScript) return;
    setFinalMarksInput(String(activeScript.suggestedMarks));
    setOverrideMode(false);
    setOverrideReason('');
    setErrorMsg('');
  };

  const handleEnableOverride = () => {
    setOverrideMode(true);
    setErrorMsg('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScript) return;
    const res = saveScriptEvaluation({
      scriptId: activeScript.scriptId,
      finalMarks: Number(finalMarksInput),
      overrideReason,
      examinerNotes,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Failed to save evaluation.');
      return;
    }
    setErrorMsg('');
  };

  const answerSegments = useMemo(() => {
    if (!activeScript || !evalAnalysis) return [];
    if (!highlightKeywords) {
      return [{ text: activeScript.answerText, highlighted: false }];
    }
    return highlightMatchedKeywords(
      activeScript.answerText,
      evalAnalysis.allMatchedKeywords
    );
  }, [activeScript, evalAnalysis, highlightKeywords]);

  return (
    <div>
      <PageHeader
        title="Answer Script Evaluation"
        subtitle="Human-in-the-loop descriptive grading with deterministic rubric-keyword assistance"
        badge={
          config.reducedResourceMode
            ? '50% Budget: Lightweight Rule Pass'
            : 'Deterministic Rubric Matcher'
        }
      />

      {config.reducedResourceMode && (
        <NoticeBox
          title="Reduced-Resource Operating Mode Active (50% Computing Budget)"
          tone="warning"
          className="mb-5"
        >
          Inline continuous keyword-span highlighting is paused by default to conserve
          client/compute budget. Deterministic rubric concept matching remains available on
          demand without background indexing.
        </NoticeBox>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Script Queue */}
        <div className="lg:col-span-4">
          <SectionCard
            title="Script Queue"
            subtitle={`${filteredScripts.length} of ${scripts.length} scripts shown`}
            noPadding
          >
            <div className="space-y-2 border-b border-gray-200 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by script, student, or course..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-[#0f9d76] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Actionable', 'Pending Evaluation', 'Evaluated', 'Correction Requested'].map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        statusFilter === tab
                          ? 'bg-[#ecf9f4] text-[#065f46] border border-[#a7e3ce]'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                      }`}
                    >
                      {tab}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="max-h-[680px] divide-y divide-gray-200 overflow-y-auto">
              {filteredScripts.map((sc) => {
                const selected = activeScript?.scriptId === sc.scriptId;
                return (
                  <button
                    key={sc.scriptId}
                    type="button"
                    onClick={() => setSelectedId(sc.scriptId)}
                    className={`w-full px-4 py-3.5 text-left transition-colors ${
                      selected
                        ? 'border-l-[3px] border-l-[#0f9d76] bg-[#f7fcfa]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {sc.scriptId}
                      </span>
                      <StatusBadge
                        label={sc.evaluationStatus}
                        tone={
                          sc.evaluationStatus === 'Evaluated'
                            ? 'mint'
                            : sc.evaluationStatus === 'Correction Requested'
                            ? 'danger'
                            : 'warning'
                        }
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs font-medium text-gray-800">
                      <span>
                        {sc.studentId} · {sc.subjectCode} ({sc.questionNumber})
                      </span>
                      {sc.sourceType && sc.sourceType !== 'End-Sem Script' && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {sc.sourceType}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Suggested: {sc.suggestedMarks}/{sc.maxMarks}</span>
                      <span className="font-mono font-semibold text-gray-800">
                        Final: {sc.finalMarks !== null ? `${sc.finalMarks}/${sc.maxMarks}` : '—'}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredScripts.length === 0 && (
                <div className="p-6 text-center text-xs text-gray-500">
                  No scripts match the filter.
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right Interactive Evaluation Workspace */}
        <div className="lg:col-span-8">
          {!activeScript || !evalAnalysis ? (
            <SectionCard>
              <div className="py-12 text-center text-sm text-gray-500">
                Select an answer script from the queue to begin evaluation.
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-5">
              {/* Script Metadata Header */}
              <SectionCard>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {activeScript.scriptId}
                      </span>
                      <StatusBadge
                        label={activeScript.evaluationStatus}
                        tone={
                          activeScript.evaluationStatus === 'Evaluated'
                            ? 'mint'
                            : activeScript.evaluationStatus === 'Correction Requested'
                            ? 'danger'
                            : 'warning'
                        }
                      />
                      {activeScript.moderationStatus !== 'None' && (
                        <StatusBadge
                          label={`Moderation: ${activeScript.moderationStatus}`}
                          tone={
                            activeScript.moderationStatus === 'Resolved'
                              ? 'mint'
                              : 'warning'
                          }
                        />
                      )}
                    </div>
                    <h2 className="mt-1.5 text-base font-semibold text-gray-900">
                      {activeScript.subjectCode} — {activeScript.subjectName}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                      <span>
                        Student: <strong className="font-mono text-gray-900">{activeScript.studentId}</strong> ({activeScript.studentName})
                      </span>
                      <span>
                        Exam: <strong className="font-mono text-gray-900">{activeScript.examId}</strong>
                      </span>
                      <span>
                        Question: <strong className="text-gray-900">{activeScript.questionNumber}</strong>
                      </span>
                      <span>
                        Max Marks: <strong className="font-mono text-gray-900">{activeScript.maxMarks}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Submitted: {activeScript.submittedAt}</div>
                    <div>Examiner: {activeScript.examinerId}</div>
                    <div>Record Version: v{activeScript.version}</div>
                  </div>
                </div>

                {activeScript.approvalStatus === 'Correction Requested' && (
                  <NoticeBox
                    title="Returned by Examination Administrator for Correction"
                    tone="warning"
                    className="mt-4"
                  >
                    {activeScript.approvalNotes || 'Please re-verify evaluation against rubric.'}
                  </NoticeBox>
                )}

                {activeScript.subjectCode === 'CS304' &&
                  config.cs304DualModerationActive && (
                    <NoticeBox
                      title="Task 6 Governance Watch: CS304 Historical Examiner Inconsistency"
                      tone="warning"
                      className="mt-4"
                    >
                      Subject CS304 is currently under mandatory dual moderation. Any saved
                      grade will automatically route through moderation verification before
                      final approval.
                    </NoticeBox>
                  )}
              </SectionCard>

              {/* Student Submitted Descriptive Answer */}
              <SectionCard
                title={`Student Descriptive Answer — ${activeScript.questionNumber}`}
                subtitle="Submitted response from digitized answer booklet"
                actions={
                  <button
                    type="button"
                    onClick={() => setHighlightKeywords((v) => !v)}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {highlightKeywords
                      ? 'Hide Matched Keywords'
                      : 'Highlight Matched Keywords'}
                  </button>
                }
              >
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 text-sm leading-relaxed text-gray-800">
                  {answerSegments.map((seg, idx) =>
                    seg.highlighted ? (
                      <mark
                        key={idx}
                        className="rounded bg-[#d1f4e5] px-1 py-0.5 font-medium text-[#065f46]"
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={idx}>{seg.text}</span>
                    )
                  )}
                </div>
              </SectionCard>

              {/* Rubric Concepts + Rule-Based Suggestion */}
              <SectionCard
                title="Deterministic Rubric-Keyword Breakdown"
                subtitle={`Rubric ${activeScript.rubricId} · ${evalAnalysis.coveragePct}% concept rule coverage`}
              >
                <NoticeBox
                  title="Rule-Based Assistance Only — Not Guaranteed Correct Marks"
                  tone="mint"
                  className="mb-4"
                >
                  Suggested marks (<strong className="font-mono">{evalAnalysis.suggestedMarks} / {activeScript.maxMarks}</strong>)
                  are generated using transparent keyword/phrase matching rules. Keyword presence
                  does not guarantee conceptual accuracy or logical correctness—final marks
                  require accountable human examiner judgment.
                </NoticeBox>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-3.5">
                    <div className="text-xs font-semibold text-[#065f46]">
                      Matched Concepts ({evalAnalysis.matchedConcepts.length})
                    </div>
                    {evalAnalysis.matchedConcepts.length === 0 ? (
                      <p className="mt-2 text-xs text-gray-500">No rubric concepts matched.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {evalAnalysis.conceptBreakdown
                          .filter((c) => c.matched)
                          .map((c) => (
                            <li
                              key={c.concept.id}
                              className="rounded-md border border-[#c8ede0] bg-[#f7fcfa] p-2.5 text-xs"
                            >
                              <div className="flex items-center justify-between font-medium text-gray-900">
                                <span>{c.concept.title}</span>
                                <span className="font-mono text-[#065f46]">
                                  +{c.awardedPoints}/{c.concept.maxPoints}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-gray-600">
                                Matched keywords:{' '}
                                <span className="font-mono">
                                  {c.matchedKeywords.join(', ')}
                                </span>
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3.5">
                    <div className="text-xs font-semibold text-gray-700">
                      Missing Concepts ({evalAnalysis.missingConcepts.length})
                    </div>
                    {evalAnalysis.missingConcepts.length === 0 ? (
                      <p className="mt-2 text-xs text-gray-500">
                        All predefined rubric concepts had keyword matches.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {evalAnalysis.conceptBreakdown
                          .filter((c) => !c.matched)
                          .map((c) => (
                            <li
                              key={c.concept.id}
                              className="rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs"
                            >
                              <div className="flex items-center justify-between font-medium text-gray-800">
                                <span>{c.concept.title}</span>
                                <span className="font-mono text-gray-500">
                                  0/{c.concept.maxPoints}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-gray-500">
                                Expected rules:{' '}
                                <span className="font-mono">
                                  {c.concept.keywords.join(', ')}
                                </span>
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Examiner Final Marks & Override Accountability Form */}
              <SectionCard
                title="Examiner Final Marks & Accountability Record"
                subtitle="Accept rule-based suggestion or override with mandatory justification"
              >
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                        Rule-Based Suggested Marks
                      </div>
                      <div className="mt-1 font-mono text-2xl font-semibold text-gray-900">
                        {activeScript.suggestedMarks}{' '}
                        <span className="text-sm font-normal text-gray-500">
                          / {activeScript.maxMarks}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        Rule-based assistance only
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="examiner-final-marks"
                        className="block text-[11px] font-medium uppercase tracking-wider text-gray-700"
                      >
                        Examiner’s Final Marks
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id="examiner-final-marks"
                          type="number"
                          step="0.5"
                          min={0}
                          max={activeScript.maxMarks}
                          value={finalMarksInput}
                          onChange={(e) => {
                            setFinalMarksInput(e.target.value);
                            setOverrideMode(
                              Math.abs(
                                Number(e.target.value) - activeScript.suggestedMarks
                              ) > 0.01
                            );
                            setErrorMsg('');
                          }}
                          className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-base font-semibold text-gray-900 focus:border-[#0f9d76] focus:outline-none"
                        />
                        <span className="text-xs text-gray-500">
                          / {activeScript.maxMarks}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAcceptSuggestion}
                      >
                        Accept Suggestion ({activeScript.suggestedMarks})
                      </Button>
                      <Button
                        type="button"
                        variant={overrideMode || isOverriding ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={handleEnableOverride}
                      >
                        Override Marks
                      </Button>
                    </div>
                  </div>

                  {(overrideMode || isOverriding) && (
                    <div>
                      <label
                        htmlFor="override-reason"
                        className="mb-1 block text-xs font-semibold text-gray-900"
                      >
                        Mandatory Reason for Overriding Rule-Based Marks{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        id="override-reason"
                        rows={2}
                        required={isOverriding && config.requireOverrideReason}
                        value={overrideReason}
                        onChange={(e) => {
                          setOverrideReason(e.target.value);
                          setErrorMsg('');
                        }}
                        placeholder="Specify conceptual errors, missed derivations, or valid alternative proof justifying the mark difference..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-[#0f9d76] focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        Mark delta:{' '}
                        <span className="font-mono font-medium text-gray-800">
                          {Number.isNaN(numericMarks)
                            ? '—'
                            : `${numericMarks - activeScript.suggestedMarks >= 0 ? '+' : ''}${(
                                numericMarks - activeScript.suggestedMarks
                              ).toFixed(1)}`}
                        </span>{' '}
                        (Variance &ge; {config.moderationVarianceThresholdPct}% automatically
                        flags for Moderation).
                      </p>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="examiner-notes"
                      className="mb-1 block text-xs font-medium text-gray-700"
                    >
                      Examiner Feedback / Remarks (Optional)
                    </label>
                    <input
                      id="examiner-notes"
                      type="text"
                      value={examinerNotes}
                      onChange={(e) => setExaminerNotes(e.target.value)}
                      placeholder="Concise academic note for moderation & student review record..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-[#0f9d76] focus:outline-none"
                    />
                  </div>

                  {errorMsg && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
                    <span className="text-[11px] text-gray-500">
                      Saving creates an immutable versioned entry in Audit Logs.
                    </span>
                    <Button type="submit" variant="primary">
                      Save Evaluation
                    </Button>
                  </div>
                </form>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
