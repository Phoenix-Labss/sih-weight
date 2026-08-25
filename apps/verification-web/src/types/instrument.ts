export type AccuracyClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';

export type InstrumentStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'VERIFICATION_DUE'
  | 'OVERDUE'
  | 'UNDER_REPAIR'
  | 'REJECTED'
  | 'SEALED_OUT_OF_SERVICE'
  | 'RETIRED';

export type LegacyTrustStatus = 'VERIFIED_LEGACY' | 'DIGITIZED_FROM_SOURCE' | 'UNVERIFIED_LEGACY' | 'CONFLICTED';

export interface InstrumentModel {
  model_id: string;
  category: string;
  subtype: string;
  manufacturer_name: string;
  model_name: string;
  model_approval_number: string;
  accuracy_class: AccuracyClass;
  verification_scale_interval_e: number;
  scale_interval_unit: string;
  min_capacity: number;
  max_capacity: number;
  capacity_unit: string;
  number_of_intervals_n?: number;
  specifications: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InstrumentComponent {
  component_id: string;
  component_type: string;
  serial_number: string;
  model_name?: string;
  specifications: Record<string, unknown>;
}

export interface Instrument {
  instrument_id: string;
  public_instrument_token: string;
  tenant_id: string;
  jurisdiction_id: string;
  model_id: string;
  owner_id: string;
  facility_id: string;
  serial_number: string;
  year_of_manufacture: number;
  intended_use?: string;
  installation_location_notes?: string;
  current_status: InstrumentStatus;
  latest_certificate_id?: string;
  verification_due_date?: string;
  legacy_trust?: LegacyTrustStatus;
  model?: InstrumentModel;
  components: InstrumentComponent[];
  created_at?: string;
  updated_at?: string;
}

export interface InstrumentRegisterRequest {
  jurisdiction_id: string;
  model_id: string;
  owner_id: string;
  facility_id: string;
  serial_number: string;
  year_of_manufacture: number;
  intended_use?: string;
  installation_location_notes?: string;
}
