export type RoleEnum =
  | 'OWNER'
  | 'APPLICANT'
  | 'LMO'
  | 'GATC_VERIFIER'
  | 'SUPERVISOR'
  | 'CONTROLLER'
  | 'ADMIN'
  | 'PUBLIC';

export type AccuracyClassEnum = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';

export type ApplicationTypeEnum =
  | 'INITIAL_VERIFICATION'
  | 'RE_VERIFICATION'
  | 'PERIODICAL_REVERIFICATION'
  | 'AFTER_REPAIR_VERIFICATION'
  | 'VERIFICATION_AFTER_REPAIR'
  | 'VOLUNTARY_VERIFICATION';

export type ServiceModeEnum = 'ON_SITE' | 'DEPARTMENTAL_LAB' | 'GATC_CENTRE';

export type ApplicationStatusEnum =
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

export type PaymentStatusEnum =
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

export type SessionStatusEnum =
  | 'PLANNED'
  | 'IDENTITY_CONFIRMED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'FINALIZED';

export type VerificationOutcomeEnum =
  | 'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
  | 'VERIFICATION_FAILED'
  | 'NEEDS_REVIEW'
  | 'INCOMPLETE_VERIFICATION'
  | 'OUTSIDE_AUTHORIZATION_SCOPE';

export type StepTypeEnum =
  | 'ZERO_TEST'
  | 'INCREASING_LOAD'
  | 'DECREASING_LOAD'
  | 'ECCENTRICITY'
  | 'REPEATABILITY'
  | 'TARE_TEST';

export type PhysicalSealActionEnum =
  | 'SEAL_APPLIED'
  | 'SEAL_BROKEN_OLD'
  | 'SEAL_INTACT_VERIFIED'
  | 'SEAL_INSPECTED_INTACT'
  | 'SEAL_DEFECTIVE_REPLACED'
  | 'SEAL_LOST_RECORDED'
  | 'SEAL_BROKEN_RECORDED'
  | 'SEAL_REPLACED';

export type SealTypeEnum =
  | 'LEAD_WIRE_SEAL'
  | 'SECURITY_STICKER_HOLOGRAM'
  | 'TAMPER_EVIDENT_STICKER'
  | 'METALLIC_PUNCH_MARK'
  | 'BARCODED_TAMPER_SEAL'
  | 'HEAT_SHRINK_SEAL'
  | 'SECURITY_LABEL';

export type CertificateStatusEnum =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ISSUED'
  | 'SIGNING_FAILED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'SUPERSEDED';

export type ReferenceStandardStatusEnum =
  | 'ACTIVE'
  | 'DUE_CALIBRATION'
  | 'UNDER_CALIBRATION'
  | 'QUARANTINED'
  | 'EXPIRED'
  | 'RETIRED';

export interface SecurityContext {
  userId: string;
  tenantId: string;
  role: RoleEnum;
  jurisdictionId?: string;
  email?: string;
  fullName?: string;
  isActive?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  pages?: number;
}
