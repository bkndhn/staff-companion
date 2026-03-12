import React, { useState, useMemo } from 'react';
import {
  User, Calendar, DollarSign, TrendingUp, Download, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, FileText, Briefcase, MapPin, Phone, Home
} from 'lucide-react';
import { Staff, Attendance, SalaryHike, AdvanceDeduction } from '../types';
import { calculateAttendanceMetrics, calculateSalary, getDaysInMonth, isSunday } from '../utils/salaryCalculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StaffPortalProps {
  staff: Staff;
  attendance: Attendance[];
  salaryHikes: SalaryHike[];
  advances: AdvanceDeduction[];
  allStaff: Staff[];
}

const StaffPortal: React.FC<StaffPortalProps> = ({ staff, attendance, salaryHikes, advances, allStaff }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'attendance' | 'salary' | 'hikes'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' });

  // Attendance metrics for selected month
  const metrics = useMemo(() =>
    calculateAttendanceMetrics(staff.id, attendance, selectedYear, selectedMonth),
    [staff.id, attendance, selectedYear, selectedMonth]
  );

  // Monthly attendance records
  const monthlyAttendance = useMemo(() =>
    attendance.filter(a => {
      const d = new Date(a.date);
      return a.staffId === staff.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear && !a.isPartTime;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [staff.id, attendance, selectedMonth, selectedYear]
  );

  // Salary for selected month
  const salaryDetail = useMemo(() => {
    const adv = advances.find(a => a.staffId === staff.id && a.month === selectedMonth && a.year === selectedYear) || null;
    return calculateSalary(staff, metrics, adv, advances, attendance, selectedMonth, selectedYear);
  }, [staff, metrics, advances, attendance, selectedMonth, selectedYear]);

  // Staff hikes
  const staffHikes = useMemo(() =>
    salaryHikes.filter(h => h.staffId === staff.id).sort((a, b) => new Date(b.hikeDate).getTime() - new Date(a.hikeDate).getTime()),
    [salaryHikes, staff.id]
  );

  const navigateMonth = (dir: number) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const downloadSalarySlip = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Salary Slip', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${monthName} ${selectedYear}`, 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Name: ${staff.name}`, 20, 40);
    doc.text(`Location: ${staff.location}`, 20, 47);
    doc.text(`Joined: ${staff.joinedDate}`, 20, 54);

    const rows = [
      ['Present Days', `${metrics.presentDays}`],
      ['Half Days', `${metrics.halfDays}`],
      ['Leave Days', `${metrics.leaveDays}`],
      ['Sunday Absents', `${metrics.sundayAbsents}`],
      ['Basic Earned', `₹${salaryDetail.basicEarned}`],
      ['Incentive Earned', `₹${salaryDetail.incentiveEarned}`],
      ['HRA Earned', `₹${salaryDetail.hraEarned}`],
      ['Meal Allowance', `₹${salaryDetail.mealAllowance}`],
      ['Sunday Penalty', `₹${salaryDetail.sundayPenalty}`],
      ['Gross Salary', `₹${salaryDetail.grossSalary}`],
      ['Old Advance', `₹${salaryDetail.oldAdv}`],
      ['Current Advance', `₹${salaryDetail.curAdv}`],
      ['Deduction', `₹${salaryDetail.deduction}`],
      ['Net Salary', `₹${salaryDetail.netSalary}`],
    ];

    autoTable(doc, {
      head: [['Component', 'Amount']],
      body: rows,
      startY: 62,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save(`salary-slip-${staff.name}-${monthName}-${selectedYear}.pdf`);
  };

  const sections = [
    { id: 'overview' as const, label: 'Overview', icon: User },
    { id: 'attendance' as const, label: 'Attendance', icon: Calendar },
    { id: 'salary' as const, label: 'Salary', icon: DollarSign },
    { id: 'hikes' as const, label: 'Hikes', icon: TrendingUp },
  ];

  return (
    <div className="p-2 md:p-6 pb-24 md:pb-6 space-y-4">
      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeSection === s.id
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'glass-card-static text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <s.icon size={16} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Month Navigator (for attendance & salary) */}
      {(activeSection === 'attendance' || activeSection === 'salary') && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg glass-card-static hover:bg-[var(--glass-bg-strong)]">
            <ChevronLeft size={20} className="text-[var(--text-primary)]" />
          </button>
          <span className="text-lg font-semibold text-[var(--text-primary)] min-w-[180px] text-center">
            {monthName} {selectedYear}
          </span>
          <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg glass-card-static hover:bg-[var(--glass-bg-strong)]">
            <ChevronRight size={20} className="text-[var(--text-primary)]" />
          </button>
        </div>
      )}

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="glass-card-static p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {staff.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{staff.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">{staff.type === 'full-time' ? 'Full-Time' : 'Part-Time'} Staff</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={MapPin} label="Location" value={staff.location} />
              <InfoRow icon={Briefcase} label="Experience" value={staff.experience} />
              <InfoRow icon={Calendar} label="Joined Date" value={staff.joinedDate} />
              {staff.contactNumber && <InfoRow icon={Phone} label="Contact" value={staff.contactNumber} />}
              {staff.address && <InfoRow icon={Home} label="Address" value={staff.address} />}
            </div>
          </div>

          {/* Salary Breakdown */}
          <div className="glass-card-static p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <DollarSign size={20} /> Current Salary Structure
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SalaryCard label="Basic" amount={staff.basicSalary} />
              <SalaryCard label="Incentive" amount={staff.incentive} />
              <SalaryCard label="HRA" amount={staff.hra} />
              {(staff.mealAllowance || 0) > 0 && <SalaryCard label="Meal Allow." amount={staff.mealAllowance!} />}
              {staff.salarySupplements && Object.entries(staff.salarySupplements).map(([k, v]) => (
                <SalaryCard key={k} label={k} amount={v} />
              ))}
              <SalaryCard label="Total" amount={staff.totalSalary} highlight />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickStat label="This Month Present" value={`${metrics.totalPresentDays}`} icon={CheckCircle} color="text-emerald-500" />
            <QuickStat label="Leaves" value={`${metrics.leaveDays}`} icon={XCircle} color="text-red-500" />
            <QuickStat label="Sunday Absents" value={`${metrics.sundayAbsents}`} icon={Calendar} color="text-amber-500" />
            <QuickStat label="Total Hikes" value={`${staffHikes.length}`} icon={TrendingUp} color="text-blue-500" />
          </div>
        </div>
      )}

      {/* ATTENDANCE */}
      {activeSection === 'attendance' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickStat label="Present" value={`${metrics.presentDays}`} icon={CheckCircle} color="text-emerald-500" />
            <QuickStat label="Half Days" value={`${metrics.halfDays}`} icon={Clock} color="text-amber-500" />
            <QuickStat label="Leaves" value={`${metrics.leaveDays}`} icon={XCircle} color="text-red-500" />
            <QuickStat label="Sun. Absent" value={`${metrics.sundayAbsents}`} icon={Calendar} color="text-orange-500" />
          </div>

          {/* Day-by-day */}
          <div className="glass-card-static rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--glass-border)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Daily Attendance</h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {(() => {
                const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
                const days = [];
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const record = monthlyAttendance.find(a => a.date === dateStr);
                  const isSun = isSunday(dateStr);
                  const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
                  days.push(
                    <div key={d} className={`flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] last:border-0 ${isSun ? 'bg-orange-500/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[var(--text-muted)] w-8">{String(d).padStart(2, '0')}</span>
                        <span className={`text-sm font-medium ${isSun ? 'text-orange-500' : 'text-[var(--text-primary)]'}`}>{dayName}</span>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        record?.status === 'Present' ? 'bg-emerald-500/15 text-emerald-500' :
                        record?.status === 'Half Day' ? 'bg-amber-500/15 text-amber-500' :
                        record?.status === 'Absent' ? 'bg-red-500/15 text-red-500' :
                        'bg-gray-500/10 text-[var(--text-muted)]'
                      }`}>
                        {record?.status || (new Date(dateStr) > new Date() ? '—' : 'Absent')}
                      </span>
                    </div>
                  );
                }
                return days;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SALARY */}
      {activeSection === 'salary' && (
        <div className="space-y-4">
          <div className="glass-card-static p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Salary Details</h3>
              <button onClick={downloadSalarySlip} className="btn-premium flex items-center gap-2 text-sm px-4 py-2">
                <Download size={16} /> Download Slip
              </button>
            </div>

            <div className="space-y-3">
              <SalaryRow label="Present Days" value={`${metrics.presentDays} days`} />
              <SalaryRow label="Half Days" value={`${metrics.halfDays}`} />
              <SalaryRow label="Leave Days" value={`${metrics.leaveDays} days`} />
              <SalaryRow label="Sunday Absents" value={`${metrics.sundayAbsents}`} />
              <div className="border-t border-[var(--glass-border)] my-2" />
              <SalaryRow label="Basic Earned" value={`₹${salaryDetail.basicEarned.toLocaleString()}`} />
              <SalaryRow label="Incentive Earned" value={`₹${salaryDetail.incentiveEarned.toLocaleString()}`} />
              <SalaryRow label="HRA Earned" value={`₹${salaryDetail.hraEarned.toLocaleString()}`} />
              {salaryDetail.mealAllowance > 0 && <SalaryRow label="Meal Allowance" value={`₹${salaryDetail.mealAllowance.toLocaleString()}`} />}
              <SalaryRow label="Sunday Penalty" value={`-₹${salaryDetail.sundayPenalty.toLocaleString()}`} danger />
              <div className="border-t border-[var(--glass-border)] my-2" />
              <SalaryRow label="Gross Salary" value={`₹${salaryDetail.grossSalary.toLocaleString()}`} bold />
              <SalaryRow label="Old Advance" value={`₹${salaryDetail.oldAdv.toLocaleString()}`} />
              <SalaryRow label="Current Advance" value={`₹${salaryDetail.curAdv.toLocaleString()}`} />
              <SalaryRow label="Deduction" value={`₹${salaryDetail.deduction.toLocaleString()}`} />
              <div className="border-t-2 border-[var(--glass-border-strong)] my-2" />
              <SalaryRow label="Net Salary" value={`₹${salaryDetail.netSalary.toLocaleString()}`} bold highlight />
            </div>
          </div>
        </div>
      )}

      {/* HIKES */}
      {activeSection === 'hikes' && (
        <div className="space-y-4">
          <div className="glass-card-static p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <TrendingUp size={20} /> Salary Hike History
            </h3>
            {staffHikes.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] py-8">No salary hikes recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {staffHikes.map((hike) => (
                  <div key={hike.id} className="glass-card-static p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--text-muted)]">{new Date(hike.hikeDate).toLocaleDateString('en-GB')}</span>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-500">
                        +₹{(hike.newSalary - hike.oldSalary).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--text-primary)]">
                      <span className="text-sm">₹{hike.oldSalary.toLocaleString()}</span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span className="text-sm font-bold">₹{hike.newSalary.toLocaleString()}</span>
                    </div>
                    {hike.reason && <p className="text-xs text-[var(--text-muted)] mt-1">{hike.reason}</p>}
                    {hike.breakdown && (
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                        {Object.entries(hike.breakdown)
                          .filter(([k]) => !k.startsWith('old_'))
                          .map(([k, v]) => {
                            const oldKey = `old_${k}`;
                            const oldVal = hike.breakdown?.[oldKey] ?? 0;
                            const diff = v - oldVal;
                            return (
                              <div key={k} className="flex justify-between text-[var(--text-secondary)]">
                                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                                <span className={diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-400' : ''}>
                                  {diff > 0 ? '+' : ''}{diff !== 0 ? `₹${diff.toLocaleString()}` : `₹${v.toLocaleString()}`}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-components
const InfoRow: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-bg)]">
    <Icon size={16} className="text-indigo-400 flex-shrink-0" />
    <div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  </div>
);

const SalaryCard: React.FC<{ label: string; amount: number; highlight?: boolean }> = ({ label, amount, highlight }) => (
  <div className={`p-3 rounded-xl text-center ${highlight ? 'bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30' : 'bg-[var(--glass-bg)]'}`}>
    <p className="text-xs text-[var(--text-muted)]">{label}</p>
    <p className={`text-lg font-bold ${highlight ? 'text-indigo-400' : 'text-[var(--text-primary)]'}`}>₹{amount.toLocaleString()}</p>
  </div>
);

const QuickStat: React.FC<{ label: string; value: string; icon: React.ElementType; color: string }> = ({ label, value, icon: Icon, color }) => (
  <div className="glass-card-static p-4 rounded-xl text-center">
    <Icon size={20} className={`mx-auto mb-1 ${color}`} />
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-[var(--text-muted)]">{label}</p>
  </div>
);

const SalaryRow: React.FC<{ label: string; value: string; bold?: boolean; highlight?: boolean; danger?: boolean }> = ({ label, value, bold, highlight, danger }) => (
  <div className="flex items-center justify-between">
    <span className={`text-sm ${bold ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
    <span className={`text-sm font-mono ${
      highlight ? 'text-lg font-bold text-emerald-500' :
      danger ? 'text-red-400' :
      bold ? 'font-bold text-[var(--text-primary)]' :
      'text-[var(--text-primary)]'
    }`}>{value}</span>
  </div>
);

export default StaffPortal;
