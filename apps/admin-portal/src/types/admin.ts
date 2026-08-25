export type EntityKind = 'legal' | 'master';

export interface AdminEntityMeta {
  slug: string;
  label: string;
  kind: EntityKind;
  idField: string | null;
  tenantField?: string;
  writable: string[];
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface OverviewData {
  generated_at: string;
  totals: Record<string, number>;
  applications_by_status: StatusCount[];
  certificates_by_status: StatusCount[];
  sessions_by_status: StatusCount[];
  standards_by_status: StatusCount[];
  instruments_by_status: StatusCount[];
  payments_by_status: StatusCount[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogEntry {
  audit_id: string;
  tenant_id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  correlation_id: string;
  causation_id?: string | null;
  before_state?: string | null;
  after_state?: string | null;
  client_ip?: string | null;
  user_agent?: string | null;
  recorded_at: string;
}

export interface AuditFilter {
  page?: number;
  page_size?: number;
  actor_id?: string;
  action?: string;
  entity_type?: string;
}

export interface HealthData {
  status: string;
  database_connectivity: boolean;
  database_error?: string;
  checked_at: string;
}