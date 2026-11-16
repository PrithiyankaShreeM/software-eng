import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { INITIAL_RUBRICS } from '../data/mockData';
import {
  calculateModerationPriority,
  evaluateAnswerWithRubric,
} from '../utils/rubricEngine';

describe('Deterministic Rubric & Moderation Engine', () => {
  it('computes deterministic suggested marks and matched/missing concepts', () => {
    const cs301 = INITIAL_RUBRICS.find((r) => r.rubricId === 'RUB-CS301-Q4B');
    const result = evaluateAnswerWithRubric(
      'Mutual exclusion and circular wait occur unless resource ordering with numbering is applied. Banker algorithm uses safe state.',
      cs301
    );
    expect(result.matchedConcepts.length).toBe(3);
    expect(result.missingConcepts).toContain('Starvation & Overhead Trade-off');
    expect(result.suggestedMarks).toBeGreaterThan(0);
    expect(result.suggestedMarks).toBeLessThanOrEqual(15);
  });

  it('computes deterministic moderation priority with non-AI factors', () => {
    const breakdown = calculateModerationPriority({
      suggestedMarks: 15,
      finalMarks: 8,
      maxMarks: 15,
      subjectCode: 'CS304',
      examinerId: 'EXM-112',
      cs304DualModerationActive: true,
      missingConceptCount: 0,
      totalConceptCount: 4,
    });
    expect(breakdown.score).toBeGreaterThanOrEqual(65);
    expect(breakdown.level).toBe('High');
    expect(breakdown.factors.length).toBeGreaterThan(1);
  });
});

