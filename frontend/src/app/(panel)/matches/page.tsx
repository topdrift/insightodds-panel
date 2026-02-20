'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { Search, Eye, RefreshCw } from 'lucide-react';

interface MatchOdds {
  team1Back: number;
  team1Lay: number;
  drawBack: number;
  drawLay: number;
  team2Back: number;
  team2Lay: number;
}

interface DashboardMatch {
  cricketId: number;
  gameId: string;
  marketId: string;
  eventId: string;
  eventName: string;
  team1: string;
  team2: string;
  eventTime: string;
  inPlay: boolean;
  matchType: string | null;
  matchOdds: MatchOdds;
}

export default function MatchesListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [matches, setMatches] = useState<DashboardMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cricket/all-matches-dashboard');
      if (data.status === 'success') {
        setMatches(data.data || []);
      }
    } catch {
      addToast('Failed to fetch matches', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const filteredMatches = matches.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.eventName.toLowerCase().includes(q) ||
      m.team1.toLowerCase().includes(q) ||
      m.team2.toLowerCase().includes(q) ||
      String(m.cricketId).includes(q)
    );
  });

  const handleToggleMatch = async (cricketId: number, currentlyActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(cricketId));
    try {
      const flag = !currentlyActive;
      await api.put(
        `/cricket/match-enable-disable?eventId=${cricketId}&flag=${flag}`
      );
      addToast(
        `Match ${flag ? 'enabled' : 'disabled'} successfully`,
        'success'
      );
      // Update local state
      setMatches((prev) =>
        prev.map((m) =>
          m.cricketId === cricketId ? { ...m, isActive: flag } as any : m
        )
      );
    } catch {
      addToast('Failed to toggle match', 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(cricketId);
        return next;
      });
    }
  };

  const formatOdds = (val: number): string => {
    if (!val || val <= 0) return '-';
    return val.toFixed(2);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white">All Matches</h1>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search by name, team, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchMatches}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
        </div>
      ) : filteredMatches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            No matches found
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Event</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th className="text-center">
                    <span className="text-blue-400">Back</span>
                    {' / '}
                    <span className="text-pink-400">Lay</span>
                    {' (T1)'}
                  </Th>
                  <Th className="text-center">
                    <span className="text-blue-400">Back</span>
                    {' / '}
                    <span className="text-pink-400">Lay</span>
                    {' (T2)'}
                  </Th>
                  <Th>Time</Th>
                  {isAdmin && <Th className="text-center">Enable</Th>}
                  <Th className="text-center">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredMatches.map((match) => (
                  <Tr
                    key={match.cricketId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/matches/${match.cricketId}`)}
                  >
                    <Td>
                      <div>
                        <p className="font-medium text-white text-sm">
                          {match.team1}
                          <span className="mx-1.5 text-gray-500">v</span>
                          {match.team2}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {match.cricketId}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      {match.matchType ? (
                        <Badge variant="info">{match.matchType}</Badge>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </Td>
                    <Td>
                      {match.inPlay ? (
                        <Badge variant="success">
                          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="info">Upcoming</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-center gap-1">
                        <span className="inline-block min-w-[48px] rounded bg-[#72bbef] px-2 py-0.5 text-center text-xs font-bold text-gray-900">
                          {formatOdds(match.matchOdds.team1Back)}
                        </span>
                        <span className="inline-block min-w-[48px] rounded bg-[#faa9ba] px-2 py-0.5 text-center text-xs font-bold text-gray-900">
                          {formatOdds(match.matchOdds.team1Lay)}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-center gap-1">
                        <span className="inline-block min-w-[48px] rounded bg-[#72bbef] px-2 py-0.5 text-center text-xs font-bold text-gray-900">
                          {formatOdds(match.matchOdds.team2Back)}
                        </span>
                        <span className="inline-block min-w-[48px] rounded bg-[#faa9ba] px-2 py-0.5 text-center text-xs font-bold text-gray-900">
                          {formatOdds(match.matchOdds.team2Lay)}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(match.eventTime)}
                      </span>
                    </Td>
                    {isAdmin && (
                      <Td className="text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMatch(match.cricketId, true);
                          }}
                          disabled={togglingIds.has(match.cricketId)}
                          className="relative inline-flex h-5 w-9 items-center rounded-full bg-green-600 transition-colors focus:outline-none"
                        >
                          <span className="inline-block h-3.5 w-3.5 translate-x-4 transform rounded-full bg-white transition-transform" />
                        </button>
                      </Td>
                    )}
                    <Td className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/matches/${match.cricketId}`);
                        }}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
