import React, { useMemo, useState } from 'react';
import { ROLE_ALLOWED_SECTIONS, useErp } from '../../context/ErpContext';
import {
  Button,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';

export const RedesignTask6View: React.FC = () => {
  const {
    scripts,
    credentials,
    students,
    config,
    activeRole,
    activateCs304DualModeration,
    togglePartnerWithdrawn,
    toggleReducedResourceMode,
    recordDisputedCorrection,
    setActiveSection,
  } = useErp();

  const [disputeReason, setDisputeReason] = useState(
    'Task 6 Governance Directive: Correct clerical total entry on SCR-2026-8806 from 7 to 10 while preserving v1 audit entry.'
  );
  const [correctedMarks, setCorrectedMarks] = useState('10');

  const cs304Scripts = useMemo(
    () => scripts.filter((s) => s.subjectCode === 'CS304'),
    [scripts]
  );

  const disputedStudent = useMemo(
    () => students.find((s) => s.studentId === 'STU-2026-106'),
    [students]
  );

  const canGo = (sec: 'moderation' | 'credentials' | 'audit') =>
    ROLE_ALLOWED_SECTIONS[activeRole].includes(sec);

  const handleApplyAllTask6 = () => {
    if (!config.cs304DualModerationActive) activateCs304DualModeration(true);
    if (!config.partnerWithdrawn) togglePartnerWithdrawn(true);
    if (!config.reducedResourceMode) toggleReducedResourceMode(true);
  };

  return (
    <div>
      <PageHeader
        title="Redesign Scenario — Assignment Task 6"
        subtitle="System resilience and governance adaptation under four changed institutional constraints"
        badge="Assignment Task 6"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleApplyAllTask6}>
              Simulate All Task 6 Constraints
            </Button>
          </div>
        }
      />

      <NoticeBox
        title="Task 6 Resilience Architecture Overview"
        tone="mint"
        className="mb-6"
      >
        Each condition below toggles real operational state across Evaluation, Moderation,
        Credential Management, and Audit Logs—demonstrating deterministic safeguards,
        preserved local records, reduced-compute operation, and non-destructive record
        corrections without claiming unverified AI or Blockchain infrastructure.
      </NoticeBox>

      {/* Live System Adaptation Status Strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="1. Subject CS304 Status"
          value={config.cs304DualModerationActive ? 'Dual Moderation' : 'Watchlist'}
          sublabel={`${cs304Scripts.length} CS304 scripts tracked (EXM-112 variance)`}
          accent={config.cs304DualModerationActive ? 'warning' : 'default'}
        />
        <StatCard
          label="2. Partner Federation"
          value={config.partnerWithdrawn ? 'Withdrawn' : 'Online (Mock)'}
          sublabel={`${credentials.length} local credentials preserved intact`}
          accent={config.partnerWithdrawn ? 'warning' : 'mint'}
        />
        <StatCard
          label="3. Computing Budget"
          value={config.reducedResourceMode ? '50% Budget (46 CU)' : '100% Budget (98 CU)'}
          sublabel={
            config.reducedResourceMode
              ? 'Lightweight deterministic pass active'
              : 'Standard telemetry & live keyword highlight'
          }
          accent={config.reducedResourceMode ? 'warning' : 'mint'}
        />
        <StatCard
          label="4. Disputed Record Protocol"
          value={config.disputedRecordCorrected ? 'Amendment Logged' : 'Pending Review'}
          sublabel={`Target: STU-2026-106 (${disputedStudent?.standing ?? 'Active'})`}
          accent={config.disputedRecordCorrected ? 'mint' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Condition 1: Historical Examiner Inconsistency */}
        <SectionCard
          title="Condition 1: Historical Examiner Marks Inconsistent (CS304)"
          subtitle="Examiner EXM-112 exhibits erratic positive (+4.5) and negative (-7.0) deviations on CS304"
          actions={
            <StatusBadge
              label={
                config.cs304DualModerationActive
                  ? 'Revised Status: Mandatory Dual Moderation'
                  : 'Status: Elevated Variance Detected'
              }
              tone="warning"
            />
          }
        >
          <div className="space-y-3 text-xs text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="font-semibold text-gray-900">Impact Assessment</div>
              <p className="mt-1">
                Relying on single-examiner overrides in Database Management Systems (CS304)
                risks inconsistent student grades and surges in revaluation appeals. Rule-based
                keyword matching alone cannot resolve systematic grading drift.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold text-gray-900">Observed CS304 Scripts</div>
              <ul className="mt-1.5 space-y-1">
                {cs304Scripts.map((s) => (
                  <li key={s.scriptId} className="flex justify-between font-mono text-[11px]">
                    <span>
                      {s.scriptId} ({s.studentId})
                    </span>
                    <span>
                      Suggested {s.suggestedMarks} vs Awarded {s.finalMarks ?? '—'} ·{' '}
                      {s.moderationStatus}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant={config.cs304DualModerationActive ? 'secondary' : 'primary'}
                onClick={() =>
                  activateCs304DualModeration(!config.cs304DualModerationActive)
                }
              >
                {config.cs304DualModerationActive
                  ? 'Disable CS304 Mandatory Dual Moderation'
                  : 'Enforce CS304 Mandatory Dual Moderation'}
              </Button>
              {canGo('moderation') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveSection('moderation')}
                >
                  Inspect CS304 in Moderation
                </Button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Condition 2: Partner Institution Withdraws */}
        <SectionCard
          title="Condition 2: Partner Institution Withdraws Credential Arrangement"
          subtitle="Federated verification node is withdrawn or unreachable"
          actions={
            <StatusBadge
              label={
                config.partnerWithdrawn
                  ? 'Revised Status: Local Registry Preserved'
                  : 'Status: Partner Federation Online'
              }
              tone={config.partnerWithdrawn ? 'warning' : 'mint'}
            />
          }
        >
          <div className="space-y-3 text-xs text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="font-semibold text-gray-900">Impact Assessment</div>
              <p className="mt-1">
                Cross-institution verification requests cannot obtain external partner
                attestation. Naive error handling could wrongly mark valid alumni degrees as
                Invalid or discard locally signed records.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold text-gray-900">
                Corrective Behavior & Record Preservation
              </div>
              <p className="mt-1">
                When partner verification is unavailable, the university preserves all{' '}
                <strong>{credentials.length} local credential records</strong> with intact
                SHA-256 integrity digests, accurately surfaces{' '}
                <em>Verification Unavailable</em> for partner-dependent lookups, and queues
                them for <strong>Safe Retry</strong> without claiming any live Blockchain
                network.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant={config.partnerWithdrawn ? 'secondary' : 'primary'}
                onClick={() => togglePartnerWithdrawn(!config.partnerWithdrawn)}
              >
                {config.partnerWithdrawn
                  ? 'Restore Partner Verification Service'
                  : 'Simulate Partner Withdrawal'}
              </Button>
              {canGo('credentials') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveSection('credentials')}
                >
                  Test Safe Retry in Credentials
                </Button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Condition 3: Computing Budget Reduced by 50% */}
        <SectionCard
          title="Condition 3: Computing Budget Reduced by 50%"
          subtitle="Constraint-driven degradation to lightweight deterministic operations"
          actions={
            <StatusBadge
              label={
                config.reducedResourceMode
                  ? 'Revised Status: 50% Lightweight Mode'
                  : 'Status: Standard 100% Compute'
              }
              tone={config.reducedResourceMode ? 'warning' : 'mint'}
            />
          }
        >
          <div className="space-y-3 text-xs text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="font-semibold text-gray-900">Impact Assessment</div>
              <p className="mt-1">
                Continuous inline text-span highlighting, automated bulk batch re-indexing,
                and real-time chart polling exceed the reduced 50% compute allocation.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Subsystem</th>
                    <th className="px-3 py-2">Standard (100%)</th>
                    <th className="px-3 py-2">Reduced-Resource (50%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-3 py-2 font-medium">Rubric Matching</td>
                    <td className="px-3 py-2">Live keyword span highlight</td>
                    <td className="px-3 py-2 font-semibold text-[#065f46]">
                      On-demand plain rule pass
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Analytics Telemetry</td>
                    <td className="px-3 py-2">Continuous aggregation</td>
                    <td className="px-3 py-2 font-semibold text-[#065f46]">
                      Static snapshot / CSV export
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Estimated Load</td>
                    <td className="px-3 py-2 font-mono">98 CU/hr</td>
                    <td className="px-3 py-2 font-mono font-semibold text-[#065f46]">
                      46 CU/hr (-53%)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant={config.reducedResourceMode ? 'secondary' : 'primary'}
                onClick={() => toggleReducedResourceMode(!config.reducedResourceMode)}
              >
                {config.reducedResourceMode
                  ? 'Restore 100% Computing Mode'
                  : 'Enable 50% Reduced-Resource Mode'}
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Condition 4: Sensitive or Disputed Student Records Require Correction */}
        <SectionCard
          title="Condition 4: Disputed Student Records Require Correction"
          subtitle="Non-destructive amendment workflow preserving original evaluation state"
          actions={
            <StatusBadge
              label={
                config.disputedRecordCorrected
                  ? 'Revised Status: Versioned Correction Applied'
                  : 'Status: Pending Formal Correction'
              }
              tone={config.disputedRecordCorrected ? 'mint' : 'warning'}
            />
          }
        >
          <div className="space-y-3 text-xs text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="font-semibold text-gray-900">
                Disputed Case: STU-2026-106 / SCR-2026-8806 (CS304)
              </div>
              <p className="mt-1">
                Student Vikram Aditya disputed CS304 Q3(a) mark transcription. Silent
                in-place mutation would destroy audit evidence; instead, the system appends a
                new signed version retaining both v1 and v2 values.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Corrected Q3(a) Marks (0–15)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={15}
                  value={correctedMarks}
                  onChange={(e) => setCorrectedMarks(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 font-mono font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Formal Amendment Justification
                </label>
                <input
                  type="text"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="primary"
                disabled={!disputeReason.trim()}
                onClick={() => {
                  const num = Number(correctedMarks);
                  if (Number.isNaN(num) || num < 0 || num > 15) return;
                  const target = scripts.find((s) => s.scriptId === 'SCR-2026-8806');
                  recordDisputedCorrection({
                    recordId: 'SCR-2026-8806',
                    recordType: 'AnswerScript',
                    previousValue: `Marks: ${target?.finalMarks ?? 7}/15 (Disputed)`,
                    updatedValue: `Corrected Marks: ${num}/15 (Approved Amendment)`,
                    reason: disputeReason.trim(),
                    markStudentStandingActive: 'STU-2026-106',
                    updatedScriptMarks: { scriptId: 'SCR-2026-8806', newMarks: num },
                  });
                }}
              >
                Append Non-Destructive Correction
              </Button>
              {canGo('audit') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveSection('audit')}
                >
                  Inspect Version Trail in Audit Logs
                </Button>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
