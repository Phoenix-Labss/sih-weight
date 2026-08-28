export interface GovernmentPersonnelProvisionRequest {
  tenant_id?: string;
  full_name: string;
  email: string;
  role: 'LMO' | 'GATC_VERIFIER' | 'SUPERVISOR' | 'CONTROLLER' | 'ADMIN' | 'AUDITOR';
  password?: string;
  jurisdiction_id?: string;
  designation?: string;
  posting_order_number?: string;
  digital_signature_cert_id?: string;
  stakeholder_id?: string;
}

export interface GATCRegistrationRequest {
  tenant_id?: string;
  facility_name: string;
  approval_order_number: string;
  jurisdiction_id?: string;
  address_line: string;
  district: string;
  pincode: string;
  max_capacity_kg: number;
  approved_classes: string[];
  valid_from?: string;
  valid_to?: string;
}

export interface ModelApprovalRegistrationRequest {
  category?: string;
  subtype?: string;
  manufacturer_name: string;
  model_name: string;
  model_approval_number: string;
  accuracy_class: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';
  min_capacity: number | string;
  max_capacity: number | string;
  capacity_unit?: string;
  verification_scale_interval_e: number | string;
  scale_interval_unit?: string;
  specifications?: Record<string, unknown>;
}

export interface ApprovalRequestItem {
  request_id: string;
  tenant_id: string;
  entity_type: 'USER_PROVISION' | 'GATC_REGISTRATION' | 'MODEL_APPROVAL' | 'STANDARD_REGISTER';
  title: string;
  payload: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requester_id: string;
  requester_name: string;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRecord {
  user_id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  lmo_profile?: {
    designation: string;
    posting_order_number: string;
    jurisdiction_id: string;
    digital_signature_cert_id?: string;
  } | null;
}

export interface GATCCentreRecord {
  gatc_id: string;
  facility_id: string;
  approval_order_number: string;
  approved_scope: string;
  valid_from: string;
  valid_to: string;
  status: string;
  created_at: string;
  facility?: {
    facility_name: string;
    address_line: string;
    district: string;
    pincode: string;
  } | null;
}

export interface JurisdictionRecord {
  jurisdiction_id: string;
  tenant_id: string;
  name: string;
  code: string;
  level: string;
}
