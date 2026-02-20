'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Plane, Spade, Loader2 } from 'lucide-react';

interface CasinoGame {
  id: string;
  gameType: string;
  name: string;
  minBet: string;
  maxBet: string;
  houseEdge: string;
}

const gameIcons: Record<string, any> = {
  AVIATOR: Plane,
  BLACKJACK: Spade,
};

const gameColors: Record<string, { from: string; to: string; shadow: string }> = {
  AVIATOR: { from: 'from-red-500', to: 'to-orange-500', shadow: 'shadow-red-500/20' },
  BLACKJACK: { from: 'from-emerald-500', to: 'to-teal-500', shadow: 'shadow-emerald-500/20' },
};

const gameDescriptions: Record<string, string> = {
  AVIATOR: 'Watch the multiplier fly! Cash out before it crashes to win big.',
  BLACKJACK: 'Classic card game. Beat the dealer to 21 without going bust.',
};

export default function CasinoPage() {
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/casino/games')
      .then((res) => setGames(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Casino</h1>
        <p className="mt-1 text-sm text-white/50">Choose your game and start playing</p>
      </div>

      {/* Game Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => {
          const Icon = gameIcons[game.gameType] || Spade;
          const colors = gameColors[game.gameType] || gameColors.BLACKJACK;
          const description = gameDescriptions[game.gameType] || '';
          const href = `/casino/${game.gameType.toLowerCase()}`;

          return (
            <Link key={game.id} href={href}>
              <div className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.06] hover:shadow-xl ${colors.shadow}`}>
                {/* Gradient Glow Background */}
                <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${colors.from} ${colors.to} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20`} />

                {/* Icon */}
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${colors.from} ${colors.to} shadow-lg`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>

                {/* Info */}
                <h2 className="mt-4 text-xl font-bold text-white">{game.name}</h2>
                <p className="mt-1.5 text-sm text-white/50 leading-relaxed">{description}</p>

                {/* Stats Row */}
                <div className="mt-4 flex items-center gap-4 text-xs text-white/40">
                  <span>Min: {parseFloat(game.minBet).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</span>
                  <span className="h-3 w-px bg-white/10" />
                  <span>Max: {parseFloat(game.maxBet).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</span>
                </div>

                {/* Play Button */}
                <div className={`mt-5 flex items-center justify-center rounded-xl bg-gradient-to-r ${colors.from} ${colors.to} py-2.5 text-sm font-semibold text-white opacity-80 transition-opacity duration-200 group-hover:opacity-100`}>
                  Play Now
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {games.length === 0 && !loading && (
        <div className="flex h-[40vh] items-center justify-center">
          <p className="text-white/40">No casino games available</p>
        </div>
      )}
    </div>
  );
}
