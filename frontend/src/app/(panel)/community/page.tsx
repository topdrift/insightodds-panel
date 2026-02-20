'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import {
  Trophy, Medal, Crown, MessageCircle, Send, Trash2,
  RefreshCw, Users, TrendingUp, Award,
} from 'lucide-react';

/* ───────────────── Types ───────────────── */

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  name: string;
  totalEarnings: number;
  totalBetVolume: number;
  clientCount: number;
}

interface FeedbackItem {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  user: { id: string; username: string; name: string };
}

/* ───────────────── Rank Icon ───────────────── */

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700/50 text-xs font-bold text-gray-400">{rank}</span>;
}

const rankBg = (rank: number) => {
  if (rank === 1) return 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20';
  if (rank === 2) return 'from-gray-300/10 to-gray-400/5 border-gray-400/20';
  if (rank === 3) return 'from-amber-600/10 to-amber-700/5 border-amber-600/20';
  return 'from-gray-800/40 to-gray-900/40 border-gray-700/30';
};

/* ═══════════════════════════════════════════════
   LEADERBOARD
   ═══════════════════════════════════════════════ */

function Leaderboard() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/community/leaderboard');
      setEntries(data.data || []);
    } catch {
      addToast('Failed to load leaderboard', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          Top 10 Agents
        </h2>
        <Button size="sm" variant="outline" onClick={fetchLeaderboard} className="!rounded-xl">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-700" />
                <div className="flex-1">
                  <div className="h-4 w-1/3 rounded bg-gray-700 mb-1" />
                  <div className="h-3 w-1/2 rounded bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-8 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-gray-500" />
            <p className="text-sm text-gray-400">No leaderboard data available yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isCurrentUser = entry.id === user?.id;
            return (
              <div
                key={entry.id}
                className={`rounded-xl border bg-gradient-to-br backdrop-blur-xl p-4 transition-all ${rankBg(entry.rank)} ${
                  isCurrentUser ? 'ring-2 ring-[var(--color-secondary)]/50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    <RankIcon rank={entry.rank} />
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                      entry.rank <= 3
                        ? 'bg-gradient-to-br from-yellow-500 to-amber-600'
                        : 'bg-gradient-to-br from-gray-600 to-gray-700'
                    }`}>
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{entry.name}</span>
                        {isCurrentUser && <Badge size="sm" variant="info">You</Badge>}
                      </div>
                      <span className="text-[11px] text-gray-500">@{entry.username}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1 justify-end">
                        <TrendingUp className="h-3 w-3" /> Earnings
                      </p>
                      <p className="text-sm font-bold text-green-400">{formatCurrency(entry.totalEarnings)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1 justify-end">
                        <Award className="h-3 w-3" /> Bet Volume
                      </p>
                      <p className="text-sm font-bold text-blue-400">{formatCurrency(entry.totalBetVolume)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1 justify-end">
                        <Users className="h-3 w-3" /> Clients
                      </p>
                      <p className="text-sm font-bold text-white">{entry.clientCount}</p>
                    </div>
                  </div>

                  {/* Mobile stats */}
                  <div className="sm:hidden flex flex-col items-end gap-0.5">
                    <span className="text-xs font-bold text-green-400">{formatCurrency(entry.totalEarnings)}</span>
                    <span className="text-[10px] text-gray-500">{entry.clientCount} clients</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   FEEDBACK WALL
   ═══════════════════════════════════════════════ */

function FeedbackWall() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/community/feedback', { params: { page, size: 20 } });
      setFeedbacks(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      addToast('Failed to load feedback', 'error');
    }
    setLoading(false);
  }, [addToast, page]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setPosting(true);
    try {
      await api.post('/community/feedback', { message: message.trim() });
      setMessage('');
      addToast('Feedback posted', 'success');
      fetchFeedback();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to post', 'error');
    }
    setPosting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/community/feedback/${id}`);
      addToast('Feedback deleted', 'success');
      fetchFeedback();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-[var(--color-secondary)]" />
        Feedback Wall
      </h2>

      {/* Post Form */}
      <form onSubmit={handlePost} className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share your thoughts with the community..."
          maxLength={500}
          className="flex-1 rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none"
        />
        <Button type="submit" disabled={posting || !message.trim()} className="!rounded-xl px-5">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {posting ? 'Posting...' : 'Post'}
        </Button>
      </form>

      {/* Feed */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-full bg-gray-700" />
                <div className="h-4 w-24 rounded bg-gray-700" />
              </div>
              <div className="h-3 w-3/4 rounded bg-gray-700" />
            </div>
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <Card className="!border-dashed">
          <CardContent className="py-8 text-center">
            <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-500" />
            <p className="text-sm text-gray-400">No messages yet. Be the first to post!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((fb) => {
            const isOwner = fb.userId === user?.id;
            const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
            return (
              <div
                key={fb.id}
                className="group rounded-xl border border-gray-700/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl px-4 py-3 transition-all hover:border-gray-600/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-500 text-xs font-bold text-white flex-shrink-0 mt-0.5">
                      {fb.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{fb.user.name}</span>
                        <span className="text-[10px] text-gray-500">@{fb.user.username}</span>
                        <span className="text-[10px] text-gray-600">{formatDate(fb.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">{fb.message}</p>
                    </div>
                  </div>

                  {(isOwner || isAdmin) && (
                    <button
                      onClick={() => handleDelete(fb.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="!rounded-xl">Prev</Button>
              <span className="flex items-center text-sm text-gray-400 px-3">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="!rounded-xl">Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function CommunityPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-lg">
          <MessageCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Community</h1>
          <p className="text-xs text-gray-500">Leaderboard and feedback wall for agents</p>
        </div>
      </div>

      <Leaderboard />
      <FeedbackWall />
    </div>
  );
}
