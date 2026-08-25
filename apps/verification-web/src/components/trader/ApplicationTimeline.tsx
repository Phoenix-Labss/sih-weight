import React, { useState } from 'react';
import { Application, ApplicationStatus } from '../../types/application';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  Receipt,
  FileCheck,
  HelpCircle,
  Calendar,
  Award,
  Send,
  Scale,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface ApplicationTimelineProps {
  application: Application;
  onOpenPaymentModal: (app: Application) => void;
  onOpenReceiptModal: (app: Application) => void;
  onOpenQueryModal: (app: Application) => void;
  onViewCertificate?: (app: Application) => void;
  onApplicationUpdated?: () => void;
}

const steps: { status: ApplicationStatus; label: string; desc: string }[] = [
  { status: 'DRAFT', label: 'Draft', desc: 'Application prepared' },
  { status: 'SUBMITTED', label: 'Submitted', desc: 'Filing received by Department' },
  { status: 'UNDER_SCRUTINY', label: 'Scrutiny', desc: 'Technical & document evaluation' },
  { status: 'FEE_PENDING', label: 'Fee Assessed', desc: 'Statutory tariff assessed' },
  { status: 'PAYMENT_RECONCILED', label: 'Paid & Reconciled', desc: 'Statutory Fee Paid & Verified' },
  { status: 'SCHEDULED', label: 'Scheduled', desc: 'Officer slot allocated' },
  { status: 'VERIFICATION_IN_PROGRESS', label: 'Testing in Progress', desc: 'Physical NAWI test execution' },
  { status: 'COMPLETED', label: 'Completed', desc: 'Disposition finalized' },
];

function getStepIndex(currentStatus: ApplicationStatus): number {
  switch (currentStatus) {
    case 'DRAFT':
      return 0;
    case 'SUBMITTED':
      return 1;
    case 'UNDER_SCRUTINY':
    case 'QUERY_RAISED':
    case 'QUERY_RESPONDED':
    case 'CORRECTION_SUBMITTED':
      return 2;
    case 'ACCEPTED':
    case 'FEE_PENDING':
    case 'PAYMENT_PROCESSING':
      return 3;
    case 'FEE_PAID':
    case 'PAYMENT_RECONCILED':
      return 4;
    case 'SCHEDULED':
      return 5;
    case 'VERIFICATION_IN_PROGRESS':
      return 6;
    case 'COMPLETED':
      return 7;
    case 'REJECTED':
      return 2;
    default:
      return 1;
  }
}

