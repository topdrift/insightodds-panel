import { prisma } from '../utils/prisma';
import { Role } from '@prisma/client';

// Role hierarchy: SUPER_ADMIN > ADMIN > AGENT > CLIENT
const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  AGENT: 2,
  CLIENT: 1,
};

const CHILD_ROLE_MAP: Record<Role, Role | null> = {
  SUPER_ADMIN: 'ADMIN',
  ADMIN: 'AGENT',
  AGENT: 'CLIENT',
  CLIENT: null,
};

const ROLE_PREFIX: Record<Role, string> = {
  SUPER_ADMIN: 'SA',
  ADMIN: 'AD',
  AGENT: 'AG',
  CLIENT: 'CL',
};

/**
 * Check if parentRole can manage childRole
 */
export function canManage(parentRole: Role, childRole: Role): boolean {
  return ROLE_HIERARCHY[parentRole] > ROLE_HIERARCHY[childRole];
}

/**
 * Get the allowed child role for a given parent role
 */
export function getChildRole(parentRole: Role): Role | null {
  return CHILD_ROLE_MAP[parentRole];
}

/**
 * Generate next username for a role (e.g., SA001, AD002, AG003, CL004)
 */
export async function generateUsername(role: Role): Promise<string> {
  const prefix = ROLE_PREFIX[role];
  const count = await prisma.user.count({ where: { role } });
  const num = (count + 1).toString().padStart(3, '0');
  return `${prefix}${num}`;
}

/**
 * Get suggested username (what would be next)
 */
export async function getSuggestedUsername(role: Role): Promise<string> {
  return generateUsername(role);
}

/**
 * Check if userId is a descendant of ancestorId
 */
export async function isDescendant(userId: string, ancestorId: string): Promise<boolean> {
  let currentId: string | null = userId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === ancestorId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const found: { parentId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = found?.parentId || null;
  }
  return false;
}

/**
 * Check if userId is an ancestor of descendantId
 */
export async function isAncestor(userId: string, descendantId: string): Promise<boolean> {
  return isDescendant(descendantId, userId);
}

/**
 * Get all descendants (children, grandchildren, etc.)
 */
export async function getAllDescendants(userId: string): Promise<string[]> {
  const descendants: string[] = [];
  const queue = [userId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.user.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }
  return descendants;
}

/**
 * Get ancestor chain (parent, grandparent, etc.) up to SUPER_ADMIN
 */
export async function getAncestorChain(userId: string): Promise<Array<{ id: string; role: Role; myPartnership: number; matchCommission: number; sessionCommission: number }>> {
  const ancestors: Array<{ id: string; role: Role; myPartnership: number; matchCommission: number; sessionCommission: number }> = [];
  let currentId: string | null = userId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const cur: { id: string; parentId: string | null; role: Role; myPartnership: any; matchCommission: any; sessionCommission: any } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { id: true, parentId: true, role: true, myPartnership: true, matchCommission: true, sessionCommission: true },
    });
    if (!cur || !cur.parentId) break;

    const par: { id: string; role: Role; myPartnership: any; matchCommission: any; sessionCommission: any } | null = await prisma.user.findUnique({
      where: { id: cur.parentId },
      select: { id: true, role: true, myPartnership: true, matchCommission: true, sessionCommission: true },
    });
    if (!par) break;

    ancestors.push({
      id: par.id,
      role: par.role,
      myPartnership: parseFloat(par.myPartnership.toString()),
      matchCommission: parseFloat(par.matchCommission.toString()),
      sessionCommission: parseFloat(par.sessionCommission.toString()),
    });
    currentId = par.id;
  }
  return ancestors;
}

/**
 * Validate that a user can perform actions on a target user
 */
export async function validateHierarchy(actorId: string, targetId: string): Promise<boolean> {
  if (actorId === targetId) return false;

  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, parentId: true } });

  if (!actor || !target) return false;
  if (!canManage(actor.role, target.role)) return false;

  // SUPER_ADMIN can manage anyone
  if (actor.role === 'SUPER_ADMIN') return true;

  // Others can only manage direct children or descendants
  return isDescendant(targetId, actorId);
}
