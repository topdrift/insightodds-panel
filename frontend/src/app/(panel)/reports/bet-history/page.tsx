'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, Search, BarChart3, RefreshCw } from 'lucide-react';

interface BetHistoryEntry {
  id: string;
  date: string;
  createdAt: string;
  eventName: string;
  event: string;
  marketName: string;
  market: string;
  selection: string;
  selectionName: string;
  type: string;
  betType: string;
  amount: number;
  stake: number;
  odds: number;
  pnl: number;
  profitLoss: number;
  status: string;
}

const SPORTS = [
  { value: '', label: 'All Sports' },
  { value: 'CRICKET', label: 'Cricket' },
  { value: 'MATKA', label: 'Matka' },
];

export default function BetHistoryPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'AGENT';

  const [filters, setFilters] = useState({
    username: '',
    from: '',
    to: '',
    sport: '',
    isMatched: true,
    size: 20,
  });
  const [results, setResults] = useState<BetHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchBets = async (pg: number = 1) => {
    setLoading(true);
    setSearched(true);
    setFetchError(false);
    try {
      const endpoint = isAdmin ? '/admin/bet-history' : '/user/bet-history';
      const payload: any = {
        from: filters.from || undefined,
        to: filters.to || undefined,
        sport: filters.sport || undefined,
        isMatched: filters.isMatched,
        page: pg,
        size: filters.size,
      };
      if (isAdmin && filters.username) {
        payload.username = filters.username;
      }
      const { data } = await api.post(endpoint, payload);
      setResults(data.records || data.data || data.bets || []);
      setTotal(data.total || data.totalCount || 0);
      setPage(pg);
    } catch (err: any) {
      setFetchError(true);
      addToast(err.response?.data?.error || 'Failed to fetch bet history', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBets(1);
  };

  const totalPages = Math.ceil(total / filters.size);

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        Bet History
      </h1>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {isAdmin && (
                <Input
                  label="Username"
                  placeholder="Enter username"
                  value={filters.username}
                  onChange={(e) => setFilters({ ...filters, username: e.target.value })}
                />
              )}
              <Input
                label="From Date"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
              <Input
                label="To Date"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Sport</label>
                <select
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={filters.sport}
                  onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
                >
                  {SPORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Matched</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="isMatched"
                      checked={filters.isMatched === true}
                      onChange={() => setFilters({ ...filters, isMatched: true })}
                      className="accent-blue-500"
                    />
                    Matched
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="isMatched"
                      checked={filters.isMatched === false}
                      onChange={() => setFilters({ ...filters, isMatched: false })}
                      className="accent-blue-500"
                    />
                    Unmatched
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Page Size</label>
                <select
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={filters.size}
                  onChange={(e) => setFilters({ ...filters, size: parseInt(e.target.value) })}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Loading...' : 'Search'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Results {total > 0 && <span className="text-sm font-normal text-gray-400">({total} bets)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Event</Th>
                  <Th>Market</Th>
                  <Th>Selection</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                  <Th>Odds</Th>
                  <Th>P&L</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
                        <span className="ml-2">Loading...</span>
                      </div>
                    </Td>
                  </Tr>
                ) : fetchError ? (
                  <Tr>
                    <Td colSpan={9} className="text-center py-8">
                      <p className="text-red-400 mb-3">Failed to load data</p>
                      <Button size="sm" variant="outline" onClick={() => fetchBets(page)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </Td>
                  </Tr>
                ) : results.length === 0 ? (
                  <Tr>
                    <Td colSpan={9} className="text-center py-8 text-gray-500">
                      No bets found
                    </Td>
                  </Tr>
                ) : (
                  results.map((bet, idx) => {
                    const betType = bet.type || bet.betType;
                    const pnl = bet.pnl ?? bet.profitLoss ?? 0;
                    return (
                      <Tr key={bet.id || idx}>
                        <Td className="text-xs whitespace-nowrap">
                          {formatDate(bet.createdAt || bet.date)}
                        </Td>
                        <Td className="text-white text-xs max-w-[150px] truncate">
                          {bet.eventName || bet.event || '-'}
                        </Td>
                        <Td className="text-xs max-w-[120px] truncate">
                          {bet.marketName || bet.market || '-'}
                        </Td>
                        <Td className="text-xs">
                          {bet.selection || bet.selectionName || '-'}
                        </Td>
                        <Td>
                          <Badge variant={betType === 'BACK' ? 'info' : 'danger'}>
                            {betType}
                          </Badge>
                        </Td>
                        <Td>{formatCurrency(bet.amount || bet.stake || 0)}</Td>
                        <Td className="text-white">{bet.odds}</Td>
                        <Td className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {formatCurrency(pnl)}
                        </Td>
                        <Td>
                          <Badge
                            variant={
                              bet.status === 'WON' || bet.status === 'SETTLED' ? 'success' :
                              bet.status === 'LOST' ? 'danger' :
                              bet.status === 'OPEN' || bet.status === 'PENDING' ? 'warning' :
                              'default'
                            }
                          >
                            {bet.status}
                          </Badge>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-700 px-6 py-3 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1 || loading}
                onClick={() => fetchBets(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => fetchBets(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
