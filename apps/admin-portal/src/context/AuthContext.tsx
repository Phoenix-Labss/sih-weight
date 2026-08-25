import React, { createContext, useContext } from 'react';
import { env } from '../config/env';

/** Admin portal is ADMIN-role only. No role switcher exists here. */
export interface AdminSession {
  actorId: string;
  role: 'ADMIN';
  tenantId: string;
  jurisdictionId: string;
}

const AdminContext = createContext<AdminSession>({
  actorId: env.ADMIN_ACTOR_ID,
  role: 'ADMIN',
  tenantId: env.DEFAULT_TENANT_ID,
  jurisdictionId: env.DEFAULT_JURISDICTION_ID,
});

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AdminContext.Provider value={{ actorId: env.ADMIN_ACTOR_ID, role: 'ADMIN', tenantId: env.DEFAULT_TENANT_ID, jurisdictionId: env.DEFAULT_JURISDICTION_ID }}>{children}</AdminContext.Provider>;
};

export function useAdminSession(): AdminSession {
  return useContext(AdminContext);
}