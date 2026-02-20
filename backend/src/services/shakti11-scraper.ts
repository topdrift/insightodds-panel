import axios from 'axios';
import { redis } from '../utils/redis';

const SHAKTI11_CM_BASE = 'https://api.shakti11.com/cm/v1';
const SHAKTI11_AAM_BASE = 'https://api.shakti11.com/aam/v1';

const headers = {
  'Accept': 'application/json',
  'Origin': 'https://shakti11.com',
  'Referer': 'https://shakti11.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:134.0) Gecko/20100101 Firefox/134.0',
};

// ─── INTERFACES ─────────────────────────────────────────────

export interface Shakti11Match {
  cricketId: number;
  gameId: string;
  marketId: string;
  eventId: string;
  eventName: string;
  selectionId1: number;
  runnerName1: string | null;
  selectionId2: number;
  runnerName2: string | null;
  selectionId3: number;
  runnerName3: string | null;
  eventTime: string;
  inPlay: boolean;
  tv: string | null;
  back1: number;
  lay1: number;
  back11: number;
  lay11: number;
  back12: number;
  lay12: number;
  m1: string | null;
  f: string | null;
  vir: number;
  matchType: string | null;
}

export interface OddDetail {
  selectionId: number;
  marketId: string | null;
  runnerName: string;
  back1: string;
  backSize1: string;
  back2: string;
  backSize2: string;
  back3: string;
  backSize3: string;
  lay1: string;
  laySize1: string;
  lay2: string;
  laySize2: string;
  lay3: string;
  laySize3: string;
  status: string;
  maxLimit: number | null;
  remark: string;
}

export interface MarketOdds {
  marketId: string;
  marketStatus: string;
  marketName: string;
  isPlay: string;
  gameType: string | null;
  sid: string | null;
  status: string;
  oddDetailsDTOS: OddDetail[];
}

export interface MatchOddsResponse {
  matchOdds: MarketOdds[];
  bookMakerOdds: any[];
  fancyOdds: MarketOdds[];
}

export interface Shakti11ScoreData {
  score1: string;
  score2: string;
  spnnation1: string;
  spnnation2: string;
  spnrunrate1: string;
  spnrunrate2: string;
  spnreqrate1: string;
  spnreqrate2: string;
  spnmessage: string;
  balls: string[];
  activenation1: string;
  activenation2: string;
  isfinished: string;
  spnballrunningstatus: string;
  dayno: string;
}

// ─── SCRAPER ────────────────────────────────────────────────

