import React, { createContext, useContext, useState } from 'react';
import { RoleType, UserContextData } from '../types/api';
import { env } from '../config/env';

interface AuthContextType {
  user: UserContextData;
  switchRole: (role: RoleType) => void;
  setTenant: (tenantId: string) => void;
}

const roleProfiles: Record<RoleType, Partial<UserContextData>> = {
  OWNER: {
    actorId: 'usr-trader-01',
    actorRole: 'OWNER',
    actorName: 'Rajesh Kumar (Star Hypermarket)',
    organizationName: 'Star Retail Ventures Pvt. Ltd.',
  },
  APPLICANT: {
    actorId: 'usr-applicant-02',
    actorRole: 'APPLICANT',
    actorName: 'Suresh Verma (Authorized Dealer)',
    organizationName: 'Verma Scales & Equipment',
  },
  LMO: {
    actorId: 'lmo-officer-01',
    actorRole: 'LMO',
    actorName: 'Inspector Amit Sharma',
    organizationName: 'Legal Metrology Dept, Central Delhi Zone',
  },
  GATC_VERIFIER: {
    actorId: 'gatc-verifier-01',
    actorRole: 'GATC_VERIFIER',
    actorName: 'Dr. Priya Nair (GATC Technical Lead)',
    organizationName: 'National Metrology Testing Centre (GATC #42)',
  },
  SUPERVISOR: {
    actorId: 'sup-officer-01',
    actorRole: 'SUPERVISOR',
    actorName: 'Assistant Controller K. S. Rao',
    organizationName: 'Delhi State Legal Metrology Commission',
  },
  CONTROLLER: {
    actorId: 'controller-delhi',
    actorRole: 'CONTROLLER',
    actorName: 'Controller of Legal Metrology (HQ)',
    organizationName: 'Department of Consumer Affairs, Govt. of NCT of Delhi',
  },
  ADMIN: {
    actorId: 'adm-system-01',
    actorRole: 'ADMIN',
    actorName: 'National System Administrator',
    organizationName: 'Ministry of Consumer Affairs, Food & Public Distribution',
  },
  PUBLIC: {
    actorId: 'public-anonymous',
    actorRole: 'PUBLIC',
    actorName: 'Citizen / Consumer / Inspector',
    organizationName: 'Public Verification Interface',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<RoleType>('OWNER');
  const [tenantId, setTenantId] = useState<string>(env.DEFAULT_TENANT_ID);

  const profile = roleProfiles[currentRole];

  const user: UserContextData = {
    actorId: profile.actorId || 'usr-trader-01',
    actorRole: currentRole,
    actorName: profile.actorName || 'User',
    tenantId: tenantId,
    jurisdictionId: env.DEFAULT_JURISDICTION_ID,
    organizationName: profile.organizationName || 'e-Metrology System',
  };

  const switchRole = (role: RoleType) => {
    setCurrentRole(role);
    try {
      localStorage.setItem('auth_role', role);
      const p = roleProfiles[role];
      if (p.actorId) localStorage.setItem('auth_actor_id', p.actorId);
    } catch {
      // Ignore
    }
  };

  const setTenant = (newTenantId: string) => {
    setTenantId(newTenantId);
    try {
      localStorage.setItem('auth_tenant_id', newTenantId);
    } catch {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, switchRole, setTenant }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
