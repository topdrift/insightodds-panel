import { prisma } from '../utils/prisma';

/**
 * Distribute P&L through the hierarchy using partnership percentages.
 * Each level takes their myPartnership% and the remainder goes up.
 *
 * Example: CLIENT loses 1000, AGENT has 70% partnership
 * - AGENT gets 70% = 700
 * - ADMIN gets remainder (30% = 300) * their partnership %
 * - And so on up to SUPER_ADMIN
 */
export async function distributePartnership(
  userId: string,
  profitLoss: number,
  partnershipType: 'cricket' | 'casino' | 'matka' = 'cricket'
) {
  if (profitLoss === 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentId: true },
  });
  if (!user?.parentId) return;

  let remaining = profitLoss; // positive = platform profit, negative = platform loss
  let currentParentId: string | null = user.parentId;
  const visited = new Set<string>();

  while (currentParentId && Math.abs(remaining) > 0.01) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);

    const parent: { id: string; parentId: string | null; role: string; myPartnership: any; myCasinoPartnership: any; myMatkaPartnership: any } | null = await prisma.user.findUnique({
      where: { id: currentParentId },
      select: {
        id: true,
        parentId: true,
        role: true,
        myPartnership: true,
        myCasinoPartnership: true,
        myMatkaPartnership: true,
      },
    });
    if (!parent) break;

    let partnershipPct = 0;
    if (partnershipType === 'cricket') {
      partnershipPct = parseFloat(parent.myPartnership.toString());
    } else if (partnershipType === 'casino') {
      partnershipPct = parseFloat(parent.myCasinoPartnership.toString());
    } else {
      partnershipPct = parseFloat(parent.myMatkaPartnership.toString());
    }

    // This level's share
    const share = (remaining * partnershipPct) / 100;

    if (Math.abs(share) > 0.01) {
      // If positive = player lost = platform profit → credit to parent
      // If negative = player won = platform loss → debit from parent
      await prisma.$transaction([
        prisma.user.update({
          where: { id: parent.id },
          data: { balance: { increment: share } },
        }),
        prisma.transaction.create({
          data: {
            userId: parent.id,
            type: share >= 0 ? 'PROFIT' : 'LOSS',
            amount: share,
            balance: 0,
            remarks: `Partnership P&L (${partnershipPct}%) from ${partnershipType}`,
          },
        }),
      ]);
    }

    remaining = remaining - share; // What's left goes up
    currentParentId = parent.parentId;
  }
}
