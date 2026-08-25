import { request, buildQuery } from './http';
import {
  AdminEntityMeta,
  AuditFilter,
  AuditLogEntry,
  HealthData,
  OverviewData,
  Paginated,
} from '../types/admin';

export const adminService = {
  listEntities(): Promise<AdminEntityMeta[]> {
    return request<AdminEntityMeta[]>('/admin/entities');
  },

  overview(): Promise<OverviewData> {
    return request<OverviewData>('/admin/overview');
  },

  browse(entity: string, page = 1, pageSize = 50): Promise<Paginated<Record<string, unknown>>> {
    return request<Paginated<Record<string, unknown>>>(
      `/admin/db/${entity}${buildQuery({ page, page_size: pageSize })}`
    );
  },

  getRecord(entity: string, id: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(`/admin/db/${entity}/${encodeURIComponent(id)}`);
  },

  auditLogs(filter: AuditFilter): Promise<Paginated<AuditLogEntry>> {
    return request<Paginated<AuditLogEntry>>(
      `/admin/audit-logs${buildQuery({
        page: filter.page,
        page_size: filter.page_size,
        actor_id: filter.actor_id,
        action: filter.action,
        entity_type: filter.entity_type,
      })}`
    );
  },

  createMaster(entity: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(`/admin/master/${entity}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMaster(entity: string, id: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(`/admin/master/${entity}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  health(): Promise<HealthData> {
    return request<HealthData>('/admin/health');
  },
};