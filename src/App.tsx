import React from 'react';
import { ErpProvider, ROLE_ALLOWED_SECTIONS, useErp } from './context/ErpContext';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/views/OverviewView';
import { StudentManagementView } from './components/views/StudentManagementView';
import { ExamManagementView } from './components/views/ExamManagementView';
import { EvaluationView } from './components/views/EvaluationView';
import { RubricManagementView } from './components/views/RubricManagementView';
import { ModerationView } from './components/views/ModerationView';
import { MarkApprovalView } from './components/views/MarkApprovalView';
import { RevaluationView } from './components/views/RevaluationView';
import { CredentialManagementView } from './components/views/CredentialManagementView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { ReportsAnalyticsView } from './components/views/ReportsAnalyticsView';
import { RedesignTask6View } from './components/views/RedesignTask6View';
import { SystemSettingsView } from './components/views/SystemSettingsView';
import { StudentPortalView } from './components/views/StudentPortalView';

const DashboardContent: React.FC = () => {
  const { activeRole, activeSection } = useErp();

  const allowed = ROLE_ALLOWED_SECTIONS[activeRole];
  const effectiveSection = allowed.includes(activeSection)
    ? activeSection
    : allowed[0];

  switch (effectiveSection) {
    case 'overview':
      return <OverviewView />;
    case 'students':
      return <StudentManagementView />;
    case 'exams':
      return <ExamManagementView />;
    case 'evaluation':
      return <EvaluationView />;
    case 'rubrics':
      return <RubricManagementView />;
    case 'moderation':
      return <ModerationView />;
    case 'approval':
      return <MarkApprovalView />;
    case 'revaluation':
      return <RevaluationView />;
    case 'credentials':
      return <CredentialManagementView />;
    case 'audit':
      return <AuditLogsView />;
    case 'reports':
      return <ReportsAnalyticsView />;
    case 'redesign':
      return <RedesignTask6View />;
    case 'settings':
      return <SystemSettingsView />;
    case 'student-portal':
      return <StudentPortalView />;
    default:
      return <OverviewView />;
  }
};

export function App() {
  return (
    <ErpProvider>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </ErpProvider>
  );
}

export default App;
