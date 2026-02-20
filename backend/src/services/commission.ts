import { prisma } from '../utils/prisma';
import { Sport } from '@prisma/client';

/**
 * Calculate and distribute commission up the hierarchy when a bet is settled.
 * Each level in the hierarchy gets their commission percentage applied.
 */
export async function distributeCommission(
  betId: string,
  userId: string,
  profitLoss: number,
  sport: Sport = 'CRICKET',
  commissionType: 'match' | 'session' = 'match'
) {
  const absPL = Math.abs(profitLoss);
  if (absPL === 0) return;

  // Walk up the hierarchy from the bettor's parent
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentId: true },
  });
  if (!user?.parentId) return;

  let currentParentId: string | null = user.parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);

    const parent: { id: string; parentId: string | null; role: string; matchCommission: any; sessionCommission: any; casinoCommission: any; matkaCommission: any } | null = await prisma.user.findUnique({
      where: { id: currentParentId },
      select: {
        id: true,
        parentId: true,
        role: true,
        matchCommission: true,
        sessionCommission: true,
        casinoCommission: true,
        matkaCommission: true,
      },
    });
    if (!parent) break;

    let rate = 0;
    if (sport === 'CRICKET') {
      rate = commissionType === 'match'
        ? parseFloat(parent.matchCommission.toString())
        : parseFloat(parent.sessionCommission.toString());
    } else if (sport === 'CASINO') {
      rate = parseFloat(parent.casinoCommission.toString());
    } else if (sport === 'MATKA') {
      rate = parseFloat(parent.matkaCommission.toString());
    }

    if (rate > 0) {
      const commissionAmount = (absPL * rate) / 100;

      await prisma.$transaction([
        prisma.commissionRecord.create({
          data: {
            userId: parent.id,
            betId,
            amount: commissionAmount,
            rate,
            sport,
          },
        }),
        prisma.user.update({
          where: { id: parent.id },
          data: { balance: { increment: commissionAmount } },
        }),
        prisma.transaction.create({
          data: {
            userId: parent.id,
            type: 'COMMISSION',
            amount: commissionAmount,
            balance: 0, // Will be set by trigger or recalculated
            remarks: `Commission on bet ${betId} (${rate}%)`,
          },
        }),
      ]);
    }

    currentParentId = parent.parentId;
  }
}
