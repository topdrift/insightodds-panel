import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('Admin@123', 10);

  // SUPER_ADMIN
  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      password,
      transactionPassword: password,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      balance: 10000000,
      creditReference: 10000000,
      exposureLimit: 10000000,
      myPartnership: 100,
      myCasinoPartnership: 100,
      myMatkaPartnership: 100,
    },
  });
  console.log(`SUPER_ADMIN created: ${superAdmin.username}`);

  // ADMIN under SUPER_ADMIN
  const admin1 = await prisma.user.upsert({
    where: { username: 'admin1' },
    update: {},
    create: {
      username: 'admin1',
      password,
      transactionPassword: password,
      name: 'Admin One',
      role: 'ADMIN',
      balance: 5000000,
      creditReference: 5000000,
      exposureLimit: 5000000,
      myPartnership: 90,
      myCasinoPartnership: 90,
      myMatkaPartnership: 90,
      matchCommission: 0,
      sessionCommission: 0,
      parentId: superAdmin.id,
    },
  });
  console.log(`ADMIN created: ${admin1.username}`);

  // AGENT 1 under ADMIN
  const agent1 = await prisma.user.upsert({
    where: { username: 'agent1' },
    update: {},
    create: {
      username: 'agent1',
      password,
      transactionPassword: password,
      name: 'Agent One',
      role: 'AGENT',
      balance: 1000000,
      creditReference: 1000000,
      exposureLimit: 1000000,
      myPartnership: 70,
      myCasinoPartnership: 70,
      myMatkaPartnership: 70,
      matchCommission: 5,
      sessionCommission: 5,
      casinoCommission: 2,
      matkaCommission: 2,
      parentId: admin1.id,
    },
  });
  console.log(`AGENT created: ${agent1.username}`);

  // AGENT 2 under ADMIN
  const agent2 = await prisma.user.upsert({
    where: { username: 'agent2' },
    update: {},
    create: {
      username: 'agent2',
      password,
      transactionPassword: password,
      name: 'Agent Two',
      role: 'AGENT',
      balance: 1000000,
      creditReference: 1000000,
      exposureLimit: 1000000,
      myPartnership: 60,
      myCasinoPartnership: 60,
      myMatkaPartnership: 60,
      matchCommission: 3,
      sessionCommission: 3,
      parentId: admin1.id,
    },
  });
  console.log(`AGENT created: ${agent2.username}`);

  // CLIENT 1 under AGENT 1
  const client1 = await prisma.user.upsert({
    where: { username: 'client1' },
    update: {},
    create: {
      username: 'client1',
      password,
      name: 'Client One',
      role: 'CLIENT',
      balance: 50000,
      creditReference: 50000,
      exposureLimit: 50000,
      parentId: agent1.id,
    },
  });
  console.log(`CLIENT created: ${client1.username}`);

  // CLIENT 2 under AGENT 1
  const client2 = await prisma.user.upsert({
    where: { username: 'client2' },
    update: {},
    create: {
      username: 'client2',
      password,
      name: 'Client Two',
      role: 'CLIENT',
      balance: 50000,
      creditReference: 50000,
      exposureLimit: 50000,
      parentId: agent1.id,
    },
  });
  console.log(`CLIENT created: ${client2.username}`);

  // Whitelabel config
  await prisma.whitelabelConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      siteName: 'Shakti11',
      primaryColor: '#1e40af',
      secondaryColor: '#f59e0b',
      accentColor: '#10b981',
      bgColor: '#0f172a',
      cardColor: '#1e293b',
      textColor: '#f8fafc',
      features: { cricket: true, casino: true, matka: false },
    },
  });
  console.log('Whitelabel config created');

  // Casino Games
  await prisma.casinoGame.upsert({
    where: { gameType: 'AVIATOR' },
    update: {},
    create: {
      gameType: 'AVIATOR',
      name: 'Aviator',
      isActive: true,
      minBet: 10,
      maxBet: 100000,
      houseEdge: 3,
      config: { bettingDuration: 10, tickInterval: 100, incrementPerTick: 0.06 },
    },
  });
  console.log('Casino game created: Aviator');

  await prisma.casinoGame.upsert({
    where: { gameType: 'BLACKJACK' },
    update: {},
    create: {
      gameType: 'BLACKJACK',
      name: 'Blackjack',
      isActive: true,
      minBet: 100,
      maxBet: 50000,
      houseEdge: 0.5,
      config: { decks: 6, dealerStandsSoft17: true, blackjackPays: 1.5 },
    },
  });
  console.log('Casino game created: Blackjack');

  // Default announcement
  await prisma.announcement.create({
    data: {
      announcement: 'Welcome to Shakti11! Place your bets on live cricket matches.',
      isActive: true,
      priority: 1,
    },
  });
  console.log('Default announcement created');

  console.log('Seeding complete!');
  console.log('---');
  console.log('Login credentials (all passwords: Admin@123):');
  console.log('  SUPER_ADMIN: superadmin');
  console.log('  ADMIN:       admin1');
  console.log('  AGENT:       agent1, agent2');
  console.log('  CLIENT:      client1, client2');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