describe('Responsible Examination & Credential Dashboard Workflows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 8 Overview KPI cards and 12+ sidebar items for Administrator', () => {
    render(<App />);
    expect(screen.getByText('Examination & Credential Operations Overview')).toBeInTheDocument();
    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('Examinations Conducted')).toBeInTheDocument();
    expect(screen.getByText('Answer Scripts Submitted')).toBeInTheDocument();
    expect(screen.getByText('Pending Evaluations')).toBeInTheDocument();
    expect(screen.getByText('Pending Moderation')).toBeInTheDocument();
    expect(screen.getByText('Results Awaiting Approval')).toBeInTheDocument();
    expect(screen.getAllByText('Revaluation Requests').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Credentials Issued')).toBeInTheDocument();

    const nav = screen.getByLabelText('Main navigation');
    expect(within(nav).getByText('Answer Script Evaluation')).toBeInTheDocument();
    expect(within(nav).getByText('Redesign Scenario (Task 6)')).toBeInTheDocument();
    expect(within(nav).getByText('System Settings')).toBeInTheDocument();
  });

  it('enforces mandatory override reason on Answer Script Evaluation and logs audit entry', () => {
    render(<App />);
    const nav = screen.getByLabelText('Main navigation');
    fireEvent.click(within(nav).getByText('Answer Script Evaluation'));

    expect(
      screen.getByText(/Rule-Based Assistance Only — Not Guaranteed Correct Marks/i)
    ).toBeInTheDocument();

    const marksInput = screen.getByLabelText(/Examiner’s Final Marks/i);
    fireEvent.change(marksInput, { target: { value: '6' } });

    const saveBtn = screen.getByRole('button', { name: 'Save Evaluation' });
    fireEvent.click(saveBtn);

    // Override reason field is required
    const reasonInput = screen.getByLabelText(
      /Mandatory Reason for Overriding Rule-Based Marks/i
    );
    expect(reasonInput).toBeRequired();

    // Provide justification and save
    fireEvent.change(reasonInput, {
      target: { value: 'Missed Banker algorithm need matrix derivation.' },
    });
    fireEvent.click(saveBtn);

    // Verify audit log recorded it
    fireEvent.click(within(nav).getByText('Audit Logs'));
    expect(
      screen.getByText(/Missed Banker algorithm need matrix derivation\./i)
    ).toBeInTheDocument();
  });

  it('enforces Role-Based Access Control across Student and Moderator roles and excludes removed roles', () => {
    render(<App />);
    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    const optionValues = Array.from(roleSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(['admin', 'examiner', 'moderator', 'student']);

    // Switch to Student
    fireEvent.change(roleSelect, { target: { value: 'student' } });
    expect(
      screen.getByRole('heading', { name: 'Student Dashboard' })
    ).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getAllByText(/STU-2026-104/).length).toBeGreaterThan(0);
    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Approval')).not.toBeInTheDocument();
    // Ensure another student's data isn't exposed inside the Student Portal workspace
    expect(within(main).queryByText('Karthik Subramanian')).not.toBeInTheDocument();
    // Verify exam schedules and durations are visible to the student
    expect(
      within(main).getByText('My Examination Schedule & Durations')
    ).toBeInTheDocument();
    expect(within(main).getAllByText('180 mins (3 hrs)').length).toBeGreaterThan(0);
    expect(within(main).getAllByText('09:30 AM – 12:30 PM').length).toBeGreaterThan(0);

    // Switch student account to Arjun Verma (MA204: 150 mins)
    const studentSelect = screen.getByLabelText('Student');
    fireEvent.change(studentSelect, { target: { value: 'STU-2026-113' } });
    expect(
      within(main).getByText('150 mins (2 hrs 30 mins)')
    ).toBeInTheDocument();

    // Switch to Moderator
    fireEvent.change(roleSelect, { target: { value: 'moderator' } });
    const nav = screen.getByLabelText('Main navigation');
    expect(within(nav).getByText('Moderation & Anomaly Detection')).toBeInTheDocument();
    expect(within(nav).queryByText('Mark Approval')).not.toBeInTheDocument();
    expect(within(nav).queryByText('System Settings')).not.toBeInTheDocument();
  });

  it('demonstrates Task 6 Partner Withdrawal, 50% Compute Mode, and Non-Destructive Correction', () => {
    render(<App />);
    const nav = screen.getByLabelText('Main navigation');
    fireEvent.click(within(nav).getByText('Redesign Scenario (Task 6)'));

    expect(
      screen.getByText('Redesign Scenario — Assignment Task 6')
    ).toBeInTheDocument();

    // Enable 50% Reduced-Resource Mode
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable 50% Reduced-Resource Mode' })
    );
    expect(screen.getByText('50% Compute Mode Active')).toBeInTheDocument();

    // Simulate Partner Withdrawal & check Verification Unavailable + Safe Retry
    fireEvent.click(
      screen.getByRole('button', { name: 'Simulate Partner Withdrawal' })
    );
    fireEvent.click(within(nav).getByText('Credential Management'));
    expect(
      screen.getByText('External Partner Offline — Local Preserved')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verify Credential' }));
    expect(screen.getAllByText('Verification Unavailable').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /Safe Retry/i }).length
    ).toBeGreaterThan(0);

    // Go back to Task 6 and execute non-destructive correction
    fireEvent.click(within(nav).getByText('Redesign Scenario (Task 6)'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Append Non-Destructive Correction' })
    );
    fireEvent.click(within(nav).getByText('Audit Logs'));
    expect(
      screen.getAllByText(/Record Correction \(Non-Destructive\)/i).length
    ).toBeGreaterThan(0);
  });

  it('navigates through every Administrator section cleanly without crashing', () => {
    render(<App />);
    const nav = screen.getByLabelText('Main navigation');
    const labels = [
      'Overview',
      'Student Management',
      'Examination Management',
      'Answer Script Evaluation',
      'Rubric-Based Assessment',
      'Moderation & Anomaly Detection',
      'Mark Approval',
      'Revaluation Requests',
      'Credential Management',
      'Audit Logs',
      'Reports & Analytics',
      'Redesign Scenario (Task 6)',
      'System Settings',
    ];

    for (const label of labels) {
      fireEvent.click(within(nav).getByText(label));
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    }
  });

  it('blocks approval of flagged scripts until moderation resolves, then approves and publishes', () => {
    render(<App />);
    const nav = screen.getByLabelText('Main navigation');

    // In Mark Approval, SCR-2026-8803 is Flagged so Approve button should be disabled
    fireEvent.click(within(nav).getByText('Mark Approval'));
    const row8803 = screen.getByText('SCR-2026-8803').closest('tr')!;
    const approveBtnBlocked = within(row8803).getByRole('button', { name: 'Approve' });
    expect(approveBtnBlocked).toBeDisabled();

    // Switch to Moderation and resolve SCR-2026-8803
    fireEvent.click(within(nav).getByText('Moderation & Anomaly Detection'));
    const modRow8803 = screen.getByText('SCR-2026-8803').closest('tr')!;
    fireEvent.click(within(modRow8803).getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resolve Discrepancy' }));

    // Now return to Mark Approval and approve + publish SCR-2026-8803
    fireEvent.click(within(nav).getByText('Mark Approval'));
    const updatedRow8803 = screen.getByText('SCR-2026-8803').closest('tr')!;
    const approveBtnReady = within(updatedRow8803).getByRole('button', {
      name: 'Approve',
    });
    expect(approveBtnReady).not.toBeDisabled();
    fireEvent.click(approveBtnReady);
    fireEvent.click(within(updatedRow8803).getByRole('button', { name: 'Publish Result' }));
    expect(within(updatedRow8803).getByText('Published')).toBeInTheDocument();
  });

  it('verifies navigation scoping across all 4 active roles', () => {
    render(<App />);
    const roleSelect = screen.getByLabelText('Role');

    const expectedByRole: Record<string, string[]> = {
      admin: ['Overview', 'Mark Approval', 'Credential Management', 'System Settings'],
      examiner: ['Overview', 'Examination Management', 'Answer Script Evaluation', 'Rubric-Based Assessment'],
      moderator: ['Overview', 'Moderation & Anomaly Detection', 'Audit Logs'],
      student: ['Student Dashboard', 'My Credentials'],
    };

    for (const [role, expectedItems] of Object.entries(expectedByRole)) {
      fireEvent.change(roleSelect, { target: { value: role } });
      const nav = screen.getByLabelText('Main navigation');
      for (const item of expectedItems) {
        expect(within(nav).getByText(item)).toBeInTheDocument();
      }
      if (role !== 'admin') {
        expect(within(nav).queryByText('System Settings')).not.toBeInTheDocument();
      }
    }
  });

  it('allows Examiner to create Exam Questions and Assignments/Assessments, and Students to submit them for evaluation', () => {
    render(<App />);
    const roleSelect = screen.getByLabelText('Role');

    // Switch to Examiner
    fireEvent.change(roleSelect, { target: { value: 'examiner' } });
    const nav = screen.getByLabelText('Main navigation');
    fireEvent.click(within(nav).getByText('Examination Management'));

    // 1. Examiner creates an exam question
    fireEvent.click(screen.getByRole('button', { name: 'Create Exam Question' }));
    fireEvent.change(screen.getByPlaceholderText('Q5(b)'), {
      target: { value: 'Q6(a)' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Write the complete descriptive or analytical/i),
      { target: { value: 'Compare strict two-phase locking with optimistic concurrency.' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Two-Phase Locking & Serializability/i),
      { target: { value: 'Strict 2PL Conflict Serializability' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(/two-phase locking, serializable, deadlock/i),
      { target: { value: 'strict 2pl, conflict serializable, cascading rollback' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Exam Question' }));

    expect(
      screen.getByText(/Compare strict two-phase locking with optimistic concurrency\./i)
    ).toBeInTheDocument();

    // 2. Examiner creates a published Assignment
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Assignment / Assessment' })
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Assignment 6: Distributed Consensus/i),
      { target: { value: 'Assignment 6: Raft Consensus & Leader Election' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Specify deliverables, concepts to address/i),
      { target: { value: 'Explain Raft quorum, heartbeat timers, and log replication.' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Leader Election & Log Replication/i),
      { target: { value: 'Raft Leader Election' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(/quorum, heartbeat, term, commit/i),
      { target: { value: 'quorum, heartbeat, term' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create Assignment' }));

    expect(
      screen.getByText('Assignment 6: Raft Consensus & Leader Election')
    ).toBeInTheDocument();

    // 3. Student sees the published Assignment in Student Dashboard and submits a response
    fireEvent.change(roleSelect, { target: { value: 'student' } });
    expect(
      screen.getByText('Assignment 6: Raft Consensus & Leader Election')
    ).toBeInTheDocument();

    const asgRow = screen
      .getByText('Assignment 6: Raft Consensus & Leader Election')
      .closest('div')!
      .parentElement!
      .parentElement!;
    fireEvent.click(within(asgRow).getByRole('button', { name: 'Submit Answer' }));
    fireEvent.change(
      screen.getByPlaceholderText(/Write your complete structured solution/i),
      {
        target: {
          value:
            'Raft requires majority quorum during term elections and sends periodic heartbeat messages.',
        },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Evaluation' }));

    // 4. Examiner sees the student's newly submitted Assignment in Answer Script Evaluation
    fireEvent.change(roleSelect, { target: { value: 'examiner' } });
    const examinerNav = screen.getByLabelText('Main navigation');
    fireEvent.click(within(examinerNav).getByText('Answer Script Evaluation'));
    const submittedItemBtn = screen
      .getByText(/STU-2026-104 · CS301 \(ASG-CS301-/i)
      .closest('button')!;
    expect(within(submittedItemBtn).getByText('Assignment')).toBeInTheDocument();
    fireEvent.click(submittedItemBtn);
    expect(screen.getByText('Raft Leader Election')).toBeInTheDocument();
  });
});
