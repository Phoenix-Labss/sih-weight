export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type RoleType = 'OWNER' | 'APPLICANT' | 'LMO' | 'GATC_VERIFIER' | 'SUPERVISOR' | 'CONTROLLER' | 'ADMIN' | 'PUBLIC';

export interface UserContextData {
  actorId: string;
  actorRole: RoleType;
  actorName: string;
  tenantId: string;
  jurisdictionId: string;
  organizationName: string;
}
