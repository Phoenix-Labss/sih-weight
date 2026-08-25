export type StepType =
  | 'ZERO_TEST'
  | 'INCREASING_LOAD'
  | 'DECREASING_LOAD'
  | 'ECCENTRICITY'
  | 'REPEATABILITY'
  | 'TARE_TEST';

export type SessionStatus =
  | 'PLANNED'
  | 'IDENTITY_CONFIRMED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'FINALIZED';

export type VerificationOutcome =
  | 'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
  | 'VERIFICATION_FAILED'
  | 'NEEDS_REVIEW'
  | 'INCOMPLETE_VERIFICATION'
  | 'OUTSIDE_AUTHORIZATION_SCOPE';

export interface ObservationItemInput {
  step_type: StepType;
  step_sequence: number;
  nominal_load: number;
  load_unit?: string;
  raw_indication_reading: number;
  reading_unit?: string;
  normalized_indication?: number;
  repetition_index?: number;
  eccentricity_position?: string;
  delta_L?: number;
}

export interface Observation {
  observation_id: string;
  session_id: string;
  step_type: StepType;
  step_sequence: number;
  nominal_load: number;
  load_unit: string;
  raw_indication_reading: number;
  normalized_indication: number;
  reading_unit: string;
  observed_error: number;
  mpe_allowed: number;
  is_within_mpe: bool_or_boolean;
  repetition_index: number;
  eccentricity_position?: string;
  calculation_trace: Record<string, unknown>;
  is_immutable: boolean;
  recorded_at?: string;
}

type bool_or_boolean = boolean;

export interface SessionReferenceStandard {
  standard_id: string;
  snapshot_calibration_certificate: string;
  snapshot_valid_until: string;
  verified_suitable: boolean;
}

export interface SessionCreateRequest {
  application_id: string;
  instrument_id: string;
  procedure_pack_id?: string;
  scheduled_date: string;
  environmental_temp_celsius?: number;
  environmental_humidity_percent?: number;
}

export interface SessionObservationSubmitRequest {
  reference_standard_ids: string[];
  observations: ObservationItemInput[];
  environmental_temp_celsius?: number;
  environmental_humidity_percent?: number;
}

export interface SessionDispositionRequest {
  outcome: VerificationOutcome;
  disposition_notes?: string;
}

export interface VerificationSession {
  session_id: string;
  tenant_id: string;
  application_id: string;
  instrument_id: string;
  procedure_pack_id: string;
  procedure_pack_checksum: string;
  verifier_id: string;
  verifier_role: string;
  scheduled_date: string;
  actual_test_timestamp?: string;
  test_location_geo?: Record<string, unknown>;
  environmental_temp_celsius?: number;
  environmental_humidity_percent?: number;
  status: SessionStatus;
  automated_evaluation_flag?: boolean;
  outcome?: VerificationOutcome;
  officer_disposition_notes?: string;
  finalized_at?: string;
  reference_standards: SessionReferenceStandard[];
  observations: Observation[];
  created_at?: string;
  updated_at?: string;
}
