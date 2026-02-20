import { Server as SocketServer } from 'socket.io';
import { prisma } from '../utils/prisma';
import { shakti11Scraper, Shakti11Match } from './shakti11-scraper';

let pollerIO: SocketServer | null = null;
let dashboardTimer: ReturnType<typeof setInterval> | null = null;
let oddsTimer: ReturnType<typeof setInterval> | null = null;
let scoreTimer: ReturnType<typeof setInterval> | null = null;
let hasLiveMatches = false;

function detectMatchType(eventName: string): 'ODI' | 'T20' | 'TEST' {
  const name = eventName.toLowerCase();
  if (name.includes('test') || name.includes('1st test') || name.includes('2nd test')) return 'TEST';
  if (name.includes('odi') || name.includes('50 over')) return 'ODI';
  return 'T20';
}

function isValidMatch(m: Shakti11Match): boolean {
  if (!m.eventName || !m.eventName.includes(' v ')) return false;
  if (!m.cricketId) return false;
  if (m.eventName.includes('Test A v Test B')) return false;
  // Filter tournament headers (all odds 0)
  if (m.marketId === '0' && m.back1 === 0 && m.lay1 === 0 && m.back12 === 0) return false;
  return true;
}

/**
 * Sync dashboard matches — upsert CricketEvent records
 */
async function syncDashboard() {
  try {
    const matches = await shakti11Scraper.getDashboardMatches();
    const valid = matches.filter(isValidMatch);

    let liveCount = 0;

    for (const m of valid) {
      const [team1, team2] = m.eventName.trim().split(' v ').map(t => t.trim());
      const matchType = detectMatchType(m.eventName);

      await prisma.cricketEvent.upsert({
        where: { cricketId: m.cricketId },
        update: {
          eventName: m.eventName.trim(),
          team1: team1 || 'TBA',
          team2: team2 || 'TBA',
          gameId: m.gameId,
          eventId: m.eventId,
          marketId: m.marketId,
          inPlay: m.inPlay,
          matchType,
          matchOddsData: {
            team1Back: m.back1,
            team1Lay: m.lay1,
            drawBack: m.back11,
            drawLay: m.lay11,
            team2Back: m.back12,
            team2Lay: m.lay12,
            selectionId1: m.selectionId1,
            selectionId2: m.selectionId2,
            selectionId3: m.selectionId3,
            runnerName1: m.runnerName1,
            runnerName2: m.runnerName2,
            runnerName3: m.runnerName3,
          },
          updatedAt: new Date(),
        },
        create: {
          cricketId: m.cricketId,
          gameId: m.gameId,
          eventId: m.eventId,
          marketId: m.marketId,
          eventName: m.eventName.trim(),
          team1: team1 || 'TBA',
          team2: team2 || 'TBA',
          matchType,
          inPlay: m.inPlay,
          startTime: m.eventTime ? new Date(m.eventTime) : null,
          matchOddsData: {
            team1Back: m.back1,
            team1Lay: m.lay1,
            drawBack: m.back11,
            drawLay: m.lay11,
            team2Back: m.back12,
            team2Lay: m.lay12,
            selectionId1: m.selectionId1,
            selectionId2: m.selectionId2,
            selectionId3: m.selectionId3,
            runnerName1: m.runnerName1,
            runnerName2: m.runnerName2,
            runnerName3: m.runnerName3,
          },
        },
      });

      if (m.inPlay) liveCount++;
    }

    hasLiveMatches = liveCount > 0;

    // Broadcast dashboard update
    if (pollerIO && valid.length > 0) {
      const enriched = valid.map(m => {
        const [team1, team2] = m.eventName.trim().split(' v ').map(t => t.trim());
        return {
          cricketId: m.cricketId,
          eventName: m.eventName.trim(),
          team1, team2,
          inPlay: m.inPlay,
          back1: m.back1, lay1: m.lay1,
          back12: m.back12, lay12: m.lay12,
          back11: m.back11, lay11: m.lay11,
        };
      });
      pollerIO.emit('matches:updated', enriched);
    }
  } catch (error: any) {
    console.error('Dashboard sync error:', error.message);
  }
}

/**
 * Sync detailed odds for all live matches
 */
