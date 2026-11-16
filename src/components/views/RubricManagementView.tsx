import React, { useMemo, useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { evaluateAnswerWithRubric } from '../../utils/rubricEngine';
import {
  Button,
  Modal,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../ui/Primitives';

export const RubricManagementView: React.FC = () => {
  const { rubrics, exams, activeRole, addRubricConcept, updateRubricConcept, createRubric } =
    useErp();

  const [selectedRubricId, setSelectedRubricId] = useState(
    () => rubrics[0]?.rubricId ?? ''
  );
  const [sandboxText, setSandboxText] = useState(
    'Deadlock requires mutual exclusion, hold and wait, no preemption, and circular wait. Global resource ordering breaks cycles while Banker’s Algorithm maintains a safe state using allocation and need matrix checks.'
  );
  const [showAddConcept, setShowAddConcept] = useState(false);
  const [showCreateRubric, setShowCreateRubric] = useState(false);
  const [newConcept, setNewConcept] = useState({
    title: '',
    description: '',
    maxPoints: 3,
    keywordsCsv: '',
  });
  const [newRubricForm, setNewRubricForm] = useState({
    subjectCode: exams[0]?.subjectCode ?? 'CS301',
    questionNumber: 'Q6(a)',
    conceptTitle: '',
    conceptDescription: '',
    maxPoints: 5,
    keywordsCsv: '',
  });

  const canEdit = activeRole === 'admin' || activeRole === 'examiner';

  const activeRubric = useMemo(
    () => rubrics.find((r) => r.rubricId === selectedRubricId) ?? rubrics[0],
    [rubrics, selectedRubricId]
  );

  const sandboxResult = useMemo(
    () => evaluateAnswerWithRubric(sandboxText, activeRubric),
    [sandboxText, activeRubric]
  );

  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRubric || !newConcept.title.trim()) return;
    const keywords = newConcept.keywordsCsv
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (!keywords.length) return;

    addRubricConcept(activeRubric.rubricId, {
      title: newConcept.title.trim(),
      description: newConcept.description.trim() || 'Defined rubric concept.',
      maxPoints: Number(newConcept.maxPoints),
      keywords,
    });
    setShowAddConcept(false);
    setNewConcept({ title: '', description: '', maxPoints: 3, keywordsCsv: '' });
  };

  const handleCreateRubric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRubricForm.questionNumber.trim() || !newRubricForm.conceptTitle.trim()) return;
    const exam = exams.find((x) => x.subjectCode === newRubricForm.subjectCode);
    createRubric({
      subjectCode: newRubricForm.subjectCode,
      subjectName: exam?.subjectName ?? newRubricForm.subjectCode,
      questionNumber: newRubricForm.questionNumber,
      conceptTitle: newRubricForm.conceptTitle,
      conceptDescription: newRubricForm.conceptDescription,
      maxPoints: Number(newRubricForm.maxPoints),
      keywordsCsv: newRubricForm.keywordsCsv,
    });
    setShowCreateRubric(false);
    setNewRubricForm({
      ...newRubricForm,
      questionNumber: '',
      conceptTitle: '',
      conceptDescription: '',
      keywordsCsv: '',
    });
  };

  return (
    <div>
      <PageHeader
        title="Rubric-Based Assessment"
        subtitle="Predefined deterministic concepts, keyword rules, and point weightings"
        badge="Rule-Based Schema"
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowCreateRubric(true)}>
                Create New Rubric
              </Button>
              {activeRubric && (
                <Button variant="primary" onClick={() => setShowAddConcept(true)}>
                  Add Rubric Concept
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <NoticeBox
        title="Transparent Deterministic Rules"
        tone="neutral"
        className="mb-6"
      >
        Each rubric defines explicit subject concepts and verifiable keyword phrases. Matching
        2+ phrases awards full concept weight; 1 phrase awards 50% weight. No black-box
        machine learning model is used.
      </NoticeBox>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Rubric Selector */}
        <div className="lg:col-span-4 space-y-4">
          <SectionCard title="Question Rubrics" noPadding>
            <div className="divide-y divide-gray-200">
              {rubrics.map((r) => {
                const selected = activeRubric?.rubricId === r.rubricId;
                return (
                  <button
                    key={r.rubricId}
                    type="button"
                    onClick={() => setSelectedRubricId(r.rubricId)}
                    className={`w-full px-4 py-3.5 text-left transition-colors ${
                      selected
                        ? 'border-l-[3px] border-l-[#0f9d76] bg-[#f7fcfa]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {r.subjectCode} · {r.questionNumber}
                      </span>
                      <StatusBadge label={`${r.maxMarks} Marks`} tone="mint" />
                    </div>
                    <div className="mt-1 text-xs text-gray-700">{r.subjectName}</div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {r.concepts.length} predefined concepts · {r.rubricId}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Concept Rules & Deterministic Sandbox */}
        <div className="lg:col-span-8 space-y-6">
          {activeRubric && (
            <>
              <SectionCard
                title={`${activeRubric.subjectCode} (${activeRubric.questionNumber}) — Concept Definitions`}
                subtitle={`${activeRubric.subjectName} · Total Maximum Marks: ${activeRubric.maxMarks}`}
                noPadding
              >
                <div className="divide-y divide-gray-200">
                  {activeRubric.concepts.map((concept) => (
                    <div key={concept.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-400">
                              {concept.id}
                            </span>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {concept.title}
                            </h3>
                          </div>
                          <p className="mt-1 text-xs text-gray-600">
                            {concept.description}
                          </p>
                        </div>
                        <StatusBadge label={`${concept.maxPoints} pts`} tone="neutral" />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-gray-500">
                          Rule keywords:
                        </span>
                        {concept.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700"
                          >
                            {kw}
                          </span>
                        ))}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              const extra = window.prompt(
                                `Add comma-separated keyword(s) for "${concept.title}":`,
                                ''
                              );
                              if (!extra) return;
                              const added = extra
                                .split(',')
                                .map((k) => k.trim().toLowerCase())
                                .filter(Boolean);
                              if (!added.length) return;
                              updateRubricConcept(activeRubric.rubricId, {
                                ...concept,
                                keywords: Array.from(
                                  new Set([...concept.keywords, ...added])
                                ),
                              });
                            }}
                            className="ml-1 rounded border border-[#a7e3ce] bg-[#ecf9f4] px-2 py-0.5 text-[11px] font-medium text-[#065f46] hover:bg-[#d8f3e9]"
                          >
                            + Add Keyword
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Deterministic Rule Matcher Verification Sandbox"
                subtitle="Test how keyword rules score any sample answer text against the selected rubric"
              >
                <textarea
                  rows={3}
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-xs text-gray-900 focus:border-[#0f9d76] focus:outline-none"
                  placeholder="Paste sample student text to verify rule matches..."
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
                  <div>
                    <span className="text-gray-600">Rule-Based Suggested Score: </span>
                    <span className="font-mono text-base font-semibold text-[#065f46]">
                      {sandboxResult.suggestedMarks} / {sandboxResult.maxMarks}
                    </span>
                    <span className="ml-2 text-gray-500">
                      ({sandboxResult.coveragePct}% concept match)
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Matched: {sandboxResult.matchedConcepts.length} · Missing:{' '}
                    {sandboxResult.missingConcepts.length}
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>

      <Modal
        open={showAddConcept}
        onClose={() => setShowAddConcept(false)}
        title="Add Rubric Concept"
        subtitle={
          activeRubric
            ? `Adding to ${activeRubric.subjectCode} (${activeRubric.questionNumber})`
            : ''
        }
      >
        <form onSubmit={handleAddConcept} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-gray-700">Concept Title</label>
            <input
              required
              value={newConcept.title}
              onChange={(e) => setNewConcept({ ...newConcept, title: e.target.value })}
              placeholder="e.g., Two-Phase Locking Serializability"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">Description</label>
            <input
              value={newConcept.description}
              onChange={(e) =>
                setNewConcept({ ...newConcept, description: e.target.value })
              }
              placeholder="What the examiner looks for in this concept..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">Max Points</label>
              <input
                type="number"
                min={1}
                max={10}
                value={newConcept.maxPoints}
                onChange={(e) =>
                  setNewConcept({ ...newConcept, maxPoints: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Keywords (comma-separated)
              </label>
              <input
                required
                value={newConcept.keywordsCsv}
                onChange={(e) =>
                  setNewConcept({ ...newConcept, keywordsCsv: e.target.value })
                }
                placeholder="2pl, conflict serializable, lock"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddConcept(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Concept
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showCreateRubric}
        onClose={() => setShowCreateRubric(false)}
        title="Create New Evaluation Rubric"
        subtitle="Creates a deterministic concept rubric for an exam question or assessment"
      >
        <form onSubmit={handleCreateRubric} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">Course</label>
              <select
                value={newRubricForm.subjectCode}
                onChange={(e) =>
                  setNewRubricForm({ ...newRubricForm, subjectCode: e.target.value })
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
              <label className="mb-1 block font-medium text-gray-700">
                Question / Assessment ID
              </label>
              <input
                required
                value={newRubricForm.questionNumber}
                onChange={(e) =>
                  setNewRubricForm({ ...newRubricForm, questionNumber: e.target.value })
                }
                placeholder="Q6(a) or ASG-CS301-06"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              First Concept Title
            </label>
            <input
              required
              value={newRubricForm.conceptTitle}
              onChange={(e) =>
                setNewRubricForm({ ...newRubricForm, conceptTitle: e.target.value })
              }
              placeholder="e.g., Consensus Safety Invariant"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Concept Description
            </label>
            <input
              value={newRubricForm.conceptDescription}
              onChange={(e) =>
                setNewRubricForm({
                  ...newRubricForm,
                  conceptDescription: e.target.value,
                })
              }
              placeholder="Criterion details for examiners..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Initial Concept Points
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={newRubricForm.maxPoints}
                onChange={(e) =>
                  setNewRubricForm({
                    ...newRubricForm,
                    maxPoints: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Keywords (comma-separated)
              </label>
              <input
                required
                value={newRubricForm.keywordsCsv}
                onChange={(e) =>
                  setNewRubricForm({ ...newRubricForm, keywordsCsv: e.target.value })
                }
                placeholder="quorum, leader, state machine"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateRubric(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Rubric
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
