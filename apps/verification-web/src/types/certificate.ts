export type CertificateStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ISSUED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'SUPERSEDED'
  | 'SIGNING_FAILED';

export interface CertificateIssueRequest {
  session_id: string;
  validity_months?: number;
  signer_notes?: string;
  issuer_type?: 'DEPARTMENTAL_LMO' | 'GATC';
  verifier_name?: string;
  verifier_designation?: string;
  gatc_approval_order?: string;
  gatc_facility_name?: string;
}

export interface CertificateStatusUpdateRequest {
  action: 'SUSPEND' | 'REINSTATE' | 'REVOKE' | 'SUPERSEDE' | 'EXPIRE';
  reason: string;
  statutory_authority_reference?: string;
  superseding_certificate_id?: string;
}

export interface CertificateStatusEvent {
  status_event_id: string;
  certificate_id: string;
  previous_status: CertificateStatus;
  new_status: CertificateStatus;
  actor_id: string;
  reason: string;
  statutory_authority_reference?: string;
  event_timestamp: string;
}

export interface Certificate {
  certificate_id: string;
  certificate_number: string;
  public_verification_token: string;
  tenant_id: string;
  session_id: string;
  instrument_id: string;
  owner_id: string;
  procedure_pack_id: string;
  verifier_id: string;
  signer_id?: string;
  issuer_type?: 'DEPARTMENTAL_LMO' | 'GATC';
  issuer_authority_name?: string;
  verifier_name?: string;
  verifier_designation?: string;
  gatc_approval_order?: string;
  gatc_facility_name?: string;
  issue_date: string;
  valid_until: string;
  certificate_status: CertificateStatus;
  certificate_bytes_sha256?: string;
  pdf_storage_path?: string;
  digital_signature_reference?: string;
  signature_timestamp?: string;
  qr_code_payload: string;
  superseding_certificate_id?: string;
  status_events: CertificateStatusEvent[];
  created_at?: string;
  updated_at?: string;
}
