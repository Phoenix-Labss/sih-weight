export type PhysicalSealAction = 'SEAL_APPLIED' | 'SEAL_INSPECTED_INTACT' | 'SEAL_BROKEN_RECORDED' | 'SEAL_REPLACED';

export type SealType = 'LEAD_WIRE_SEAL' | 'TAMPER_EVIDENT_STICKER' | 'HEAT_SHRINK_SEAL' | 'SECURITY_LABEL';

export interface PhysicalStampRecordRequest {
  instrument_id?: string;
  action_type?: PhysicalSealAction;
  seal_type?: SealType;
  seal_identification_number: string;
  seal_position: string;
  photo_evidence_hash?: string;
  photo_storage_path?: string;
  notes?: string;
}

export interface PhysicalStamp {
  stamp_action_id: string;
  tenant_id: string;
  session_id: string;
  instrument_id: string;
  verifier_id: string;
  action_type: PhysicalSealAction;
  seal_type: SealType;
  seal_identification_number: string;
  seal_position: string;
  photo_evidence_hash?: string;
  photo_storage_path?: string;
  action_timestamp: string;
  notes?: string;
  created_at?: string;
}
