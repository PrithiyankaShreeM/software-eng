import React, { useMemo, useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { VerificationAttempt } from '../../types/erp';
import {
  Button,
  Modal,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../ui/Primitives';

export const CredentialManagementView: React.FC = () => {
  const {
    activeRole,
    activeStudentId,
    students,
    credentials,
    verificationHistory,
    config,
    issueCredential,
    verifyCredential,
    retryVerificationAttempt,
    togglePartnerWithdrawn,
  } = useErp();

  const [lookupId, setLookupId] = useState('CERT-KU-2026-0912');
  const [lastResult, setLastResult] = useState<VerificationAttempt | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);

  const [issueForm, setIssueForm] = useState({
    studentId: 'STU-2026-104',
    degreeProgram: 'B.Tech in Computer Science & Engineering',
    classification: 'First Class with Distinction',
    partnerRegistryRequired: true,
  });

  const canIssue = activeRole === 'admin';
  const isStudent = activeRole === 'student';

  const visibleCredentials = useMemo(() => {
    if (isStudent) {
      return credentials.filter((c) => c.studentId === activeStudentId);
    }
    return credentials;
  }, [credentials, isStudent, activeStudentId]);

  const visibleHistory = useMemo(() => {
    if (isStudent) {
      const myCertIds = new Set(visibleCredentials.map((c) => c.certificateId));
      return verificationHistory.filter((v) => myCertIds.has(v.certificateId));
    }
    return verificationHistory;
  }, [verificationHistory, isStudent, visibleCredentials]);

  const externalOffline =
    !config.externalVerificationOnline || config.partnerWithdrawn;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const attempt = verifyCredential(lookupId);
    setLastResult(attempt);
  };

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const created = issueCredential(issueForm);
    if (created) {
      setLookupId(created.certificateId);
    }
    setShowIssueModal(false);
  };

  return (
    <div>
      <PageHeader
        title={
          isStudent
            ? 'My Degree Credentials'
            : 'Credential Management & Verification'
        }
        subtitle="Degree certificate issuance, registry verification, and resilient offline fallback handling"
        badge={
          externalOffline
            ? 'External Partner Offline — Local Preserved'
            : 'Local Registry Active'
        }
        actions={
          canIssue ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => togglePartnerWithdrawn(!config.partnerWithdrawn)}
              >
                {config.partnerWithdrawn
                  ? 'Restore Partner Verification'
                  : 'Simulate External Unavailable'}
              </Button>
              <Button variant="primary" onClick={() => setShowIssueModal(true)}>
                Issue Sample Credential
              </Button>
            </div>
          ) : undefined
        }
      />

      <NoticeBox
        title="Credential Architecture & Blockchain Non-Claim Disclosure"
        tone="neutral"
        className="mb-6"
      >
        Verification checks are executed against the university’s local signed registry
        simulation and mock partner federation status.{' '}
        <strong>No live Blockchain network is claimed or integrated</strong>; distributed
        ledger anchoring is documented strictly as a proposed future extension. When external
        services or partner nodes are unavailable, all local credential records remain
        preserved and verification safely returns <em>Verification Unavailable</em> with
        retry capability.
      </NoticeBox>

      {/* Verification Service Health + Quick Counters */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="External Verification Service"
          value={externalOffline ? 'Unavailable' : 'Online'}
          sublabel={
            config.partnerWithdrawn
              ? 'Partner institution withdrawn (Task 6)'
              : 'Simulated partner federation active'
          }
          accent={externalOffline ? 'warning' : 'mint'}
        />
        <StatCard
          label="Local Credential Records"
          value={isStudent ? visibleCredentials.length : credentials.length}
          sublabel="Preserved locally regardless of partner uptime"
          accent="mint"
        />
        <StatCard
          label="Valid Credentials"
          value={
            (isStudent ? visibleCredentials : credentials).filter(
              (c) => c.status === 'Valid'
            ).length
          }
          sublabel="Active unrevoked certificates"
        />
        <StatCard
          label="Verification Checks Logged"
          value={visibleHistory.length}
          sublabel={`${
            visibleHistory.filter((v) => v.retryEligible).length
          } queued for safe retry`}
        />
      </div>

      {/* Verify Credential Lookup Widget */}
      <SectionCard
        title="Verify Degree Credential"
        subtitle="Test valid, revoked/invalid, and external-unavailable verification outcomes"
        className="mb-6"
      >
        <form onSubmit={handleVerify} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Enter Certificate ID (e.g., CERT-KU-2026-0912)"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2 font-mono text-xs text-gray-900 focus:border-[#0f9d76] focus:outline-none"
          />
          <Button type="submit" variant="primary">
            Verify Credential
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <span>Sample IDs:</span>
          {[
            { id: 'CERT-KU-2026-0912', label: 'CERT-KU-2026-0912 (Partner-Linked Valid)' },
            { id: 'CERT-KU-2026-0918', label: 'CERT-KU-2026-0918 (Local-Only Valid)' },
            { id: 'CERT-KU-2025-REV04', label: 'CERT-KU-2025-REV04 (Revoked Invalid)' },
            { id: 'CERT-UNKNOWN-999', label: 'CERT-UNKNOWN-999 (Unlisted)' },
          ].map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => setLookupId(sample.id)}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[11px] text-gray-700 hover:bg-gray-100"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {lastResult && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-gray-900">
                  {lastResult.certificateId}
                </span>
                <StatusBadge
                  label={lastResult.outcome}
                  tone={
                    lastResult.outcome === 'Valid'
                      ? 'mint'
                      : lastResult.outcome === 'Invalid'
                      ? 'danger'
                      : 'warning'
                  }
                />
              </div>
              <span className="font-mono text-[11px] text-gray-500">
                Service: {lastResult.externalServiceState}
              </span>
            </div>
            <p className="mt-2 text-gray-700">{lastResult.note}</p>
            {lastResult.retryEligible && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const retried = retryVerificationAttempt(lastResult.id);
                    if (retried) setLastResult(retried);
                  }}
                >
                  Safe Retry Verification
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Issued Credentials Registry */}
      <SectionCard
        title={
          isStudent
            ? 'My Issued Credentials'
            : 'University Local Credential Registry (Preserved)'
        }
        subtitle="Signed local degree records preserved intact regardless of external federation status"
        className="mb-6"
        noPadding
      >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">Certificate ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Degree Information</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Local Digest</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {visibleCredentials.map((c) => (
                  <tr key={c.certificateId}>
                    <td className="px-5 py-3.5 font-mono font-semibold text-gray-900">
                      {c.certificateId}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-900">{c.studentName}</div>
                      <div className="font-mono text-[11px] text-gray-500">
                        {c.studentId}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      <div>{c.degreeProgram}</div>
                      <div className="text-[11px] text-gray-500">
                        {c.classification} · CGPA {c.cgpa.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-700">{c.issueDate}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-gray-500">
                      {c.localIntegrityHash}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={c.status}
                        tone={
                          c.status === 'Valid'
                            ? 'mint'
                            : c.status === 'Invalid'
                            ? 'danger'
                            : 'warning'
                        }
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setLookupId(c.certificateId);
                          setLastResult(verifyCredential(c.certificateId));
                        }}
                      >
                        Verify
                      </Button>
                    </td>
                  </tr>
                ))}
                {visibleCredentials.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-gray-500">
                      No degree credentials have been issued for this student account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

      {/* Verification History */}
      <SectionCard
        title="Credential Verification History"
        subtitle="Audit log of verification attempts with safe retry for unavailable external lookups"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Attempt ID</th>
                <th className="px-4 py-3">Certificate ID</th>
                <th className="px-4 py-3">Queried By</th>
                <th className="px-4 py-3">External Service</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-5 py-3 text-right">Retry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {visibleHistory.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-3 font-mono text-gray-600">{v.id}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                    {v.certificateId}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{v.queriedBy}</td>
                  <td className="px-4 py-3 text-gray-600">{v.externalServiceState}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={v.outcome}
                      tone={
                        v.outcome === 'Valid'
                          ? 'mint'
                          : v.outcome === 'Invalid'
                          ? 'danger'
                          : 'warning'
                      }
                    />
                    <div className="mt-0.5 text-[11px] text-gray-500">{v.note}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                    {v.timestamp}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {v.retryEligible ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const r = retryVerificationAttempt(v.id);
                          if (r) setLastResult(r);
                        }}
                      >
                        Safe Retry
                      </Button>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Issue Sample Credential Modal */}
      <Modal
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Issue Sample Degree Credential"
        subtitle="Generates a signed local credential record in the university registry"
      >
        <form onSubmit={handleIssue} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-gray-700">Student</label>
            <select
              value={issueForm.studentId}
              onChange={(e) =>
                setIssueForm({ ...issueForm, studentId: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              {students.map((st) => (
                <option key={st.studentId} value={st.studentId}>
                  {st.studentId} · {st.name} ({st.program})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Degree Program
            </label>
            <input
              required
              value={issueForm.degreeProgram}
              onChange={(e) =>
                setIssueForm({ ...issueForm, degreeProgram: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Classification
            </label>
            <select
              value={issueForm.classification}
              onChange={(e) =>
                setIssueForm({ ...issueForm, classification: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <option value="First Class with Distinction">
                First Class with Distinction
              </option>
              <option value="First Class">First Class</option>
              <option value="Second Class">Second Class</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={issueForm.partnerRegistryRequired}
              onChange={(e) =>
                setIssueForm({
                  ...issueForm,
                  partnerRegistryRequired: e.target.checked,
                })
              }
              className="rounded border-gray-300 accent-[#0f9d76]"
            />
            Require external partner federation check when verifying externally
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowIssueModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Issue Credential
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
