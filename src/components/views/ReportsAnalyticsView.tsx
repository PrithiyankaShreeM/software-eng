import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useErp } from '../../context/ErpContext';
import { Button, PageHeader, SectionCard, StatusBadge } from '../ui/Primitives';

export const ReportsAnalyticsView: React.FC = () => {
  const { scripts, exams, revaluations, credentials, verificationHistory, config } =
    useErp();

  const [subjectFilter, setSubjectFilter] = useState('All');

  const subjects = useMemo(
    () => ['All', ...Array.from(new Set(exams.map((e) => e.subjectCode)))],
    [exams]
  );

  const filteredScripts = useMemo(
    () =>
      scripts.filter(
        (s) => subjectFilter === 'All' || s.subjectCode === subjectFilter
      ),
    [scripts, subjectFilter]
  );

  // 1. Evaluation Completion by Subject
  const evalCompletionData = useMemo(() => {
    const codes = Array.from(new Set(filteredScripts.map((s) => s.subjectCode)));
    return codes.map((code) => {
      const group = filteredScripts.filter((s) => s.subjectCode === code);
      const done = group.filter((s) => s.evaluationStatus === 'Evaluated').length;
      const pct = group.length ? Math.round((done / group.length) * 100) : 0;
      return {
        subject: code,
        completionPct: pct,
        evaluated: done,
        pending: group.length - done,
      };
    });
  }, [filteredScripts]);

  // 2. Subject-Wise Marks Distribution (Average Final vs Suggested)
  const subjectMarksData = useMemo(() => {
    const codes = Array.from(new Set(filteredScripts.map((s) => s.subjectCode)));
    return codes.map((code) => {
      const evaluated = filteredScripts.filter(
        (s) => s.subjectCode === code && s.finalMarks !== null
      );
      const avgFinal = evaluated.length
        ? Number(
            (
              evaluated.reduce((acc, s) => acc + (s.finalMarks ?? 0), 0) /
              evaluated.length
            ).toFixed(1)
          )
        : 0;
      const avgSuggested = evaluated.length
        ? Number(
            (
              evaluated.reduce((acc, s) => acc + s.suggestedMarks, 0) /
              evaluated.length
            ).toFixed(1)
          )
        : 0;
      return {
        subject: code,
        avgFinal,
        avgSuggested,
      };
    });
  }, [filteredScripts]);

  // 3. Examiner Evaluation Patterns (showing EXM-112 variance on CS304)
  const examinerPatternData = useMemo(() => {
    const ids = Array.from(new Set(filteredScripts.map((s) => s.examinerId)));
    return ids.map((id) => {
      const graded = filteredScripts.filter(
        (s) => s.examinerId === id && s.finalMarks !== null
      );
      const overrides = graded.filter(
        (s) => Math.abs((s.finalMarks ?? 0) - s.suggestedMarks) > 0.01
      ).length;
      const avgAbsDelta = graded.length
        ? Number(
            (
              graded.reduce(
                (acc, s) => acc + Math.abs((s.finalMarks ?? 0) - s.suggestedMarks),
                0
              ) / graded.length
            ).toFixed(2)
          )
        : 0;
      const overrideRatePct = graded.length
        ? Math.round((overrides / graded.length) * 100)
        : 0;
      return {
        examiner: id,
        avgAbsDelta,
        overrideRatePct,
        scriptsGraded: graded.length,
      };
    });
  }, [filteredScripts]);

  // 4. Moderation Frequency by Subject
  const moderationFreqData = useMemo(() => {
    const codes = Array.from(new Set(filteredScripts.map((s) => s.subjectCode)));
    return codes.map((code) => {
      const sub = filteredScripts.filter((s) => s.subjectCode === code);
      return {
        subject: code,
        Flagged: sub.filter(
          (s) => s.moderationStatus === 'Flagged' || s.moderationStatus === 'Under Review'
        ).length,
        Resolved: sub.filter((s) => s.moderationStatus === 'Resolved').length,
        Clear: sub.filter((s) => s.moderationStatus === 'None').length,
      };
    });
  }, [filteredScripts]);

  // 5. Revaluation Statistics
  const revaluationStatsData = useMemo(() => {
    const codes = Array.from(new Set(revaluations.map((r) => r.subjectCode)));
    return codes
      .filter((c) => subjectFilter === 'All' || c === subjectFilter)
      .map((code) => {
        const grp = revaluations.filter((r) => r.subjectCode === code);
        return {
          subject: code,
          Updated: grp.filter((r) => r.status === 'Resolved - Updated').length,
          NoChange: grp.filter((r) => r.status === 'Resolved - No Change').length,
          Open: grp.filter((r) => !r.status.startsWith('Resolved')).length,
        };
      });
  }, [revaluations, subjectFilter]);

  // 6. Credential Verification Statistics
  const credentialStatsData = useMemo(() => {
    return [
      {
        category: 'Valid',
        Count: verificationHistory.filter((v) => v.outcome === 'Valid').length,
        IssuedRecords: credentials.filter((c) => c.status === 'Valid').length,
      },
      {
        category: 'Invalid / Revoked',
        Count: verificationHistory.filter((v) => v.outcome === 'Invalid').length,
        IssuedRecords: credentials.filter((c) => c.status === 'Invalid').length,
      },
      {
        category: 'Unavailable (Retry)',
        Count: verificationHistory.filter(
          (v) => v.outcome === 'Verification Unavailable'
        ).length,
        IssuedRecords: credentials.filter(
          (c) => c.status === 'Verification Unavailable'
        ).length,
      },
    ];
  }, [verificationHistory, credentials]);

  const handleExportCsv = () => {
    const headers = [
      'ScriptID',
      'StudentID',
      'Subject',
      'ExaminerID',
      'SuggestedMarks',
      'FinalMarks',
      'ModerationPriority',
      'ModerationStatus',
      'ApprovalStatus',
      'Published',
    ];
    const rows = filteredScripts.map((s) => [
      s.scriptId,
      s.studentId,
      s.subjectCode,
      s.examinerId,
      s.suggestedMarks,
      s.finalMarks ?? '',
      s.moderationPriorityScore,
      s.moderationStatus,
      s.approvalStatus,
      s.published,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaveri-exam-analytics-${subjectFilter.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Evaluation throughput, subject distributions, examiner variance patterns, and verification metrics"
        badge={
          config.reducedResourceMode
            ? '50% Budget: On-Demand Snapshot'
            : 'Live Synthetic Dataset'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800"
            >
              {subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub === 'All' ? 'All Subjects' : sub}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleExportCsv}>
              Export CSV Report
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Evaluation Completion */}
        <SectionCard
          title="1. Evaluation Completion (%)"
          subtitle="Percentage of tracked answer scripts graded per subject"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evalCompletionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="completionPct"
                  name="Completion %"
                  fill="#0f9d76"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* 2. Subject-Wise Marks Distribution */}
        <SectionCard
          title="2. Subject-Wise Marks Comparison"
          subtitle="Mean examiner marks vs deterministic rubric baseline (out of 15)"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectMarksData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis domain={[0, 15]} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="avgSuggested"
                  name="Avg Rule Baseline"
                  fill="#9ca3af"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="avgFinal"
                  name="Avg Awarded"
                  fill="#0f9d76"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* 3. Examiner Evaluation Patterns */}
        <SectionCard
          title="3. Examiner Evaluation Patterns & Variance"
          subtitle="Mean absolute mark delta & override frequency per examiner (EXM-112 highlights CS304 drift)"
          actions={
            <StatusBadge label="Task 6 Indicator: EXM-112" tone="warning" />
          }
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={examinerPatternData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="examiner" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgAbsDelta"
                  name="Mean |Delta| (pts)"
                  stroke="#0f9d76"
                  strokeWidth={2.5}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="overrideRatePct"
                  name="Override Rate (%)"
                  stroke="#4b5563"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* 4. Moderation Frequency */}
        <SectionCard
          title="4. Moderation Frequency by Subject"
          subtitle="Flagged, resolved, and unflagged evaluations across courses"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moderationFreqData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Clear" stackId="m" fill="#d1d5db" />
                <Bar dataKey="Resolved" stackId="m" fill="#0f9d76" />
                <Bar dataKey="Flagged" stackId="m" fill="#4b5563" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* 5. Revaluation Statistics */}
        <SectionCard
          title="5. Revaluation Outcomes by Subject"
          subtitle="Requests resulting in updated marks vs upheld original marks vs open queue"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revaluationStatsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Updated" fill="#0f9d76" radius={[4, 4, 0, 0]} />
                <Bar dataKey="NoChange" name="No Change" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Open" fill="#d1d5db" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* 6. Credential Verification Statistics */}
        <SectionCard
          title="6. Credential Verification Statistics"
          subtitle="Verification checks logged and local registry states"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={credentialStatsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="category" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="Count"
                  name="Verification Lookups"
                  fill="#0f9d76"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="IssuedRecords"
                  name="Issued Registry Records"
                  fill="#9ca3af"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
