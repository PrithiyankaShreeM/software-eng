import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useErp } from '../../context/ErpContext';
import { ROLE_ALLOWED_SECTIONS } from '../../context/ErpContext';
import {
  Button,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';
import { NavSectionId } from '../../types/erp';

export const OverviewView: React.FC = () => {
  const {
    activeRole,
    activeAccount,
    students,
    exams,
    scripts,
    revaluations,
    credentials,
    auditLogs,
    config,
    setActiveSection,
  } = useErp();

  const stats = useMemo(() => {
    const pendingEvaluations = scripts.filter(
      (s) =>
        s.evaluationStatus === 'Pending Evaluation' ||
        s.evaluationStatus === 'Correction Requested'
    ).length;
    const pendingModeration = scripts.filter(
      (s) => s.moderationStatus === 'Flagged' || s.moderationStatus === 'Under Review'
    ).length;
    const awaitingApproval = scripts.filter(
      (s) =>
        s.evaluationStatus === 'Evaluated' &&
        s.approvalStatus === 'Pending' &&
        (s.moderationStatus === 'None' || s.moderationStatus === 'Resolved')
    ).length;
    const openRevaluations = revaluations.filter(
      (r) => !r.status.startsWith('Resolved')
    ).length;
    const totalCohortSubmissions = exams.reduce((a, e) => a + e.scriptsSubmitted, 0);

    return {
      totalStudents: students.length,
      examsConducted: exams.length,
      scriptsSubmitted: scripts.length,
      totalCohortSubmissions,
      pendingEvaluations,
      pendingModeration,
      awaitingApproval,
      revaluationCount: revaluations.length,
      openRevaluations,
      credentialsIssued: credentials.length,
    };
  }, [students, exams, scripts, revaluations, credentials]);

  const examActivityData = useMemo(() => {
    return exams.map((exam) => {
      const subjectScripts = scripts.filter((s) => s.subjectCode === exam.subjectCode);
      const evaluated = subjectScripts.filter(
        (s) => s.evaluationStatus === 'Evaluated'
      ).length;
      return {
        subject: exam.subjectCode,
        submitted: subjectScripts.length,
        evaluated,
        cohortTotal: exam.scriptsSubmitted,
      };
    });
  }, [exams, scripts]);

  const completionData = useMemo(() => {
    const subjects = Array.from(new Set(scripts.map((s) => s.subjectCode)));
    return subjects.map((code) => {
      const sub = scripts.filter((s) => s.subjectCode === code);
      const completed = sub.filter((s) => s.evaluationStatus === 'Evaluated').length;
      const pending = sub.length - completed;
      return {
        subject: code,
        Completed: completed,
        Pending: pending,
      };
    });
  }, [scripts]);

  const marksDistributionData = useMemo(() => {
    const bands = [
      { band: '0–40%', count: 0 },
      { band: '41–60%', count: 0 },
      { band: '61–75%', count: 0 },
      { band: '76–90%', count: 0 },
      { band: '91–100%', count: 0 },
    ];
    scripts.forEach((s) => {
      if (s.finalMarks === null) return;
      const pct = (s.finalMarks / s.maxMarks) * 100;
      if (pct <= 40) bands[0].count += 1;
      else if (pct <= 60) bands[1].count += 1;
      else if (pct <= 75) bands[2].count += 1;
      else if (pct <= 90) bands[3].count += 1;
      else bands[4].count += 1;
    });
    return bands;
  }, [scripts]);

  const moderationPriorityData = useMemo(() => {
    const low = scripts.filter((s) => s.moderationPriorityScore < 30).length;
    const med = scripts.filter(
      (s) => s.moderationPriorityScore >= 30 && s.moderationPriorityScore < 65
    ).length;
    const high = scripts.filter((s) => s.moderationPriorityScore >= 65).length;
    return [
      { tier: 'Low (0–29)', Scripts: low },
      { tier: 'Medium (30–64)', Scripts: med },
      { tier: 'High (65–100)', Scripts: high },
    ];
  }, [scripts]);

  const canGo = (sec: NavSectionId) =>
    ROLE_ALLOWED_SECTIONS[activeRole].includes(sec);

  const pendingTasks = useMemo(() => {
    const tasks: {
      id: string;
      title: string;
      detail: string;
      status: string;
      tone: 'mint' | 'neutral' | 'warning';
      target: NavSectionId;
    }[] = [];

    if (stats.pendingEvaluations > 0) {
      tasks.push({
        id: 't-eval',
        title: `${stats.pendingEvaluations} Answer Scripts Pending Evaluation`,
        detail: 'Includes pending scripts and correction requests.',
        status: 'Action Due',
        tone: 'warning',
        target: 'evaluation',
      });
    }
    if (stats.pendingModeration > 0) {
      tasks.push({
        id: 't-mod',
        title: `${stats.pendingModeration} Scripts Flagged for Moderation`,
        detail: 'Rule-based variance above threshold or CS304 inconsistency watch.',
        status: 'Review Needed',
        tone: 'warning',
        target: 'moderation',
      });
    }
    if (stats.awaitingApproval > 0) {
      tasks.push({
        id: 't-app',
        title: `${stats.awaitingApproval} Evaluated Results Awaiting Final Approval`,
        detail: 'Cleared scripts ready for approval and publication.',
        status: 'Ready',
        tone: 'mint',
        target: 'approval',
      });
    }
    if (stats.openRevaluations > 0) {
      tasks.push({
        id: 't-rev',
        title: `${stats.openRevaluations} Open Revaluation Requests`,
        detail: 'Student appeals awaiting examiner assignment or resolution.',
        status: 'Open Queue',
        tone: 'neutral',
        target: 'revaluation',
      });
    }
    if (config.partnerWithdrawn) {
      tasks.push({
        id: 't-cred',
        title: 'Partner Verification Offline — Local Preservation Active',
        detail: 'External verification queries return Unavailable with Safe Retry.',
        status: 'Task 6 Mode',
        tone: 'warning',
        target: 'credentials',
      });
    }
    return tasks;
  }, [stats, config.partnerWithdrawn]);

  return (
    <div>
      <PageHeader
        title="Examination & Credential Operations Overview"
        subtitle={`Logged in as ${activeAccount.name} (${activeAccount.roleLabel}) · ${config.academicSession}`}
        badge={
          config.reducedResourceMode
            ? '50% Compute Mode'
            : 'Standard Operating Mode'
        }
        actions={
          canGo('redesign') ? (
            <Button variant="secondary" onClick={() => setActiveSection('redesign')}>
              Open Task 6 Redesign Scenario
            </Button>
          ) : undefined
        }
      />

      {/* 8 Dashboard Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Students"
          value={stats.totalStudents}
          sublabel="Active registered university cohort"
        />
        <StatCard
          label="Examinations Conducted"
          value={stats.examsConducted}
          sublabel="Odd Semester Nov 2026 schedule"
        />
        <StatCard
          label="Answer Scripts Submitted"
          value={stats.scriptsSubmitted}
          sublabel={`Tracked sample (${stats.totalCohortSubmissions} total batch scripts)`}
          accent="mint"
        />
        <StatCard
          label="Pending Evaluations"
          value={stats.pendingEvaluations}
          sublabel="Awaiting examiner grading or correction"
          accent={stats.pendingEvaluations > 0 ? 'warning' : 'mint'}
        />
        <StatCard
          label="Pending Moderation"
          value={stats.pendingModeration}
          sublabel="Flagged or under moderation review"
          accent={stats.pendingModeration > 0 ? 'warning' : 'mint'}
        />
        <StatCard
          label="Results Awaiting Approval"
          value={stats.awaitingApproval}
          sublabel="Moderation-cleared for administrator sign-off"
          accent="mint"
        />
        <StatCard
          label="Revaluation Requests"
          value={stats.revaluationCount}
          sublabel={`${stats.openRevaluations} open · ${
            stats.revaluationCount - stats.openRevaluations
          } resolved`}
        />
        <StatCard
          label="Credentials Issued"
          value={stats.credentialsIssued}
          sublabel={
            config.partnerWithdrawn
              ? 'Local registry preserved (partner offline)'
              : 'Local verification registry active'
          }
          accent="mint"
        />
      </div>

      {/* 4 Interactive Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Examination Activity by Subject"
          subtitle="Tracked scripts submitted vs evaluated per course"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examActivityData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="submitted"
                  name="Scripts Submitted"
                  fill="#9ca3af"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="evaluated"
                  name="Scripts Evaluated"
                  fill="#0f9d76"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Evaluation Completion Progress"
          subtitle="Completed vs pending scripts per subject"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionData} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis
                  dataKey="subject"
                  type="category"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Completed" stackId="a" fill="#0f9d76" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pending" stackId="a" fill="#d1d5db" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Marks Distribution (Evaluated Scripts)"
          subtitle="Percentage score bands across graded descriptive scripts"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marksDistributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="band" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Scripts"
                  fill="#0f9d76"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Moderation Priority Breakdown"
          subtitle="Deterministic priority index tiers (non-AI rule scoring)"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moderationPriorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="tier" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="Scripts"
                  fill="#6b7280"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Recent Activities + Pending Tasks */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Recent Activities"
          subtitle="Latest versioned audit actions across examination workflows"
          actions={
            canGo('audit') ? (
              <Button size="sm" variant="secondary" onClick={() => setActiveSection('audit')}>
                View Audit Trail
              </Button>
            ) : undefined
          }
          noPadding
        >
          <div className="divide-y divide-gray-200">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.auditId} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-gray-500">
                      {log.recordId}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">{log.action}</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-400">
                    {log.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {log.previousValue} → <span className="font-medium text-gray-900">{log.updatedValue}</span>
                </p>
                <div className="mt-1 text-[11px] text-gray-500">
                  By {log.userResponsible} ({log.userRole})
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Pending Tasks & Notifications"
          subtitle="Actionable governance items scoped to active workflow queues"
          noPadding
        >
          <div className="divide-y divide-gray-200">
            {pendingTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                All examination workflow queues are currently clear.
              </div>
            ) : (
              pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {task.title}
                      </span>
                      <StatusBadge label={task.status} tone={task.tone} />
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{task.detail}</p>
                  </div>
                  {canGo(task.target) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setActiveSection(task.target)}
                    >
                      Open
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
