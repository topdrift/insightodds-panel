export type Portal = 'admin' | 'agent' | 'client';

export function getPortal(): Portal {
  if (typeof window === 'undefined') return 'client';
  const host = window.location.hostname;
  if (host.startsWith('admin.')) return 'admin';
  if (host.startsWith('agent.')) return 'agent';
  return 'client';
}

export function getPortalName(): string {
  const portal = getPortal();
  return { admin: 'Admin Portal', agent: 'Agent Portal', client: 'Client Portal' }[portal];
}

export function getAllowedRoles(): string[] {
  const portal = getPortal();
  return {
    admin: ['SUPER_ADMIN', 'ADMIN'],
    agent: ['AGENT'],
    client: ['CLIENT'],
  }[portal];
}
