import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { Student } from '../../types/erp';
import {
  Button,
  Drawer,
  Modal,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../ui/Primitives';

export const StudentManagementView: React.FC = () => {
  const {
    students,
    credentials,
    activeRole,
    addStudent,
    switchRole,
    recordDisputedCorrection,
  } = useErp();

  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [standingFilter, setStandingFilter] = useState('All');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newForm, setNewForm] = useState({
    studentId: '',
    name: '',
    email: '',
    department: 'Computer Science & Eng.',
    program: 'B.Tech CSE',
    semester: 5,
    cgpa: 8.2,
    advisor: 'Prof. Arvind Menon',
  });

  const [correctionReason, setCorrectionReason] = useState('');
  const [correctedStandingNote, setCorrectedStandingNote] = useState('');

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(students.map((s) => s.department)))],
    [students]
  );

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        s.studentId.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.program.toLowerCase().includes(q);
      const matchDept = deptFilter === 'All' || s.department === deptFilter;
      const matchStanding = standingFilter === 'All' || s.standing === standingFilter;
      return matchQuery && matchDept && matchStanding;
    });
  }, [students, query, deptFilter, standingFilter]);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.studentId.trim() || !newForm.name.trim()) return;
    addStudent({
      studentId: newForm.studentId.trim().toUpperCase(),
      name: newForm.name.trim(),
      email: newForm.email.trim() || `${newForm.studentId.toLowerCase()}@kaveri.edu.in`,
      department: newForm.department,
      program: newForm.program,
      semester: Number(newForm.semester),
      cgpa: Number(newForm.cgpa),
      advisor: newForm.advisor,
      standing: 'Active',
    });
    setShowAddModal(false);
    setNewForm({
      studentId: '',
      name: '',
      email: '',
      department: 'Computer Science & Eng.',
      program: 'B.Tech CSE',
      semester: 5,
      cgpa: 8.2,
      advisor: 'Prof. Arvind Menon',
    });
  };

  const currentSelected = selectedStudent
    ? students.find((s) => s.studentId === selectedStudent.studentId) ?? selectedStudent
    : null;

  return (
    <div>
      <PageHeader
        title="Student Management"
        subtitle="University student enrollment registry, exam registrations, and record standing"
        actions={
          activeRole === 'admin' ? (
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              Register Student
            </Button>
          ) : undefined
        }
      />

      <SectionCard noPadding>
        {/* Filter bar */}
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student ID, name, or program..."
              className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-[#0f9d76] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-[#0f9d76] focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Departments' : d}
                </option>
              ))}
            </select>

            <select
              value={standingFilter}
              onChange={(e) => setStandingFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-[#0f9d76] focus:outline-none"
            >
              <option value="All">All Standings</option>
              <option value="Active">Active</option>
              <option value="Disputed Record">Disputed Record</option>
              <option value="Graduating">Graduating</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Student ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department / Program</th>
                <th className="px-4 py-3">Sem</th>
                <th className="px-4 py-3">CGPA</th>
                <th className="px-4 py-3">Standing</th>
                <th className="px-4 py-3">Credential</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((student) => {
                const cred = credentials.find((c) => c.studentId === student.studentId);
                return (
                  <tr key={student.studentId} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3.5 font-mono font-medium text-gray-900">
                      {student.studentId}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-[11px] text-gray-500">{student.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      <div>{student.program}</div>
                      <div className="text-[11px] text-gray-500">{student.department}</div>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-gray-700">
                      Sem {student.semester}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium tabular-nums text-gray-900">
                      {student.cgpa.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        label={student.standing}
                        tone={
                          student.standing === 'Disputed Record'
                            ? 'warning'
                            : student.standing === 'Graduating'
                            ? 'mint'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      {cred ? (
                        <StatusBadge
                          label={cred.status}
                          tone={
                            cred.status === 'Valid'
                              ? 'mint'
                              : cred.status === 'Invalid'
                              ? 'danger'
                              : 'warning'
                          }
                        />
                      ) : (
                        <span className="text-[11px] text-gray-400">Not Issued</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedStudent(student)}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-xs text-gray-500">
                    No student records match the active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Student Inspector Drawer */}
      <Drawer
        open={Boolean(currentSelected)}
        onClose={() => {
          setSelectedStudent(null);
          setCorrectionReason('');
          setCorrectedStandingNote('');
        }}
        title={currentSelected ? `${currentSelected.name} (${currentSelected.studentId})` : ''}
        subtitle={
          currentSelected
            ? `${currentSelected.program} · ${currentSelected.department}`
            : ''
        }
      >
        {currentSelected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
              <div>
                <div className="text-gray-500">Email</div>
                <div className="mt-0.5 font-medium text-gray-900">
                  {currentSelected.email}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Faculty Advisor</div>
                <div className="mt-0.5 font-medium text-gray-900">
                  {currentSelected.advisor}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Current Semester & CGPA</div>
                <div className="mt-0.5 font-mono font-semibold text-gray-900">
                  Sem {currentSelected.semester} · CGPA {currentSelected.cgpa.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Record Standing</div>
                <div className="mt-1">
                  <StatusBadge
                    label={currentSelected.standing}
                    tone={
                      currentSelected.standing === 'Disputed Record'
                        ? 'warning'
                        : 'mint'
                    }
                  />
                </div>
              </div>
            </div>

            {activeRole === 'admin' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-4 py-3">
                <div className="text-xs text-gray-600">
                  Demonstrate strict student-only data isolation in Student Dashboard:
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => switchRole('student', currentSelected.studentId)}
                >
                  Open Student Portal as {currentSelected.studentId}
                </Button>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Examination Results Summary
              </h4>
              {currentSelected.results.length === 0 ? (
                <p className="rounded-lg border border-gray-200 p-4 text-xs text-gray-500">
                  No subject result entries published for this student yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Grade</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {currentSelected.results.map((r) => (
                        <tr key={r.subjectCode}>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {r.subjectCode} · {r.subjectName}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {r.published && r.totalMarks !== null
                              ? `${r.totalMarks}/100`
                              : 'Pending'}
                          </td>
                          <td className="px-3 py-2 font-semibold">{r.grade ?? '—'}</td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              label={r.published ? 'Published' : 'Withheld'}
                              tone={r.published ? 'mint' : 'neutral'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {currentSelected.standing === 'Disputed Record' && activeRole === 'admin' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                <div className="text-xs font-semibold text-gray-900">
                  Append Non-Destructive Record Correction
                </div>
                <p className="text-xs text-gray-600">
                  Correct disputed student record without silently overwriting original
                  audit history.
                </p>
                <input
                  type="text"
                  value={correctedStandingNote}
                  onChange={(e) => setCorrectedStandingNote(e.target.value)}
                  placeholder="Updated verified record state (e.g., CS304 internal verified 34/40)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                />
                <textarea
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Mandatory formal reason & ticket reference..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!correctionReason.trim() || !correctedStandingNote.trim()}
                  onClick={() => {
                    recordDisputedCorrection({
                      recordId: currentSelected.studentId,
                      recordType: 'StudentRecord',
                      previousValue: `Standing: Disputed Record`,
                      updatedValue: `Standing: Active (${correctedStandingNote.trim()})`,
                      reason: correctionReason.trim(),
                      markStudentStandingActive: currentSelected.studentId,
                    });
                    setCorrectionReason('');
                    setCorrectedStandingNote('');
                  }}
                >
                  Append Correction to Audit Trail
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Register Student Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register University Student"
        subtitle="Creates a student profile and appends an enrollment audit record"
      >
        <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-gray-700">Student ID</label>
              <input
                required
                value={newForm.studentId}
                onChange={(e) => setNewForm({ ...newForm, studentId: e.target.value })}
                placeholder="STU-2026-115"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Full Name</label>
              <input
                required
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="Lakshmi Narayan"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Department</label>
              <input
                value={newForm.department}
                onChange={(e) => setNewForm({ ...newForm, department: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Program</label>
              <input
                value={newForm.program}
                onChange={(e) => setNewForm({ ...newForm, program: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Semester</label>
              <input
                type="number"
                min={1}
                max={8}
                value={newForm.semester}
                onChange={(e) =>
                  setNewForm({ ...newForm, semester: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">Current CGPA</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={10}
                value={newForm.cgpa}
                onChange={(e) =>
                  setNewForm({ ...newForm, cgpa: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Register Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
