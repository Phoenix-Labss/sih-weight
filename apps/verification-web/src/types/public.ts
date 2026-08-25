import { CertificateStatus } from './certificate';

export interface InstrumentSummaryPublic {
  category: string;
  subtype: string;
  model_name: string;
  accuracy_class: string;
  max_capacity: number;
  min_capacity: number;
  capacity_unit: string;
  scale_interval_e: number;
  scale_interval_unit: string;
  masked_serial_number: string;
  physical_seal_number?: string;
}

export interface PublicCertificateVerifyResponse {
  certificate_number: string;
  status: CertificateStatus;
  issuing_authority: string;
  instrument_summary: InstrumentSummaryPublic;
  verification_date: string;
  valid_until: string;
  cryptographic_validity: 'VALID_SIGNATURE' | 'INVALID_SIGNATURE' | 'UNCHECKED';
  certificate_hash: string;
  superseded_by?: string;
  revocation_reason?: string;
}
