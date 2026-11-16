import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { DEMO_ACCOUNTS } from '../../data/mockData';
import { NavItemConfig, useErp } from '../../context/ErpContext';
import { RoleId } from '../../types/erp';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeRole,
    activeAccount,
    activeStudentId,
    activeSection,
    visibleNavItems,
    students,
    config,
    toasts,
    dismissToast,
    setActiveSection,
    switchRole,
    setActiveStudentId,
  } = useErp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const groups: NavItemConfig['group'][] = [
    'Operations',
    'Evaluation & Governance',
    'Credentials & Audit',
    'System',
  ];

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-[#f6f7f8] text-gray-800">
      <div>
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0f9d76]" />
                <span className="text-sm font-semibold tracking-tight text-gray-900">
                  Kaveri University
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                Examination & Credential Registry
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-200 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="space-y-5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {groups.map((group) => {
            const items = visibleNavItems.filter((item) => item.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {group}
                </div>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`group flex w-full items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-2 text-left text-[13px] transition-colors ${
                            isActive
                              ? 'border-l-[#0f9d76] bg-[#ecf9f4] font-semibold text-[#065f46]'
                              : 'border-l-transparent font-medium text-gray-700 hover:bg-gray-200/60 hover:text-gray-900'
                          }`}
                        >
                          <span
                            className={`font-mono text-[11px] ${
                              isActive ? 'text-[#0f9d76]' : 'text-gray-400'
                            }`}
                          >
                            {item.code}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-200 bg-[#f0f2f4] px-4 py-3.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Active Demonstration Account
        </div>
        <div className="mt-1 text-xs font-semibold text-gray-900">{activeAccount.name}</div>
        <div className="text-[11px] text-gray-600">
          <span className="font-mono">{activeAccount.id}</span> · {activeAccount.roleLabel}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-gray-500">
          {activeAccount.designation}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-white text-gray-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-gray-900/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-gray-200 bg-[#f6f7f8]">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-700 hover:bg-gray-100 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="hidden sm:flex sm:items-center sm:gap-2">
                <span className="text-xs font-medium text-gray-500">Session:</span>
                <span className="text-xs font-semibold text-gray-800">
                  {config.academicSession}
                </span>
                <span className="mx-1 text-gray-300">|</span>
                <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  Simulated Demo Data
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {config.reducedResourceMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeRole === 'admin' || activeRole === 'moderator') {
                      setActiveSection('redesign');
                    }
                  }}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900"
                >
                  50% Compute Mode Active
                </button>
              )}
              {config.partnerWithdrawn && (
                <span className="rounded-md border border-gray-300 bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-800">
                  Partner Registry Offline (Local Preserved)
                </span>
              )}

              {/* Role Switcher */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1">
                <label
                  htmlFor="role-switcher"
                  className="text-[11px] font-medium text-gray-500"
                >
                  Role
                </label>
                <select
                  id="role-switcher"
                  value={activeRole}
                  onChange={(e) => switchRole(e.target.value as RoleId)}
                  className="bg-transparent text-xs font-semibold text-gray-900 focus:outline-none"
                >
                  {DEMO_ACCOUNTS.map((acc) => (
                    <option key={acc.role} value={acc.role}>
                      {acc.roleLabel} ({acc.id})
                    </option>
                  ))}
                </select>
              </div>

              {activeRole === 'student' && (
                <div className="flex items-center gap-2 rounded-lg border border-[#a7e3ce] bg-[#ecf9f4] px-2.5 py-1">
                  <label
                    htmlFor="student-account-switcher"
                    className="text-[11px] font-medium text-[#065f46]"
                  >
                    Student
                  </label>
                  <select
                    id="student-account-switcher"
                    value={activeStudentId}
                    onChange={(e) => setActiveStudentId(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-[#065f46] focus:outline-none"
                  >
                    {students.map((st) => (
                      <option key={st.studentId} value={st.studentId}>
                        {st.studentId} · {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-start justify-between gap-3 rounded-xl border bg-white p-3.5 shadow-lg ${
                toast.tone === 'mint'
                  ? 'border-[#a7e3ce] border-l-4 border-l-[#0f9d76]'
                  : toast.tone === 'warning'
                  ? 'border-amber-200 border-l-4 border-l-amber-600'
                  : 'border-gray-200 border-l-4 border-l-gray-500'
              }`}
            >
              <div>
                <div className="text-xs font-semibold text-gray-900">{toast.title}</div>
                {toast.detail && (
                  <div className="mt-0.5 text-[11px] text-gray-600">{toast.detail}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-gray-400 hover:text-gray-700"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