export const ApplicationTimeline: React.FC<ApplicationTimelineProps> = ({
  application,
  onOpenPaymentModal,
  onOpenReceiptModal,
  onOpenQueryModal,
  onViewCertificate,
  onApplicationUpdated,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ApplicationStatus>(application.current_status);

  React.useEffect(() => {
    setCurrentStatus(application.current_status);
  }, [application.current_status]);

  const currentStepIdx = getStepIndex(currentStatus);
  const isQueryRaised = currentStatus === 'QUERY_RAISED';
  const isRejected = currentStatus === 'REJECTED';

  const handleSubmitDraft = async () => {
    setIsSubmitting(true);
    try {
      const updated = await api.applications.submitApplication(user.tenantId, application.application_id);
      setCurrentStatus(updated?.current_status || 'SUBMITTED');
      notify('success', 'Application Submitted', `Application ${application.application_number} filed for technical scrutiny.`);
      if (onApplicationUpdated) onApplicationUpdated();
    } catch (err) {
      notify('error', 'Submission Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPaid =
    currentStatus === 'FEE_PAID' ||
    currentStatus === 'PAYMENT_RECONCILED' ||
    currentStatus === 'SCHEDULED' ||
    currentStatus === 'VERIFICATION_IN_PROGRESS' ||
    currentStatus === 'COMPLETED' ||
    Boolean(
      application.fee_assessment &&
        (application.fee_assessment.payment_status === 'PAYMENT_RECONCILED' ||
          application.fee_assessment.payment_status === 'RECONCILED' ||
          application.fee_assessment.payment_status === 'SUCCESS')
    );

  // Statutory fee payment is only possible after the officer has scrutinized
  // and assessed the fee (ACCEPTED/FEE_PENDING). A lingering PAYMENT_PENDING
  // assessment on an earlier-stage application must not surface Pay actions.
  const isFeePending =
    !isPaid &&
    (currentStatus === 'FEE_PENDING' ||
      currentStatus === 'ACCEPTED' ||
      currentStatus === 'PAYMENT_PROCESSING') &&
    Boolean(application.fee_assessment);

  // Scrutiny, scheduling, and testing are officer actions; guide the trader
  // there directly instead of leaving them stranded on this dashboard.
  const goToOfficerWorkspace = () => {
    window.location.hash = '#officer';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-gov-navy font-mono">{application.application_number}</span>
            <StatusBadge status={currentStatus} size="sm" />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Type: <span className="font-semibold text-slate-700">{application.application_type.replace(/_/g, ' ')}</span> | Mode: <span className="font-semibold text-slate-700">{application.service_mode.replace(/_/g, ' ')}</span> | Created on: {formatDateTime(application.created_at)}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {currentStatus === 'DRAFT' && (
            <button
              onClick={handleSubmitDraft}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-xs transition-all hover:shadow border border-slate-700 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Application for Scrutiny'}</span>
            </button>
          )}

          {isFeePending && (
            <button
              onClick={() => onOpenPaymentModal(application)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs transition-all hover:shadow"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay Fees ({formatCurrency(application.fee_assessment?.total_assessed_amount || 750)})</span>
            </button>
          )}

          {isPaid && (
            <button
              onClick={() => onOpenReceiptModal(application)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-xs transition-all hover:shadow border border-slate-700"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span>Payment Receipt</span>
            </button>
          )}

          {currentStatus === 'COMPLETED' && onViewCertificate && (
            <button
              onClick={() => onViewCertificate(application)}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs transition-all hover:shadow"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>View Certificate</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage Guidance Banners */}
      {currentStatus === 'DRAFT' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-blue-900">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gov-blue shrink-0" />
            <div>
              <span className="font-bold">Draft Application Ready:</span> Review your filing and click <span className="font-bold text-gov-navy">"Submit Application for Scrutiny"</span> to file with the Legal Metrology Department.
            </div>
          </div>
          <button
            onClick={handleSubmitDraft}
            disabled={isSubmitting}
            className="px-3 py-1 bg-gov-blue text-white font-semibold rounded-md hover:bg-blue-800 transition-colors shrink-0 flex items-center gap-1"
          >
            <Send className="w-3 h-3 text-amber-300" />
            <span>Submit Now</span>
          </button>
        </div>
      )}

      {(currentStatus === 'SUBMITTED' || currentStatus === 'UNDER_SCRUTINY') && !isQueryRaised && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-indigo-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold">Application Filed with Department:</span> Next step is technical scrutiny. Open the <span className="font-bold text-gov-navy">Officer Workspace</span> to assess statutory fees and accept the filing.
            </div>
          </div>
          <button
            onClick={goToOfficerWorkspace}
            className="px-3 py-1 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors shrink-0 flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            <span>Go to Officer Workspace</span>
          </button>
        </div>
      )}

      {isFeePending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Statutory Fee Assessed:</span> Statutory fee of <span className="font-bold text-slate-900">{formatCurrency(application.fee_assessment?.total_assessed_amount || 750)}</span> is pending payment. Click "Pay Fees" to complete treasury transaction.
            </div>
          </div>
          <button
            onClick={() => onOpenPaymentModal(application)}
            className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors shrink-0 flex items-center gap-1"
          >
            <CreditCard className="w-3 h-3" />
            <span>Pay Fees</span>
          </button>
        </div>
      )}

      {(currentStatus === 'FEE_PAID' || currentStatus === 'PAYMENT_RECONCILED') && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Payment Reconciled:</span> Treasury fee confirmed. Open the <span className="font-bold text-gov-navy">Officer Workspace</span> to schedule the physical verification slot.
            </div>
          </div>
          <button
            onClick={goToOfficerWorkspace}
            className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors shrink-0 flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            <span>Go to Officer Workspace</span>
          </button>
        </div>
      )}

      {currentStatus === 'SCHEDULED' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-blue-900">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold">Verification Slot Scheduled:</span> Inspection slot allocated. Open the <span className="font-bold text-gov-navy">Officer Workspace</span> to start the NAWI verification worksheet.
            </div>
          </div>
          <button
            onClick={goToOfficerWorkspace}
            className="px-3 py-1 bg-gov-blue text-white font-semibold rounded-md hover:bg-blue-800 transition-colors shrink-0 flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            <span>Go to Officer Workspace</span>
          </button>
        </div>
      )}

      {currentStatus === 'VERIFICATION_IN_PROGRESS' && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-purple-900">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <span className="font-bold">Verification Test In Progress:</span> Worksheet active. Open the <span className="font-bold text-gov-navy">Officer Workspace</span> to record observations, physical seals, and legal disposition.
            </div>
          </div>
          <button
            onClick={goToOfficerWorkspace}
            className="px-3 py-1 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors shrink-0 flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            <span>Go to Officer Workspace</span>
          </button>
        </div>
      )}

      {currentStatus === 'COMPLETED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Verification Completed & Certified:</span> Digital Certificate of Legal Metrology Verification issued with cryptographic seal.
            </div>
          </div>
          {onViewCertificate && (
            <button
              onClick={() => onViewCertificate(application)}
              className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors shrink-0 flex items-center gap-1"
            >
              <Award className="w-3 h-3 text-amber-300" />
              <span>View Certificate</span>
            </button>
          )}
        </div>
      )}

      {/* Query Raised Warning Banner */}
      {isQueryRaised && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Action Required: Scrutiny Clarification Query</span>
            </div>
            <span className="text-[10px] text-amber-700 font-mono">
              Raised on {formatDateTime(application.query_raised_at)}
            </span>
          </div>
          <p className="text-slate-800 bg-white p-3 rounded-lg border border-amber-200 font-medium">
            "{application.active_query}"
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => onOpenQueryModal(application)}
              className="px-4 py-1.5 rounded-lg bg-gov-blue text-xs font-semibold text-white hover:bg-blue-800 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Submit Clarification Response</span>
            </button>
          </div>
        </div>
      )}

      {/* Rejection Alert Banner */}
      {isRejected && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Application Rejected under Statutory Grounds</span>
          </div>
          <p className="text-rose-800 bg-white p-3 rounded-lg border border-rose-200">
            {application.rejection_reason || 'Rejected after departmental scrutiny.'}
          </p>
        </div>
      )}

      {/* Stepper Timeline Progression with dynamic progress line */}
      <div className="relative pt-2">
        <div className="hidden sm:block absolute top-6 left-8 right-8 h-1 bg-slate-200 -z-0 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, (currentStepIdx / (steps.length - 1)) * 100)}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 relative z-10">
          {steps.map((step, idx) => {
            const isCompleted = application.current_status === 'COMPLETED' ? true : idx < currentStepIdx;
            const isCurrent = application.current_status === 'COMPLETED' ? false : idx === currentStepIdx;
            const isPending = !isCompleted && !isCurrent;

            return (
              <div key={step.status} className="flex flex-col items-center text-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-emerald-200'
                      : isCurrent
                      ? 'bg-gov-navy text-white ring-4 ring-amber-400/40 shadow-blue-200'
                      : 'bg-slate-100 text-slate-400 border border-slate-300'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : isCurrent ? (
                    <Clock className="w-5 h-5 animate-pulse text-amber-300" />
                  ) : (
                    <span className="font-mono">{idx + 1}</span>
                  )}
                </div>
                <div className={`mt-2 text-xs font-bold ${isCurrent ? 'text-gov-navy' : isCompleted ? 'text-emerald-800' : 'text-slate-600'}`}>
                  {step.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{step.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Schedule Notice */}
      {application.scheduled_slot_start && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gov-blue flex-shrink-0" />
          <span>
            Inspection Scheduled for <strong className="font-semibold">{formatDateTime(application.scheduled_slot_start)}</strong>. Assigned Inspecting Officer: <strong className="font-semibold">{application.assigned_lmo_id || 'Legal Metrology Officer'}</strong>.
          </span>
        </div>
      )}
    </div>
  );
};
