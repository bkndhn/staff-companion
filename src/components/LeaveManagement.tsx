import React, { useState, useEffect } from 'react';
import { Calendar, Check, X, Clock, MessageSquare, ChevronDown, Filter, FileText } from 'lucide-react';
import { leaveService, LeaveRequest } from '../services/leaveService';

interface LeaveManagementProps {
  userRole: 'admin' | 'manager';
  userLocation?: string;
  userName?: string;
}

const leaveTypeLabels: Record<string, string> = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  emergency: 'Emergency',
  other: 'Other',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  postponed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const LeaveManagement: React.FC<LeaveManagementProps> = ({ userRole, userLocation, userName }) => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'postponed'>('all');
  const [actionModal, setActionModal] = useState<{ leave: LeaveRequest; action: string } | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = userRole === 'admin'
        ? await leaveService.getAll()
        : await leaveService.getByLocation(userLocation || '');
      setLeaves(data);
    } catch (err) {
      console.error('Error loading leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeaves(); }, [userRole, userLocation]);

  const handleAction = async () => {
    if (!actionModal) return;
    setProcessing(true);
    const success = await leaveService.updateStatus(
      actionModal.leave.id,
      actionModal.action,
      comment,
      userName || (userRole === 'admin' ? 'Admin' : `${userLocation} Manager`)
    );
    if (success) {
      await loadLeaves();
      setActionModal(null);
      setComment('');
    }
    setProcessing(false);
  };

  const filtered = filter === 'all' ? leaves : leaves.filter(l => l.status === filter);

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={24} className="text-indigo-500" /> Leave Management
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {userRole === 'admin' ? 'All locations' : `${userLocation}`} • {pendingCount} pending
          </p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected', 'postponed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filter === f
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-indigo-400/30'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Leave List */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Calendar size={48} className="mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
          <p className="text-[var(--text-muted)] font-medium">No leave requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(leave => (
            <div key={leave.id} className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {leave.staffName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)]">{leave.staffName}</h4>
                      <p className="text-xs text-[var(--text-muted)]">{leave.location}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-[var(--text-muted)]">Date: </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {new Date(leave.leaveDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {leave.leaveEndDate && (
                      <div>
                        <span className="text-[var(--text-muted)]">To: </span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {new Date(leave.leaveEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[var(--text-muted)]">Type: </span>
                      <span className="font-semibold text-[var(--text-primary)]">{leaveTypeLabels[leave.leaveType]}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Applied: </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {new Date(leave.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-3 mb-2">
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">Reason</p>
                    <p className="text-sm text-[var(--text-primary)]">{leave.reason}</p>
                  </div>

                  {leave.managerComment && (
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
                      <p className="text-xs text-indigo-500 mb-0.5 flex items-center gap-1">
                        <MessageSquare size={12} /> {leave.reviewedBy}'s Comment
                      </p>
                      <p className="text-sm text-[var(--text-primary)]">{leave.managerComment}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusColors[leave.status]}`}>
                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                  </span>

                  {leave.status === 'pending' && (
                    <div className="flex gap-1.5 mt-1">
                      <button
                        onClick={() => { setActionModal({ leave, action: 'approved' }); setComment(''); }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-1"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => { setActionModal({ leave, action: 'rejected' }); setComment(''); }}
                        className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors flex items-center gap-1"
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => { setActionModal({ leave, action: 'postponed' }); setComment(''); }}
                        className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors flex items-center gap-1"
                      >
                        <Clock size={14} /> Postpone
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setActionModal(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              {actionModal.action === 'approved' ? '✅ Approve' : actionModal.action === 'rejected' ? '❌ Reject' : '⏸ Postpone'} Leave
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              {actionModal.leave.staffName} - {leaveTypeLabels[actionModal.leave.leaveType]}
            </p>

            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              rows={3}
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] font-semibold text-sm hover:bg-[var(--glass-bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={processing}
                className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-50 ${
                  actionModal.action === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  actionModal.action === 'rejected' ? 'bg-red-500 hover:bg-red-600' :
                  'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {processing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
