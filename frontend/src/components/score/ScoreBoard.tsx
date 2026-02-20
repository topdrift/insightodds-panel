'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ScoreData {
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

interface ScoreBoardProps {
  scoreData: ScoreData | null;
  team1?: string;
  team2?: string;
  matchStatus?: 'LIVE' | 'UPCOMING' | 'COMPLETED';
  startTime?: string;
}

const TEAM_COLORS: Record<string, { primary: string; accent: string }> = {
  IND: { primary: '#FF9933', accent: '#138808' },
  AUS: { primary: '#FFCD00', accent: '#003831' },
  ENG: { primary: '#CF081F', accent: '#1C2C5B' },
  PAK: { primary: '#01411C', accent: '#FFFFFF' },
  SA: { primary: '#007A4D', accent: '#FFB81C' },
  NZ: { primary: '#000000', accent: '#FFFFFF' },
  WI: { primary: '#7B0041', accent: '#FFC72C' },
  SL: { primary: '#0C2340', accent: '#FFB81C' },
  BAN: { primary: '#006A4E', accent: '#F42A41' },
  AFG: { primary: '#000000', accent: '#D32011' },
  ZIM: { primary: '#006233', accent: '#FFD200' },
  IRE: { primary: '#169B62', accent: '#FF883E' },
};

function getTeamColor(teamName: string): { primary: string; accent: string } {
  const name = teamName.toUpperCase();
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (name.includes(key)) return color;
  }
  return { primary: '#6366f1', accent: '#818cf8' };
}

function getBallStyle(ball: string): string {
  const b = ball.toString().toUpperCase().trim();
  if (b === 'W' || b === 'WKT') return 'bg-red-500 text-white shadow-glow-red';
  if (b === '4') return 'bg-emerald-500 text-white shadow-glow-green';
  if (b === '6') return 'bg-violet-500 text-white shadow-glow-purple';
  if (b === '0' || b === '.') return 'bg-gray-600/80 text-gray-300';
  if (b.includes('WD') || b.includes('NB') || b.includes('LB') || b.includes('B'))
    return 'bg-amber-500/90 text-gray-900';
  return 'bg-gray-500/60 text-white';
}

