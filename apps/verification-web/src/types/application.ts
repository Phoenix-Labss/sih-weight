export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'QUERY_RAISED'
  | 'QUERY_RESPONDED'
  | 'CORRECTION_SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'FEE_PENDING'
  | 'FEE_PAID'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_RECONCILED'
  | 'SCHEDULED'
  | 'VERIFICATION_IN_PROGRESS'
  | 'COMPLETED';

export type ApplicationType =
  | 'INITIAL_VERIFICATION'
  | 'PERIODICAL_REVERIFICATION'
  | 'VERIFICATION_AFTER_REPAIR'
  | 'VOLUNTARY_VERIFICATION';

export type ServiceMode = 'ON_SITE' | 'DEPARTMENTAL_LAB' | 'GATC_CENTRE';

export type PaymentStatus =
  | 'NOT_ASSESSED'
  | 'PAYMENT_PENDING'
  | 'PENDING'
  | 'PAYMENT_INITIATED'
  | 'INITIATED'
  | 'PAYMENT_AUTHORIZED'
  | 'AUTHORIZED'
  | 'PAYMENT_RECONCILED'
  | 'SUCCESS'
  | 'RECONCILED'
  | 'PAYMENT_FAILED'
  | 'FAILED'
  | 'REFUND_INITIATED'
  | 'REFUNDED'
  | 'WAIVED';

export interface FeeAssessment {
  fee_assessment_id: string;
  tenant_id: string;
  policy_version: string;
  base_verification_fee: number;
  user_charge: number;
  late_fee: number;
  total_assessed_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_gateway_ref?: string;
  treasury_challan_number?: string;
  receipt_number?: string;
  paid_at?: string;
  created_at?: string;
}

export interface FeeAssessmentCreate {
  base_verification_fee: number;
  user_charge?: number;
  late_fee?: number;
  policy_version?: string;
}

export interface PaymentReconcileRequest {
  receipt_number?: string;
  payment_gateway_ref?: string;
}

export interface ApplicationCreateRequest {
  instrument_id: string;
  applicant_id: string;
  application_type?: ApplicationType;
  service_mode?: ServiceMode;
  preferred_verification_date?: string;
  applicant_declaration_accepted?: boolean;
}

export interface ApplicationScrutinyRequest {
  action: 'ACCEPT' | 'QUERY' | 'REJECT';
  notes?: string;
  query_text?: string;
  rejection_reason?: string;
}

export interface ApplicationCorrectionRequest {
  correction_notes: string;
}

export interface ApplicationScheduleRequest {
  slot_start: string;
  slot_end: string;
  assigned_lmo_id?: string;
  assigned_gatc_id?: string;
}

export interface Application {
  application_id: string;
  application_number: string;
  tenant_id: string;
  jurisdiction_id: string;
  instrument_id: string;
  applicant_id: string;
  application_type: ApplicationType;
  service_mode: ServiceMode;
  preferred_verification_date?: string;
  scheduled_slot_start?: string;
  scheduled_slot_end?: string;
  assigned_lmo_id?: string;
  assigned_gatc_id?: string;
  fee_assessment_id?: string;
  current_status: ApplicationStatus;
  scrutiny_notes?: string;
  rejection_reason?: string;
  active_query?: string;
  query_raised_at?: string;
  applicant_declaration_accepted: boolean;
  version: number;
  fee_assessment?: FeeAssessment;
  created_at?: string;
  updated_at?: string;
}