async function syncLiveOdds() {
  try {
    const liveEvents = await prisma.cricketEvent.findMany({
      where: { inPlay: true, isActive: true, isSettled: false },
      select: { cricketId: true, eventId: true, oddsDifference: true },
    });

    for (const event of liveEvents) {
      try {
        const odds = await shakti11Scraper.getMatchOdds(event.cricketId);
        if (!odds) continue;

        // Apply oddsDifference manipulation
        const diff = parseFloat(event.oddsDifference.toString());

        if (diff !== 0 && odds.matchOdds) {
          for (const market of Array.isArray(odds.matchOdds) ? odds.matchOdds : [odds.matchOdds]) {
            const runners = (market as any).oddDetailsDTOS || (market as any).runners || [];
            for (const runner of runners) {
              for (const key of ['back1', 'back2', 'back3']) {
                if (runner[key]) runner[key] = Math.max(1.01, runner[key] - diff);
              }
              for (const key of ['lay1', 'lay2', 'lay3']) {
                if (runner[key]) runner[key] = runner[key] + diff;
              }
            }
          }
        }

        // Store manipulated odds data
        await prisma.cricketEvent.update({
          where: { cricketId: event.cricketId },
          data: {
            matchOddsData: odds.matchOdds as any,
            bookmakerData: odds.bookMakerOdds as any,
            fancyOddsData: odds.fancyOdds as any,
          },
        });

        // Broadcast to match room
        if (pollerIO) {
          const parsed = shakti11Scraper.getDetailedOdds(event.cricketId);
          pollerIO.to(`match:${event.cricketId}`).emit(`odds:match:${event.cricketId}`, await parsed);

          if (odds.bookMakerOdds?.length) {
            pollerIO.to(`match:${event.cricketId}`).emit(`odds:bookmaker:${event.cricketId}`, odds.bookMakerOdds);
          }
          if (odds.fancyOdds?.length) {
            pollerIO.to(`match:${event.cricketId}`).emit(`odds:fancy:${event.cricketId}`, odds.fancyOdds);
          }
        }
      } catch (e: any) {
        console.error(`Odds sync error for ${event.cricketId}:`, e.message);
      }
    }
  } catch (error: any) {
    console.error('Live odds sync error:', error.message);
  }
}

/**
 * Sync scores for live matches
 */
async function syncScores() {
  try {
    const liveEvents = await prisma.cricketEvent.findMany({
      where: { inPlay: true, isActive: true, isSettled: false },
      select: { cricketId: true, gameId: true, eventId: true },
    });

    for (const event of liveEvents) {
      try {
        const scoreEventId = event.gameId || event.eventId;
        if (!scoreEventId) continue;

        const score = await shakti11Scraper.fetchScore(scoreEventId);
        if (!score) continue;

        await prisma.cricketEvent.update({
          where: { cricketId: event.cricketId },
          data: { scoreData: score as any },
        });

        if (pollerIO) {
          pollerIO.to(`match:${event.cricketId}`).emit(`score:${event.cricketId}`, score);
        }
      } catch (e: any) {
        console.error(`Score sync error for ${event.cricketId}:`, e.message);
      }
    }
  } catch (error: any) {
    console.error('Score sync error:', error.message);
  }
}

/**
 * Start the polling system
 */
export function startOddsPoller(io: SocketServer) {
  pollerIO = io;
  console.log('Starting odds poller...');

  // Initial sync after 3s delay
  setTimeout(async () => {
    await syncDashboard();
    console.log('Initial dashboard sync complete');

    // Start recurring polls
    setupPollingIntervals();
  }, 3000);
}

function setupPollingIntervals() {
  // Clear existing timers
  if (dashboardTimer) clearInterval(dashboardTimer);
  if (oddsTimer) clearInterval(oddsTimer);
  if (scoreTimer) clearInterval(scoreTimer);

  // Dashboard: 5s live, 15s idle
  dashboardTimer = setInterval(() => {
    syncDashboard();
  }, hasLiveMatches ? 5000 : 15000);

  // Odds: 3s live, not polled idle
  oddsTimer = setInterval(() => {
    if (hasLiveMatches) syncLiveOdds();
  }, 3000);

  // Scores: 5s live, not polled idle
  scoreTimer = setInterval(() => {
    if (hasLiveMatches) syncScores();
  }, 5000);

  // Re-evaluate polling intervals every 30s
  setInterval(() => {
    setupPollingIntervals();
  }, 30000);
}

export function stopOddsPoller() {
  if (dashboardTimer) clearInterval(dashboardTimer);
  if (oddsTimer) clearInterval(oddsTimer);
  if (scoreTimer) clearInterval(scoreTimer);
  pollerIO = null;
  console.log('Odds poller stopped');
}