export default function ScoreBoard({
  scoreData,
  team1,
  team2,
  matchStatus = 'LIVE',
  startTime,
}: ScoreBoardProps) {
  const team1Name = scoreData?.spnnation1 || team1 || 'Team 1';
  const team2Name = scoreData?.spnnation2 || team2 || 'Team 2';
  const team1Color = useMemo(() => getTeamColor(team1Name), [team1Name]);
  const team2Color = useMemo(() => getTeamColor(team2Name), [team2Name]);

  const isFinished = scoreData?.isfinished === 'true' || scoreData?.isfinished === '1';
  const status = isFinished ? 'COMPLETED' : matchStatus;

  const lastBalls = useMemo(() => {
    if (!scoreData?.balls || scoreData.balls.length === 0) return [];
    return scoreData.balls.slice(-6);
  }, [scoreData?.balls]);

  const isTeam1Batting =
    scoreData?.activenation1 === 'true' || scoreData?.activenation1 === '1';
  const isTeam2Batting =
    scoreData?.activenation2 === 'true' || scoreData?.activenation2 === '1';

  // No score data - show pre-match card
  if (!scoreData) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass">
        <div className="absolute inset-0 bg-gradient-to-br from-back/5 via-transparent to-accent/5" />
        <div className="relative p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Team 1 */}
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${team1Color.primary}, ${team1Color.accent})` }}
                >
                  {(team1 || 'T1').slice(0, 3).toUpperCase()}
                </div>
                <span className="text-base font-semibold text-white">{team1 || 'TBA'}</span>
              </div>

              <span className="text-gray-500 font-medium text-sm">vs</span>

              {/* Team 2 */}
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${team2Color.primary}, ${team2Color.accent})` }}
                >
                  {(team2 || 'T2').slice(0, 3).toUpperCase()}
                </div>
                <span className="text-base font-semibold text-white">{team2 || 'TBA'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status="UPCOMING" />
            </div>
          </div>
          {startTime && (
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-400">
                Match starts at{' '}
                <span className="text-gray-200 font-medium">
                  {new Date(startTime).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-glass">
      {/* Background gradient accents */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-20 -left-20 h-40 w-40 rounded-full blur-3xl opacity-20"
          style={{ background: team1Color.primary }}
        />
        <div
          className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-20"
          style={{ background: team2Color.primary }}
        />
      </div>

      <div className="relative">
        {/* Main score area */}
        <div className="p-4 md:p-5 space-y-3">
          {/* Team 1 Row */}
          <div className={cn(
            'flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300',
            isTeam1Batting
              ? 'bg-glass-light border border-glass-border-light'
              : 'bg-transparent'
          )}>
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${team1Color.primary}, ${team1Color.accent})` }}
              >
                {team1Name.slice(0, 3).toUpperCase()}
              </div>
              <div>
                <span className={cn(
                  'text-sm font-semibold',
                  isTeam1Batting ? 'text-white' : 'text-gray-300'
                )}>
                  {team1Name}
                </span>
                {isTeam1Batting && (
                  <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn(
                'text-lg font-bold tracking-wide font-mono',
                isTeam1Batting ? 'text-white' : 'text-gray-400'
              )}>
                {scoreData.score1 || '-'}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                {scoreData.spnrunrate1 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    RR: <span className="text-gray-300">{scoreData.spnrunrate1}</span>
                  </span>
                )}
                {scoreData.spnreqrate1 && (
                  <span className="text-[10px] text-amber-400/80 font-medium">
                    REQ: <span className="text-amber-300">{scoreData.spnreqrate1}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Team 2 Row */}
          <div className={cn(
            'flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300',
            isTeam2Batting
              ? 'bg-glass-light border border-glass-border-light'
              : 'bg-transparent'
          )}>
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${team2Color.primary}, ${team2Color.accent})` }}
              >
                {team2Name.slice(0, 3).toUpperCase()}
              </div>
              <div>
                <span className={cn(
                  'text-sm font-semibold',
                  isTeam2Batting ? 'text-white' : 'text-gray-300'
                )}>
                  {team2Name}
                </span>
                {isTeam2Batting && (
                  <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn(
                'text-lg font-bold tracking-wide font-mono',
                isTeam2Batting ? 'text-white' : 'text-gray-400'
              )}>
                {scoreData.score2 || '-'}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                {scoreData.spnrunrate2 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    RR: <span className="text-gray-300">{scoreData.spnrunrate2}</span>
                  </span>
                )}
                {scoreData.spnreqrate2 && (
                  <span className="text-[10px] text-amber-400/80 font-medium">
                    REQ: <span className="text-amber-300">{scoreData.spnreqrate2}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ball by ball + Status */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Last 6 balls */}
            {lastBalls.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1">Recent</span>
                {lastBalls.map((ball, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold transition-all',
                      getBallStyle(ball)
                    )}
                  >
                    {ball}
                  </span>
                ))}
              </div>
            )}

            <StatusBadge status={status} />
          </div>
        </div>

        {/* Status message bar */}
        {scoreData.spnmessage && (
          <div className="border-t border-glass-border bg-glass-light px-4 py-2">
            <p className="text-xs font-medium text-center text-amber-300/90 animate-pulse truncate">
              {scoreData.spnmessage}
            </p>
          </div>
        )}

        {/* Day number for test matches */}
        {scoreData.dayno && scoreData.dayno !== '0' && (
          <div className="absolute top-3 right-3">
            <span className="text-[10px] font-medium text-gray-500 bg-glass-medium rounded-full px-2 py-0.5">
              Day {scoreData.dayno}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'LIVE' || status === 'COMPLETED' || status === 'UPCOMING') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
          status === 'LIVE' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          status === 'COMPLETED' && 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
          status === 'UPCOMING' && 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        )}
      >
        {status === 'LIVE' && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        {status}
      </span>
    );
  }
  return null;
}
