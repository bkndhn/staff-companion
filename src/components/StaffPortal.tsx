import React, { useState, useMemo, useEffect } from 'react';
import {
  User, Calendar, DollarSign, TrendingUp, Download, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, Briefcase, MapPin, Phone, Home, IndianRupee,
  ArrowUpRight, ArrowDownRight, FileText, CreditCard
} from 'lucide-react';
import { Staff, Attendance, SalaryHike, AdvanceDeduction, SalaryOverride } from '../types';
import { calculateAttendanceMetrics, calculateSalary, getDaysInMonth, isSunday, roundToNearest10 } from '../utils/salaryCalculations';
import { salaryOverrideService } from '../services/salaryOverrideService';
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
  const [overrides, setOverrides] = useState<SalaryOverride | null>(null);

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' });

  // Determine if staff has left (inactive) and their last working month
  const isLeftStaff = !staff.isActive;

  // Check if the selected month is in the future relative to current date (or left date for inactive staff)
  const isMonthBlocked = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // For active staff, block future months
    if (!isLeftStaff) {
      return selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth);
    }

    // For left staff, block months after current (they can't see future data)
    return selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth);
  }, [selectedMonth, selectedYear, isLeftStaff]);

  // Check if next month would be in the future
  const isNextMonthFuture = useMemo(() => {
    const now = new Date();
    const nm = selectedMonth + 1 > 11 ? 0 : selectedMonth + 1;
    const ny = selectedMonth + 1 > 11 ? selectedYear + 1 : selectedYear;
    return ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth());
  }, [selectedMonth, selectedYear]);

  // Load salary overrides for the selected month
  useEffect(() => {
    const loadOverrides = async () => {
      try {
        const allOverrides = await salaryOverrideService.getOverrides(selectedMonth + 1, selectedYear);
        const staffOverride = allOverrides.find(o => o.staffId === staff.id) || null;
        setOverrides(staffOverride);
      } catch (err) {
        console.error('Error loading overrides:', err);
      }
    };
    loadOverrides();
  }, [selectedMonth, selectedYear, staff.id]);

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

  // Salary for selected month - with overrides applied
  const salaryDetail = useMemo(() => {
    const adv = advances.find(a => a.staffId === staff.id && a.month === selectedMonth && a.year === selectedYear) || null;
    const baseDetail = calculateSalary(staff, metrics, adv, advances, attendance, selectedMonth, selectedYear);

    // Apply overrides if they exist
    if (overrides) {
      const basic = overrides.basicOverride ?? baseDetail.basicEarned;
      const incentive = overrides.incentiveOverride ?? baseDetail.incentiveEarned;
      const hra = overrides.hraOverride ?? baseDetail.hraEarned;
      const meal = overrides.mealAllowanceOverride ?? baseDetail.mealAllowance;
      const sundayPenalty = overrides.sundayPenaltyOverride ?? baseDetail.sundayPenalty;

      const gross = roundToNearest10(basic + incentive + hra + meal);
      const net = roundToNearest10(gross - baseDetail.deduction - sundayPenalty);

      return {
        ...baseDetail,
        basicEarned: basic,
        incentiveEarned: incentive,
        hraEarned: hra,
        mealAllowance: meal,
        sundayPenalty,
        grossSalary: gross,
        netSalary: Math.max(0, net)
      };
    }

    return baseDetail;
  }, [staff, metrics, advances, attendance, selectedMonth, selectedYear, overrides]);

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

    // Block navigating to future months
    const now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) {
      return; // Don't navigate to future
    }

    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const downloadSalarySlip = () => {
    const doc = new jsPDF();
    const rs = 'Rs.';

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('SALARY SLIP', 105, 18, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${monthName} ${selectedYear}`, 105, 30, { align: 'center' });

    // Employee Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Employee: ${staff.name}`, 20, 52);
    doc.text(`Location: ${staff.location}`, 20, 59);
    doc.text(`Type: ${staff.type === 'full-time' ? 'Full-Time' : 'Part-Time'}`, 120, 52);
    doc.text(`Joined: ${staff.joinedDate}`, 120, 59);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 65, 190, 65);

    // Attendance Summary
    const attendanceRows = [
      ['Present Days', `${metrics.presentDays}`],
      ['Half Days', `${metrics.halfDays}`],
      ['Leave Days', `${metrics.leaveDays}`],
      ['Sunday Absents', `${metrics.sundayAbsents}`],
    ];

    autoTable(doc, {
      head: [['Attendance', 'Days']],
      body: attendanceRows,
      startY: 70,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      theme: 'grid',
      tableWidth: 80,
      margin: { left: 20 },
    });

    // Earnings & Deductions
    const earningsRows = [
      ['Basic Earned', `${rs} ${salaryDetail.basicEarned.toLocaleString('en-IN')}`],
      ['Incentive Earned', `${rs} ${salaryDetail.incentiveEarned.toLocaleString('en-IN')}`],
      ['HRA Earned', `${rs} ${salaryDetail.hraEarned.toLocaleString('en-IN')}`],
    ];
    if (salaryDetail.mealAllowance > 0) {
      earningsRows.push(['Meal Allowance', `${rs} ${salaryDetail.mealAllowance.toLocaleString('en-IN')}`]);
    }
    earningsRows.push(
      ['Gross Salary', `${rs} ${salaryDetail.grossSalary.toLocaleString('en-IN')}`],
    );

    const deductionRows = [
      ['Sunday Penalty', `${rs} ${salaryDetail.sundayPenalty.toLocaleString('en-IN')}`],
      ['Old Advance', `${rs} ${salaryDetail.oldAdv.toLocaleString('en-IN')}`],
      ['Current Advance', `${rs} ${salaryDetail.curAdv.toLocaleString('en-IN')}`],
      ['Deduction', `${rs} ${salaryDetail.deduction.toLocaleString('en-IN')}`],
      ['New Advance Balance', `${rs} ${salaryDetail.newAdv.toLocaleString('en-IN')}`],
    ];

    const allRows = [...earningsRows, ['', ''], ...deductionRows, ['', ''], ['NET SALARY', `${rs} ${salaryDetail.netSalary.toLocaleString('en-IN')}`]];

    autoTable(doc, {
      head: [['Component', 'Amount']],
      body: allRows,
      startY: 70,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      theme: 'grid',
      tableWidth: 90,
      margin: { left: 110 },
      didParseCell: (data) => {
        if (data.row.index === allRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 255];
        }
      }
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a system-generated salary slip.', 105, pageHeight - 15, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 105, pageHeight - 10, { align: 'center' });

    doc.save(`salary-slip-${staff.name}-${monthName}-${selectedYear}.pdf`);
  };

  const sections = [
    { id: 'overview' as const, label: 'Overview', icon: User },
    { id: 'attendance' as const, label: 'Attendance', icon: Calendar },
    { id: 'salary' as const, label: 'Salary', icon: IndianRupee },
    { id: 'hikes' as const, label: 'Hikes', icon: TrendingUp },
  ];

  return (
    <div className="p-2 md:p-6 pb-24 md:pb-6 space-y-4 max-w-4xl mx-auto">
      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
              activeSection === s.id
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-[var(--bg-card)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-400/30'
            }`}
          >
            <s.icon size={16} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Month Navigator (for attendance & salary) */}
      {(activeSection === 'attendance' || activeSection === 'salary') && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-4 py-2">
            <button onClick={() => navigateMonth(-1)} className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] hover:border-indigo-400/30 transition-all active:scale-95">
              <ChevronLeft size={20} className="text-[var(--text-primary)]" />
            </button>
            <span className="text-lg font-bold text-[var(--text-primary)] min-w-[180px] text-center">
              {monthName} {selectedYear}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              disabled={isNextMonthFuture}
              className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] hover:border-indigo-400/30 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} className="text-[var(--text-primary)]" />
            </button>
          </div>
          {isLeftStaff && (
            <p className="text-center text-xs text-amber-600 font-medium bg-amber-500/10 rounded-lg py-2 px-3 border border-amber-500/20">
              ⚠ You are no longer active. Only past records are shown.
            </p>
          )}
        </div>
      )}

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] p-6 rounded-2xl shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/25">
                {staff.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{staff.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">{staff.type === 'full-time' ? 'Full-Time' : 'Part-Time'} Staff</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow icon={MapPin} label="Location" value={staff.location} />
              <InfoRow icon={Briefcase} label="Experience" value={staff.experience} />
              <InfoRow icon={Calendar} label="Joined Date" value={staff.joinedDate} />
              {staff.contactNumber && <InfoRow icon={Phone} label="Contact" value={staff.contactNumber} />}
              {staff.address && <InfoRow icon={Home} label="Address" value={staff.address} />}
            </div>
          </div>

          {/* Current Salary Structure */}
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] p-6 rounded-2xl shadow-[var(--shadow-soft)]">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <IndianRupee size={20} className="text-indigo-500" /> Current Salary Structure
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SalaryCard label="Basic" amount={staff.basicSalary} />
              <SalaryCard label="Incentive" amount={staff.incentive} />
              <SalaryCard label="HRA" amount={staff.hra} />
              {(staff.mealAllowance || 0) > 0 && <SalaryCard label="Meal Allow." amount={staff.mealAllowance!} />}
              {staff.salarySupplements && Object.entries(staff.salarySupplements).map(([k, v]) => (
                <SalaryCard key={k} label={k} amount={v} />
              ))}
            </div>
            <div className="mt-3">
              <SalaryCard label="Total Salary" amount={staff.totalSalary} highlight />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickStat label="This Month Present" value={`${metrics.totalPresentDays}`} icon={CheckCircle} color="emerald" />
            <QuickStat label="Leaves" value={`${metrics.leaveDays}`} icon={XCircle} color="red" />
            <QuickStat label="Sunday Absents" value={`${metrics.sundayAbsents}`} icon={Calendar} color="amber" />
            <QuickStat label="Total Hikes" value={`${staffHikes.length}`} icon={TrendingUp} color="blue" />
          </div>
        </div>
      )}

      {/* ATTENDANCE */}
      {activeSection === 'attendance' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickStat label="Present" value={`${metrics.presentDays}`} icon={CheckCircle} color="emerald" />
            <QuickStat label="Half Days" value={`${metrics.halfDays}`} icon={Clock} color="amber" />
            <QuickStat label="Leaves" value={`${metrics.leaveDays}`} icon={XCircle} color="red" />
            <QuickStat label="Sun. Absent" value={`${metrics.sundayAbsents}`} icon={Calendar} color="orange" />
          </div>

          {/* Day-by-day */}
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl overflow-hidden shadow-[var(--shadow-soft)]">
            <div className="p-4 border-b border-[var(--glass-border)]">
              <h3 className="font-bold text-[var(--text-primary)]">Daily Attendance</h3>
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
                  const isPast = new Date(dateStr) <= new Date();
                  days.push(
                    <div key={d} className={`flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] last:border-0 ${isSun ? 'bg-orange-500/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[var(--text-muted)] w-8">{String(d).padStart(2, '0')}</span>
                        <span className={`text-sm font-medium ${isSun ? 'text-orange-600' : 'text-[var(--text-primary)]'}`}>{dayName}</span>
                      </div>
                      <StatusBadge status={record?.status || (!isPast ? 'future' : 'Absent')} />
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
          {/* Download button */}
          <button onClick={downloadSalarySlip} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all active:scale-[0.98]">
            <Download size={18} /> Download Salary Slip
          </button>

          {/* Earnings */}
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--glass-border)] bg-emerald-500/5">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ArrowUpRight size={18} className="text-emerald-500" /> Earnings
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <SalaryRow label="Present Days" value={`${metrics.presentDays} days`} />
              <SalaryRow label="Half Days" value={`${metrics.halfDays}`} />
              <SalaryRow label="Leave Days" value={`${metrics.leaveDays} days`} />
              <SalaryRow label="Sunday Absents" value={`${metrics.sundayAbsents}`} />
              <div className="border-t border-[var(--glass-border)] my-1" />
              <SalaryRow label="Basic Earned" value={`Rs. ${salaryDetail.basicEarned.toLocaleString('en-IN')}`} />
              <SalaryRow label="Incentive Earned" value={`Rs. ${salaryDetail.incentiveEarned.toLocaleString('en-IN')}`} />
              <SalaryRow label="HRA Earned" value={`Rs. ${salaryDetail.hraEarned.toLocaleString('en-IN')}`} />
              {salaryDetail.mealAllowance > 0 && <SalaryRow label="Meal Allowance" value={`Rs. ${salaryDetail.mealAllowance.toLocaleString('en-IN')}`} />}
              <div className="border-t border-[var(--glass-border)] my-1" />
              <SalaryRow label="Gross Salary" value={`Rs. ${salaryDetail.grossSalary.toLocaleString('en-IN')}`} bold />
            </div>
          </div>

          {/* Deductions */}
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--glass-border)] bg-red-500/5">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ArrowDownRight size={18} className="text-red-500" /> Deductions
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {salaryDetail.sundayPenalty > 0 && <SalaryRow label="Sunday Penalty" value={`- Rs. ${salaryDetail.sundayPenalty.toLocaleString('en-IN')}`} danger />}
              <SalaryRow label="Deduction" value={`Rs. ${salaryDetail.deduction.toLocaleString('en-IN')}`} />
            </div>
          </div>

          {/* Advance Details */}
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--glass-border)] bg-blue-500/5">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CreditCard size={18} className="text-blue-500" /> Advance Details
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <SalaryRow label="Previous Advance" value={`Rs. ${salaryDetail.oldAdv.toLocaleString('en-IN')}`} />
              <SalaryRow label="Current Month Advance" value={`Rs. ${salaryDetail.curAdv.toLocaleString('en-IN')}`} />
              <SalaryRow label="Advance Deducted" value={`Rs. ${salaryDetail.deduction.toLocaleString('en-IN')}`} />
              <div className="border-t border-[var(--glass-border)] my-1" />
              <SalaryRow label="Advance Balance" value={`Rs. ${salaryDetail.newAdv.toLocaleString('en-IN')}`} bold />
            </div>
          </div>

          {/* Net Salary */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 shadow-lg shadow-indigo-500/25">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium">Net Salary</p>
                <p className="text-3xl font-bold text-white">Rs. {salaryDetail.netSalary.toLocaleString('en-IN')}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <IndianRupee size={28} className="text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HIKES */}
      {activeSection === 'hikes' && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] p-6 rounded-2xl shadow-[var(--shadow-soft)]">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" /> Salary Hike History
            </h3>
            {staffHikes.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp size={48} className="mx-auto text-[var(--text-muted)] mb-3 opacity-30" />
                <p className="text-[var(--text-muted)] font-medium">No salary hikes recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {staffHikes.map((hike, idx) => (
                  <div key={hike.id} className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 rounded-xl relative">
                    {idx === 0 && (
                      <span className="absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">Latest</span>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--text-muted)] font-medium">{new Date(hike.hikeDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        +Rs. {(hike.newSalary - hike.oldSalary).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--text-primary)]">
                      <span className="text-sm text-[var(--text-muted)]">Rs. {hike.oldSalary.toLocaleString('en-IN')}</span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">Rs. {hike.newSalary.toLocaleString('en-IN')}</span>
                    </div>
                    {hike.reason && <p className="text-xs text-[var(--text-muted)] mt-1.5 italic">"{hike.reason}"</p>}
                    {hike.breakdown && (
                      <div className="mt-3 pt-3 border-t border-[var(--glass-border)] grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(hike.breakdown)
                          .filter(([k]) => !k.startsWith('old_'))
                          .map(([k, v]) => {
                            const oldKey = `old_${k}`;
                            const oldVal = hike.breakdown?.[oldKey] ?? 0;
                            const diff = v - oldVal;
                            return (
                              <div key={k} className="flex justify-between text-[var(--text-secondary)]">
                                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                                <span className={diff > 0 ? 'text-emerald-600 font-semibold' : diff < 0 ? 'text-red-500 font-semibold' : 'text-[var(--text-muted)]'}>
                                  {diff > 0 ? '+' : ''}{diff !== 0 ? `Rs. ${diff.toLocaleString('en-IN')}` : `Rs. ${v.toLocaleString('en-IN')}`}
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
  <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
      <Icon size={16} className="text-indigo-500" />
    </div>
    <div>
      <p className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  </div>
);

const SalaryCard: React.FC<{ label: string; amount: number; highlight?: boolean }> = ({ label, amount, highlight }) => (
  <div className={`p-4 rounded-xl text-center border ${
    highlight 
      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 border-indigo-500/30 shadow-lg shadow-indigo-500/20' 
      : 'bg-[var(--glass-bg)] border-[var(--glass-border)]'
  }`}>
    <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${highlight ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{label}</p>
    <p className={`text-lg font-bold ${highlight ? 'text-white' : 'text-[var(--text-primary)]'}`}>
      Rs. {amount.toLocaleString('en-IN')}
    </p>
  </div>
);

const colorMap: Record<string, string> = {
  emerald: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  red: 'text-red-600 bg-red-500/10 border-red-500/20',
  amber: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  blue: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  orange: 'text-orange-600 bg-orange-500/10 border-orange-500/20',
};

const QuickStat: React.FC<{ label: string; value: string; icon: React.ElementType; color: string }> = ({ label, value, icon: Icon, color }) => (
  <div className={`p-4 rounded-2xl text-center border ${colorMap[color] || colorMap.blue}`}>
    <Icon size={20} className="mx-auto mb-1.5" />
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-[11px] font-medium opacity-70 mt-0.5">{label}</p>
  </div>
);

const SalaryRow: React.FC<{ label: string; value: string; bold?: boolean; highlight?: boolean; danger?: boolean }> = ({ label, value, bold, highlight, danger }) => (
  <div className="flex items-center justify-between py-1">
    <span className={`text-sm ${bold ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
    <span className={`text-sm font-mono ${
      highlight ? 'text-lg font-bold text-emerald-600' :
      danger ? 'text-red-500 font-semibold' :
      bold ? 'font-bold text-[var(--text-primary)]' :
      'text-[var(--text-primary)]'
    }`}>{value}</span>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    'Present': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    'Half Day': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    'Absent': 'bg-red-500/10 text-red-600 border-red-500/20',
    'future': 'bg-gray-500/5 text-[var(--text-muted)] border-[var(--glass-border)]',
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${styles[status] || styles.future}`}>
      {status === 'future' ? '—' : status}
    </span>
  );
};

export default StaffPortal;
