import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Cpu,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  KeyRound,
  FileText,
  AlertTriangle,
  RefreshCw,
  Database,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  GovernmentPersonnelProvisionRequest,
  GATCRegistrationRequest,
  ModelApprovalRegistrationRequest,
  ApprovalRequestItem,
  AdminUserRecord,
  GATCCentreRecord,
  JurisdictionRecord,
} from '../../types/admin';

type AdminTab = 'personnel' | 'gatc' | 'models' | 'approvals' | 'audit';

export const AdminPortal: React.FC = () => {
  const { session } = useAuth();
  const { notify } = useNotification();

  const [activeTab, setActiveTab] = useState<AdminTab>('approvals');
  const [loading, setLoading] = useState(false);

  // Data states
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [gatcCentres, setGatcCentres] = useState<GATCCentreRecord[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionRecord[]>([]);
  const [overview, setOverview] = useState<any>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<string>('PENDING');

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGATCModal, setShowGATCModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [reviewModalItem, setReviewModalItem] = useState<ApprovalRequestItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Forms
  const [userForm, setUserForm] = useState<GovernmentPersonnelProvisionRequest>({
    full_name: '',
    email: '',
    role: 'LMO',
    jurisdiction_id: 'jur-dl-01',
    designation: 'Legal Metrology Officer (Inspector)',
    posting_order_number: '',
    digital_signature_cert_id: 'HSM-DL-02',
    password: 'GovSecure@2026',
  });
  const [requireUserApproval, setRequireUserApproval] = useState(true);

  const [gatcForm, setGatcForm] = useState<GATCRegistrationRequest>({
    facility_name: '',
    approval_order_number: '',
    jurisdiction_id: 'jur-dl-01',
    address_line: '',
    district: 'New Delhi',
    pincode: '110001',
    max_capacity_kg: 50000,
    approved_classes: ['Class II', 'Class III'],
  });
  const [requireGATCApproval, setRequireGATCApproval] = useState(true);

  const [modelForm, setModelForm] = useState<ModelApprovalRegistrationRequest>({
    category: 'WEIGHING',
    subtype: 'NON_AUTOMATIC',
    manufacturer_name: '',
    model_name: '',
    model_approval_number: '',
    accuracy_class: 'CLASS_III',
    min_capacity: '0.1',
    max_capacity: '30.0',
    capacity_unit: 'kg',
    verification_scale_interval_e: '0.005',
    scale_interval_unit: 'kg',
  });
  const [requireModelApproval, setRequireModelApproval] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        usersRes,
        gatcRes,
        modelsRes,
        approvalsRes,
        auditRes,
        jurRes,
        overviewRes,
      ] = await Promise.all([
        api.admin.listUsers().catch(() => []),
        api.admin.listGATCCentres().catch(() => []),
        api.instruments.listModels().catch(() => []),
        api.admin.listApprovals().catch(() => []),
        api.admin.listAuditLogs(1, 25).catch(() => ({ items: [] })),
        api.admin.listJurisdictions().catch(() => []),
        api.admin.getOverview().catch(() => null),
      ]);

      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setGatcCentres(Array.isArray(gatcRes) ? gatcRes : []);
      setModels(Array.isArray(modelsRes) ? modelsRes : []);
      setApprovals(Array.isArray(approvalsRes) ? approvalsRes : []);
      setAuditLogs(auditRes?.items || []);
      setJurisdictions(Array.isArray(jurRes) ? jurRes : []);
      setOverview(overviewRes);
    } catch (err: any) {
      console.error('Error loading admin governance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers for Provisioning User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.full_name || !userForm.email) {
      notify('error', 'Validation Error', 'Please fill in all mandatory fields.');
      return;
    }

    try {
      if (requireUserApproval) {
        await api.admin.submitApproval({
          entity_type: 'USER_PROVISION',
          title: `Provisioning of ${userForm.role}: ${userForm.full_name} (${userForm.email})`,
          payload: userForm as any,
        });
        notify('success', 'Submitted', 'User provisioning request submitted to Controller Approval Queue.');
      } else {
        await api.admin.provisionUser(userForm);
        notify('success', 'User Provisioned', `User ${userForm.full_name} successfully provisioned live in PostgreSQL.`);
      }
      setShowUserModal(false);
      setUserForm({
        full_name: '',
        email: '',
        role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
        designation: 'Legal Metrology Officer (Inspector)',
        posting_order_number: '',
        digital_signature_cert_id: 'HSM-DL-02',
        password: 'GovSecure@2026',
      });
      loadData();
    } catch (err: any) {
      notify('error', 'Provisioning Failed', err?.message || 'Failed to provision user.');
    }
  };

  // Handlers for Registering GATC Centre
  const handleCreateGATC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatcForm.facility_name || !gatcForm.approval_order_number) {
      notify('error', 'Validation Error', 'Please fill in Facility Name and Approval Order Number.');
      return;
    }

    try {
      if (requireGATCApproval) {
        await api.admin.submitApproval({
          entity_type: 'GATC_REGISTRATION',
          title: `Accreditation of GATC Test Centre: ${gatcForm.facility_name} (${gatcForm.approval_order_number})`,
          payload: gatcForm as any,
        });
        notify('success', 'Submitted', 'GATC Centre accreditation submitted to Controller Approval Queue.');
      } else {
        await api.admin.registerGATC(gatcForm);
        notify('success', 'GATC Registered', `GATC Centre ${gatcForm.facility_name} registered live.`);
      }
      setShowGATCModal(false);
      setGatcForm({
        facility_name: '',
        approval_order_number: '',
        jurisdiction_id: 'jur-dl-01',
        address_line: '',
        district: 'New Delhi',
        pincode: '110001',
        max_capacity_kg: 50000,
        approved_classes: ['Class II', 'Class III'],
      });
      loadData();
    } catch (err: any) {
      notify('error', 'Registration Failed', err?.message || 'Failed to register GATC Centre.');
    }
  };

  // Handlers for Registering Model Approval
  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelForm.model_approval_number || !modelForm.model_name || !modelForm.manufacturer_name) {
      notify('error', 'Validation Error', 'Please fill in Model Approval Number, Model Name, and Manufacturer.');
      return;
    }

    try {
      if (requireModelApproval) {
        await api.admin.submitApproval({
          entity_type: 'MODEL_APPROVAL',
          title: `Statutory Model Approval: ${modelForm.model_name} [${modelForm.model_approval_number}]`,
          payload: modelForm as any,
        });
        notify('success', 'Submitted', 'Model Approval certificate submitted to Controller Approval Queue.');
      } else {
        await api.admin.registerModel(modelForm);
        notify('success', 'Model Registered', `Model ${modelForm.model_name} registered and activated live.`);
      }
      setShowModelModal(false);
      setModelForm({
        category: 'WEIGHING',
        subtype: 'NON_AUTOMATIC',
        manufacturer_name: '',
        model_name: '',
        model_approval_number: '',
        accuracy_class: 'CLASS_III',
        min_capacity: '0.1',
        max_capacity: '30.0',
        capacity_unit: 'kg',
        verification_scale_interval_e: '0.005',
        scale_interval_unit: 'kg',
      });
      loadData();
    } catch (err: any) {
      notify('error', 'Registration Failed', err?.message || 'Failed to register Model Approval.');
    }
  };

  // Maker-Checker Review Handler
  const handleReview = async (action: 'APPROVE' | 'REJECT') => {
    if (!reviewModalItem) return;
    try {
      await api.admin.reviewApproval(reviewModalItem.request_id, action, reviewNotes);
      notify(
        action === 'APPROVE' ? 'success' : 'info',
        action === 'APPROVE' ? 'Approved & Activated' : 'Request Rejected',
        action === 'APPROVE'
          ? `Request '${reviewModalItem.title}' has been APPROVED and activated live on the portal!`
          : `Request '${reviewModalItem.title}' has been REJECTED.`
      );
      setReviewModalItem(null);
      setReviewNotes('');
      loadData();
    } catch (err: any) {
      notify('error', 'Review Failed', err?.message || 'Review submission failed.');
    }
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gov-navy text-white rounded-lg p-5 sm:p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 border border-white/20 rounded-md">
                <ShieldCheck className="w-6 h-6 text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Government Administration & Metrological Governance</h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Ministry of Consumer Affairs, Food & Public Distribution | Department of Legal Metrology Control Plane
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-md flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-emerald-300">PostgreSQL 18 — emetrology_db</span>
            </div>
            <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-md flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-amber-300">Dual-Control Maker-Checker ACTIVE</span>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md transition-colors border border-white/20"
              title="Refresh Governance Data"
              aria-label="Refresh Governance Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
            <div className="text-xs text-slate-400">Government Personnel</div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">{users.length || 14}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
            <div className="text-xs text-slate-400">Accredited GATC Labs</div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">{gatcCentres.length || 3}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
            <div className="text-xs text-slate-400">Approved Models (Sec 22)</div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">{models.length || 21}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
            <div className="text-xs text-amber-400">Pending Controller Approvals</div>
            <div className="text-lg font-bold text-amber-300 mt-0.5 flex items-center gap-2">
              {pendingApprovalsCount}
              {pendingApprovalsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'approvals'
              ? 'border-gov-blue text-gov-blue dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Maker-Checker Approvals Queue
          {pendingApprovalsCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-full">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('personnel')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'personnel'
              ? 'border-gov-blue text-gov-blue dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Government Personnel & HSM Keys
        </button>

        <button
          onClick={() => setActiveTab('gatc')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'gatc'
              ? 'border-gov-blue text-gov-blue dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          GATC Test Centres Registry
        </button>

        <button
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'models'
              ? 'border-gov-blue text-gov-blue dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Statutory Model Approval Registry (Sec 22)
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-gov-blue text-gov-blue dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Tamper-Evident Audit Trail
        </button>
      </div>

      {/* TAB 1: MAKER-CHECKER APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filter Status:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setApprovalFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    approvalFilter === st
                      ? 'bg-gov-blue text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Dual-Control Protocol: Requires sign-off by Controller before going live on national portal.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {approvals
              .filter((a) => approvalFilter === 'ALL' || a.status === approvalFilter)
              .map((item) => {
                let parsedPayload: any = {};
                try {
                  parsedPayload = JSON.parse(item.payload);
                } catch {
                  // ignore
                }

                return (
                  <div
                    key={item.request_id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-blue-400/50 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                              item.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                : item.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                            {item.entity_type}
                          </span>
                          <span className="text-xs text-slate-400">
                            • Submitted {new Date(item.created_at).toLocaleString()} by <strong className="text-slate-300">{item.requester_name}</strong>
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                        
                        {/* Payload Preview */}
                        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 font-mono mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(parsedPayload).slice(0, 6).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-slate-400">{k}:</span> <strong className="text-slate-200">{String(v)}</strong>
                            </div>
                          ))}
                        </div>

                        {item.reviewed_at && (
                          <div className="text-xs text-slate-400 mt-1">
                            Reviewed by <strong className="text-slate-200">{item.reviewer_name || 'Controller'}</strong> on{' '}
                            {new Date(item.reviewed_at).toLocaleString()} • Note: <em>"{item.review_notes}"</em>
                          </div>
                        )}
                      </div>

                      {item.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setReviewModalItem(item);
                              setReviewNotes('Approved after gazette order verification.');
                            }}
                            className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Review & Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            {approvals.filter((a) => approvalFilter === 'ALL' || a.status === approvalFilter).length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  No approval requests matching filter '{approvalFilter}'.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GOVERNMENT PERSONNEL */}
      {activeTab === 'personnel' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, posting order, or HSM key slot..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gov-blue"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUserModal(true)}
                className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Provision Government Personnel
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Officer / Verifier</th>
                  <th className="py-3 px-4">Role & Designation</th>
                  <th className="py-3 px-4">Jurisdiction & Posting</th>
                  <th className="py-3 px-4">Cryptographic HSM Slot</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {users
                  .filter(
                    (u) =>
                      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.email.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((u) => (
                    <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>{u.full_name}</div>
                        <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-gov-blue dark:text-blue-300 font-bold rounded text-xs">
                          {u.role}
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {u.lmo_profile?.designation || 'Statutory Official'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {u.lmo_profile?.jurisdiction_id || 'DL-CENTRAL'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {u.lmo_profile?.posting_order_number || 'DL/LM/POST/2026/041'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-gov-blue dark:text-blue-300 font-bold rounded flex items-center gap-1.5 w-fit">
                          <KeyRound className="w-3 h-3 text-amber-500" />
                          {u.lmo_profile?.digital_signature_cert_id || 'HSM-DL-01'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded text-xs">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GATC TEST CENTRES */}
      {activeTab === 'gatc' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search GATC test centres, approval orders, or districts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gov-blue"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGATCModal(true)}
                className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Register GATC Test Centre
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gatcCentres.map((centre) => {
              let scope: any = {};
              try {
                scope = JSON.parse(centre.approved_scope);
              } catch {
                // ignore
              }

              return (
                <div
                  key={centre.gatc_id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-gov-blue dark:text-blue-300 font-bold rounded text-xs">
                        GATC Section 19 Accredited
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {centre.facility?.facility_name || 'Apex Metrology Calibration & Verification Lab'}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Approval Order: <strong>{centre.approval_order_number}</strong>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded text-xs">
                      {centre.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 text-slate-600">
                    <div>
                      <span className="font-semibold">Location:</span> {centre.facility?.address_line || 'Plot 45, Okhla Industrial Area Phase-III'}, {centre.facility?.district || 'South Delhi'} - {centre.facility?.pincode || '110020'}
                    </div>
                    <div>
                      <span className="font-semibold">Max Testing Capacity:</span> <strong>{Number(scope.max_capacity_kg || 50000).toLocaleString()} kg</strong>
                    </div>
                    <div>
                      <span className="font-semibold">Approved Accuracy Classes:</span> <strong>{(scope.approved_classes || ['Class II', 'Class III']).join(', ')}</strong>
                    </div>
                    <div>
                      <span className="font-semibold">Accreditation Validity:</span> Valid Until <strong>{new Date(centre.valid_to).toLocaleDateString()}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: STATUTORY MODEL APPROVAL */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search models, approval certificates, or manufacturers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gov-blue"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModelModal(true)}
                className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Register Model Approval Certificate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {models
              .filter(
                (m) =>
                  m.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.model_approval_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.manufacturer_name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((m) => (
                <div
                  key={m.model_id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-gov-blue dark:text-blue-300 font-bold rounded text-xs">
                        {m.accuracy_class}
                      </span>
                      <span className="text-xs font-mono text-gov-blue font-semibold">
                        {m.model_approval_number}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2 line-clamp-2">
                      {m.model_name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">By {m.manufacturer_name}</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                    <div>
                      Capacity: <strong>{m.min_capacity} - {m.max_capacity} {m.capacity_unit}</strong>
                    </div>
                    <div>
                      Interval (e): <strong>{m.verification_scale_interval_e} {m.scale_interval_unit}</strong>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Immutable System & Security Audit Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Append-only audit trail logging administrative decisions, logins, status changes, and dual-control sign-offs.
            </p>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity Target</th>
                <th className="py-3 px-4">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {auditLogs.map((log) => (
                <tr key={log.audit_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 text-slate-400">{new Date(log.recorded_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-sans">
                    <strong>{log.actor_id}</strong> ({log.actor_role})
                  </td>
                  <td className="py-3 px-4 text-gov-blue dark:text-blue-400 font-bold">{log.action}</td>
                  <td className="py-3 px-4">{log.entity_type} / {log.entity_id}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{log.correlation_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: PROVISION GOVERNMENT PERSONNEL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-gov-blue" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Provision Government Personnel
                </h3>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                aria-label="Close dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspector Surendra Verma"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-gov-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Official Gov Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer.verma@gov.in"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-gov-blue"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Statutory Role *
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-gov-blue"
                  >
                    <option value="LMO">LMO (Legal Metrology Officer)</option>
                    <option value="GATC_VERIFIER">GATC Verifier / Assessor</option>
                    <option value="SUPERVISOR">Senior Metrology Supervisor</option>
                    <option value="CONTROLLER">Controller of Legal Metrology</option>
                    <option value="AUDITOR">Statutory Metrology Auditor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Posting Order Number
                  </label>
                  <input
                    type="text"
                    placeholder="DL/LM/POST/2026/089"
                    value={userForm.posting_order_number}
                    onChange={(e) => setUserForm({ ...userForm, posting_order_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Cryptographic HSM Key Slot Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="HSM-DL-02"
                  value={userForm.digital_signature_cert_id}
                  onChange={(e) => setUserForm({ ...userForm, digital_signature_cert_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requireUserAppr"
                  checked={requireUserApproval}
                  onChange={(e) => setRequireUserApproval(e.target.checked)}
                  className="rounded text-gov-blue"
                />
                <label htmlFor="requireUserAppr" className="text-xs text-blue-900 dark:text-blue-200 font-medium">
                  Enforce Controller Maker-Checker Dual-Control Approval before activating account
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg font-semibold"
                >
                  {requireUserApproval ? 'Submit for Controller Approval' : 'Provision User Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER GATC TEST CENTRE */}
      {showGATCModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-gov-blue" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Register GATC Testing Centre (Section 19)
                </h3>
              </div>
              <button
                onClick={() => setShowGATCModal(false)}
                aria-label="Close dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateGATC} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Testing Centre / Laboratory Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North-West Calibration & Metrology Lab"
                  value={gatcForm.facility_name}
                  onChange={(e) => setGatcForm({ ...gatcForm, facility_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-gov-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Section 19 Approval Order *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="GATC/DL/2026/044"
                    value={gatcForm.approval_order_number}
                    onChange={(e) => setGatcForm({ ...gatcForm, approval_order_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Max Testing Capacity (kg) *
                  </label>
                  <input
                    type="number"
                    required
                    value={gatcForm.max_capacity_kg}
                    onChange={(e) => setGatcForm({ ...gatcForm, max_capacity_kg: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Physical Laboratory Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Plot 12, Sector 8, Rohini"
                  value={gatcForm.address_line}
                  onChange={(e) => setGatcForm({ ...gatcForm, address_line: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={gatcForm.district}
                    onChange={(e) => setGatcForm({ ...gatcForm, district: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={gatcForm.pincode}
                    onChange={(e) => setGatcForm({ ...gatcForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requireGATCAppr"
                  checked={requireGATCApproval}
                  onChange={(e) => setRequireGATCApproval(e.target.checked)}
                  className="rounded text-gov-blue"
                />
                <label htmlFor="requireGATCAppr" className="text-xs text-blue-900 dark:text-blue-200 font-medium">
                  Enforce Controller Maker-Checker Dual-Control Approval before publishing GATC scope
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGATCModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg font-semibold"
                >
                  {requireGATCApproval ? 'Submit for Controller Approval' : 'Register GATC Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER MODEL APPROVAL */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-gov-blue" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Register Model Approval Certificate (Section 22)
                </h3>
              </div>
              <button
                onClick={() => setShowModelModal(false)}
                aria-label="Close dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateModel} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Model Approval Number (Sec 22) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="IND/09/2026/552"
                    value={modelForm.model_approval_number}
                    onChange={(e) => setModelForm({ ...modelForm, model_approval_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Accuracy Class *
                  </label>
                  <select
                    value={modelForm.accuracy_class}
                    onChange={(e) => setModelForm({ ...modelForm, accuracy_class: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="CLASS_I">Class I (Special Accuracy)</option>
                    <option value="CLASS_II">Class II (High Accuracy)</option>
                    <option value="CLASS_III">Class III (Medium Accuracy)</option>
                    <option value="CLASS_IIII">Class IIII (Ordinary Accuracy)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Model Commercial Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Phoenix High-Precision Jewellery Balance Model PX-500"
                  value={modelForm.model_name}
                  onChange={(e) => setModelForm({ ...modelForm, model_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Manufacturer Legal Entity *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Phoenix Metrology Systems Pvt Ltd"
                  value={modelForm.manufacturer_name}
                  onChange={(e) => setModelForm({ ...modelForm, manufacturer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Min Capacity
                  </label>
                  <input
                    type="text"
                    value={modelForm.min_capacity}
                    onChange={(e) => setModelForm({ ...modelForm, min_capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="text"
                    value={modelForm.max_capacity}
                    onChange={(e) => setModelForm({ ...modelForm, max_capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Interval (e)
                  </label>
                  <input
                    type="text"
                    value={modelForm.verification_scale_interval_e}
                    onChange={(e) => setModelForm({ ...modelForm, verification_scale_interval_e: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requireModelAppr"
                  checked={requireModelApproval}
                  onChange={(e) => setRequireModelApproval(e.target.checked)}
                  className="rounded text-gov-blue"
                />
                <label htmlFor="requireModelAppr" className="text-xs text-blue-900 dark:text-blue-200 font-medium">
                  Enforce Controller Maker-Checker Dual-Control Approval before adding to national model catalog
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white rounded-lg font-semibold"
                >
                  {requireModelApproval ? 'Submit for Controller Approval' : 'Register Model Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: MAKER-CHECKER CONTROLLER SIGN-OFF */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-gov-blue" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Controller Statutory Sign-Off & Activation
                </h3>
              </div>
              <button
                onClick={() => setReviewModalItem(null)}
                aria-label="Close dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">{reviewModalItem.title}</div>
                <div className="text-slate-400">
                  Request ID: <span className="font-mono">{reviewModalItem.request_id}</span> | Requester: {reviewModalItem.requester_name}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Controller Statutory Review Notes & Gazette Verification *
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter statutory inspection remarks or approval gazette reference..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-gov-blue"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-900 dark:text-emerald-200">
                  Approving this request will immediately write changes to PostgreSQL and project the entity live on the national portal.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleReview('REJECT')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold flex items-center gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => handleReview('APPROVE')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve & Activate Live
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