class Shakti11Scraper {
  /**
   * Fetch all matches from dashboard (back1/lay1 per team, inPlay status)
   * TTL: 5s
   */
  async getDashboardMatches(): Promise<Shakti11Match[]> {
    const cacheKey = 'shakti11:dashboard';
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    try {
      const { data } = await axios.get(
        `${SHAKTI11_CM_BASE}/cricket/all-matches-dashboard`,
        { headers, timeout: 10000 }
      );

      if (data.status === 'success' && data.code === 200) {
        const matches = data.response as Shakti11Match[];
        try { await redis.setex(cacheKey, 5, JSON.stringify(matches)); } catch {}
        return matches;
      }
      return [];
    } catch (error: any) {
      console.error('Shakti11 dashboard fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch full 3-deep odds + bookmaker + fancy for a specific match
   * TTL: 3s
   */
  async getMatchOdds(cricketId: number): Promise<MatchOddsResponse | null> {
    const cacheKey = `shakti11:odds:${cricketId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    try {
      const { data } = await axios.get(
        `${SHAKTI11_CM_BASE}/cricket/odds/${cricketId}`,
        { headers, timeout: 10000 }
      );

      if (data.status === 'success' && data.code === 200) {
        const odds = data.response as MatchOddsResponse;
        try { await redis.setex(cacheKey, 3, JSON.stringify(odds)); } catch {}
        return odds;
      }
      return null;
    } catch (error: any) {
      console.error(`Shakti11 odds fetch failed for ${cricketId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch live score data
   * TTL: 5s
   */
  async fetchScore(eventId: string): Promise<Shakti11ScoreData | null> {
    const cacheKey = `shakti11:score:${eventId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    try {
      const { data } = await axios.post(
        `${SHAKTI11_AAM_BASE}/auth/score-sport2?eventId=${eventId}`,
        null,
        { headers, timeout: 8000 }
      );

      if (data.status === 'success' && data.code === 200 && data.response?.data?.score) {
        const score = data.response.data.score as Shakti11ScoreData;
        try { await redis.setex(cacheKey, 5, JSON.stringify(score)); } catch {}
        return score;
      }
      return null;
    } catch (error: any) {
      console.debug(`Shakti11 score fetch failed for ${eventId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch match list (longer cache)
   * TTL: 30s
   */
  async getAllMatches(): Promise<any> {
    const cacheKey = 'shakti11:all-matches';
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    try {
      const { data } = await axios.get(
        `${SHAKTI11_CM_BASE}/cricket/all-matches`,
        { headers, timeout: 10000 }
      );

      if (data.status === 'success' && data.code === 200) {
        try { await redis.setex(cacheKey, 30, JSON.stringify(data.response)); } catch {}
        return data.response;
      }
      return null;
    } catch (error: any) {
      console.error('Shakti11 all-matches fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Get streaming channel ID for a match
   * TTL: 60s
   */
  async getStreamingUrl(eventId: string): Promise<any> {
    const cacheKey = `shakti11:stream:${eventId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    try {
      const { data } = await axios.get(
        `${SHAKTI11_AAM_BASE}/auth/streaming/${eventId}`,
        { headers, timeout: 10000 }
      );

      if (data.status === 'success' && data.code === 200) {
        try { await redis.setex(cacheKey, 60, JSON.stringify(data.response)); } catch {}
        return data.response;
      }
      return null;
    } catch (error: any) {
      console.debug(`Shakti11 streaming fetch failed for ${eventId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse dashboard matches into enriched format
   */
  async getMatchesWithOdds(): Promise<any[]> {
    const matches = await this.getDashboardMatches();
    return matches
      .filter(m => m.eventName && m.eventName.includes(' v ') && m.cricketId)
      .map(m => {
        const [team1, team2] = m.eventName.trim().split(' v ').map(t => t.trim());
        return {
          cricketId: m.cricketId,
          gameId: m.gameId,
          marketId: m.marketId,
          eventId: m.eventId,
          eventName: m.eventName.trim(),
          team1: team1 || 'TBA',
          team2: team2 || 'TBA',
          eventTime: m.eventTime,
          inPlay: m.inPlay,
          matchType: m.matchType,
          matchOdds: {
            team1Back: m.back1,
            team1Lay: m.lay1,
            drawBack: m.back11,
            drawLay: m.lay11,
            team2Back: m.back12,
            team2Lay: m.lay12,
          },
        };
      });
  }

  /**
   * Get detailed odds with parsed back/lay ladder
   */
  async getDetailedOdds(cricketId: number): Promise<any> {
    const odds = await this.getMatchOdds(cricketId);
    if (!odds) return null;

    return {
      matchOdds: odds.matchOdds.map(mo => ({
        marketId: mo.marketId,
        marketName: mo.marketName,
        status: mo.status,
        isPlay: mo.isPlay === 'true',
        runners: mo.oddDetailsDTOS.map(d => ({
          selectionId: d.selectionId,
          runnerName: d.runnerName,
          back: [
            { price: parseFloat(d.back1) || 0, size: parseFloat(d.backSize1) || 0 },
            { price: parseFloat(d.back2) || 0, size: parseFloat(d.backSize2) || 0 },
            { price: parseFloat(d.back3) || 0, size: parseFloat(d.backSize3) || 0 },
          ],
          lay: [
            { price: parseFloat(d.lay1) || 0, size: parseFloat(d.laySize1) || 0 },
            { price: parseFloat(d.lay2) || 0, size: parseFloat(d.laySize2) || 0 },
            { price: parseFloat(d.lay3) || 0, size: parseFloat(d.laySize3) || 0 },
          ],
          status: d.status,
        })),
      })),
      bookMakerOdds: odds.bookMakerOdds.map((bmo: any) => {
        const bm = bmo.bm1 || bmo;
        return {
          marketId: bm.marketId,
          marketName: bm.marketName,
          status: bm.status,
          runners: bm.oddDetailsDTOS?.map((d: OddDetail) => ({
            selectionId: d.selectionId,
            runnerName: d.runnerName,
            back: { price: parseFloat(d.back1) || 0, size: parseFloat(d.backSize1) || 0 },
            lay: { price: parseFloat(d.lay1) || 0, size: parseFloat(d.laySize1) || 0 },
            status: d.status,
          })) || [],
        };
      }),
      fancyOdds: odds.fancyOdds.flatMap(fo =>
        fo.oddDetailsDTOS.map(d => ({
          marketId: d.marketId || fo.marketId,
          marketName: fo.marketName,
          gameType: fo.gameType,
          selectionId: d.selectionId,
          runnerName: d.runnerName,
          back: parseFloat(d.back1) || 0,
          backSize: parseFloat(d.backSize1) || 0,
          lay: parseFloat(d.lay1) || 0,
          laySize: parseFloat(d.laySize1) || 0,
          status: d.status,
          maxLimit: d.maxLimit,
        }))
      ),
    };
  }
}

export const shakti11Scraper = new Shakti11Scraper();
