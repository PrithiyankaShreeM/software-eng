import React from 'react';
import { DEMO_ACCOUNTS } from '../../data/mockData';
import { ROLE_ALLOWED_SECTIONS, useErp } from '../../context/ErpContext';
import {
  Button,
  NoticeBox,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../ui/Primitives';

export const SystemSettingsView: React.FC = () => {
  const {
    config,
    toggleReducedResourceMode,
    togglePartnerWithdrawn,
    activateCs304DualModeration,
    updateSystemConfig,
    resetDemoData,
    switchRole,
  } = useErp();

  return (
    <div>
      <PageHeader
        title="System Settings & Governance Policy"
        subtitle="Configure operating modes, moderation variance rules, RBAC demonstration matrix, and data reset"
        actions={
          <Button variant="danger" onClick={resetDemoData}>
            Reset Demonstration Data
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Operating Mode & Safeguards */}
        <SectionCard
          title="Evaluation & Operating Mode Controls"
          subtitle="Adjust institutional policy thresholds and resource operating parameters"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3.5">
              <div>
                <div className="font-semibold text-gray-900">
                  Reduced-Resource Operating Mode (50% Budget)
                </div>
                <div className="mt-0.5 text-gray-500">
                  Disables automatic keyword highlighting & continuous telemetry to halve
                  compute load.
                </div>
              </div>
              <Button
                size="sm"
                variant={config.reducedResourceMode ? 'primary' : 'secondary'}
                onClick={() => toggleReducedResourceMode(!config.reducedResourceMode)}
              >
                {config.reducedResourceMode ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3.5">
              <div>
                <div className="font-semibold text-gray-900">
                  External Partner Verification Node
                </div>
                <div className="mt-0.5 text-gray-500">
                  Simulate partner withdrawal / offline endpoint while preserving local
                  credentials.
                </div>
              </div>
              <Button
                size="sm"
                variant={config.partnerWithdrawn ? 'danger' : 'secondary'}
                onClick={() => togglePartnerWithdrawn(!config.partnerWithdrawn)}
              >
                {config.partnerWithdrawn ? 'Offline (Withdrawn)' : 'Online (Simulated)'}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3.5">
              <div>
                <div className="font-semibold text-gray-900">
                  CS304 Mandatory Dual Moderation
                </div>
                <div className="mt-0.5 text-gray-500">
                  Flags all CS304 evaluations for mandatory moderation verification.
                </div>
              </div>
              <Button
                size="sm"
                variant={config.cs304DualModerationActive ? 'primary' : 'secondary'}
                onClick={() =>
                  activateCs304DualModeration(!config.cs304DualModerationActive)
                }
              >
                {config.cs304DualModerationActive ? 'Active' : 'Standard'}
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">
                  Auto-Moderation Variance Threshold (%)
                </span>
                <span className="font-mono font-semibold text-[#065f46]">
                  {config.moderationVarianceThresholdPct}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={40}
                step={5}
                value={config.moderationVarianceThresholdPct}
                onChange={(e) =>
                  updateSystemConfig({
                    moderationVarianceThresholdPct: Number(e.target.value),
                  })
                }
                className="mt-2 w-full accent-[#0f9d76]"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Mark differences exceeding this percentage of max marks automatically route
                to Moderation.
              </p>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-gray-200 p-3.5">
              <div>
                <div className="font-semibold text-gray-900">
                  Enforce Mandatory Override Justification
                </div>
                <div className="mt-0.5 text-gray-500">
                  Blocks saving an evaluation when final marks differ from rule suggestion
                  without a reason.
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.requireOverrideReason}
                onChange={(e) =>
                  updateSystemConfig({ requireOverrideReason: e.target.checked })
                }
                className="h-4 w-4 accent-[#0f9d76]"
              />
            </label>
          </div>
        </SectionCard>

        {/* System Transparency & Non-Claims Declaration */}
        <SectionCard
          title="Responsible System Transparency Declaration"
          subtitle="Explicit boundaries separating implemented features from simulated or proposed extensions"
        >
          <div className="space-y-3 text-xs text-gray-700">
            <NoticeBox title="1. Deterministic Rubric Assistance (Not Trained AI/ML)" tone="mint">
              Suggested marks and moderation priority indices rely strictly on transparent
              keyword rules and deterministic arithmetic formulas. No machine learning or
              neural grading model is trained or claimed.
            </NoticeBox>
            <NoticeBox title="2. Local Signed Registry Simulation (Not Live Blockchain)" tone="neutral">
              Degree credential hashes and verification checks run against simulated local
              registry state in the browser. Distributed ledger / Blockchain anchoring is a
              proposed extension only.
            </NoticeBox>
            <NoticeBox title="3. Demonstration Accounts & Local Persistence" tone="neutral">
              Role-based access control uses demonstration personas persisted locally via
              browser storage for Assignment 5 evaluation without external production SSO or
              institutional database integration.
            </NoticeBox>
          </div>
        </SectionCard>
      </div>

      {/* Role-Based Access Control Matrix */}
      <SectionCard
        title="Role-Based Access Control (RBAC) Demonstration Accounts"
        subtitle="Click any role below to switch into that demonstration account and verify strict section/action scoping"
        className="mt-6"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Account ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Demonstration User</th>
                <th className="px-4 py-3">Permitted Dashboard Sections</th>
                <th className="px-5 py-3 text-right">Switch View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {DEMO_ACCOUNTS.map((acc) => (
                <tr key={acc.role}>
                  <td className="px-5 py-3 font-mono font-semibold text-gray-900">
                    {acc.id}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={acc.roleLabel} tone="mint" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{acc.name}</div>
                    <div className="text-[11px] text-gray-500">{acc.designation}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                    {ROLE_ALLOWED_SECTIONS[acc.role].join(', ')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => switchRole(acc.role, acc.studentId)}
                    >
                      Switch to {acc.roleLabel}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
