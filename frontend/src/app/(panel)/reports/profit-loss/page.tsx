'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { Search, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface ProfitLossEvent {
  id: string;
  eventId: string;
  eventName: string;
  event: string;
  date: string;
  createdAt: string;
  matchPnl: number;
  matchProfitLoss: number;
  fancyPnl: number;
  fancyProfitLoss: number;
  totalPnl: number;
  total: number;
}

export default function ProfitLossPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'AGENT';

  const [filters, setFilters] = useState({
    username: '',
    from: '',
    to: '',
  });
  const [results, setResults] = useState<ProfitLossEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Summary totals
  const [summary, setSummary] = useState({
    totalMatchPnl: 0,
    totalFancyPnl: 0,
    totalPnl: 0,
  });

  const fetchReport = async () => {
    setLoading(true);
    setSearched(true);
    setFetchError(false);
    try {
      const endpoint = isAdmin ? '/admin/profit-loss-report' : '/user/profit-loss-report';
      const payload: any = {
        from: filters.from || undefined,
        to: filters.to || undefined,
      };
      if (isAdmin && filters.username) {
        payload.username = filters.username;
      }
      const { data } = await api.post(endpoint, payload);
      const records: ProfitLossEvent[] = data.records || data.data || data.events || [];
      setResults(records);

      // Calculate summary
      let totalMatchPnl = 0;
      let totalFancyPnl = 0;
      let totalPnl = 0;
      records.forEach((r) => {
        const matchPnl = r.matchPnl ?? r.matchProfitLoss ?? 0;
        const fancyPnl = r.fancyPnl ?? r.fancyProfitLoss ?? 0;
        const total = r.totalPnl ?? r.total ?? (matchPnl + fancyPnl);
        totalMatchPnl += matchPnl;
        totalFancyPnl += fancyPnl;
        totalPnl += total;
      });
      setSummary({ totalMatchPnl, totalFancyPnl, totalPnl });
    } catch (err: any) {
      setFetchError(true);
      addToast(err.response?.data?.error || 'Failed to fetch profit/loss report', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <TrendingUp className="h-6 w-6" />
        Profit & Loss Report
      </h1>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Loading...' : 'Generate Report'}
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
              Results {results.length > 0 && <span className="text-sm font-normal text-gray-400">({results.length} events)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Event</Th>
                  <Th>Match P&L</Th>
                  <Th>Fancy P&L</Th>
                  <Th>Total P&L</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
                        <span className="ml-2">Loading...</span>
                      </div>
                    </Td>
                  </Tr>
                ) : fetchError ? (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8">
                      <p className="text-red-400 mb-3">Failed to load data</p>
                      <Button size="sm" variant="outline" onClick={() => fetchReport()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </Td>
                  </Tr>
                ) : results.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8 text-gray-500">
                      No records found
                    </Td>
                  </Tr>
                ) : (
                  <>
                    {results.map((entry, idx) => {
                      const matchPnl = entry.matchPnl ?? entry.matchProfitLoss ?? 0;
                      const fancyPnl = entry.fancyPnl ?? entry.fancyProfitLoss ?? 0;
                      const totalPnl = entry.totalPnl ?? entry.total ?? (matchPnl + fancyPnl);
                      return (
                        <Tr key={entry.id || entry.eventId || idx}>
                          <Td className="text-xs whitespace-nowrap">
                            {formatDate(entry.createdAt || entry.date)}
                          </Td>
                          <Td className="text-white font-medium max-w-[250px] truncate">
                            {entry.eventName || entry.event || '-'}
                          </Td>
                          <Td className={matchPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            <div className="flex items-center gap-1">
                              {matchPnl >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5" />
                              )}
                              {formatCurrency(matchPnl)}
                            </div>
                          </Td>
                          <Td className={fancyPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            <div className="flex items-center gap-1">
                              {fancyPnl >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5" />
                              )}
                              {formatCurrency(fancyPnl)}
                            </div>
                          </Td>
                          <Td className={totalPnl >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                            {formatCurrency(totalPnl)}
                          </Td>
                        </Tr>
                      );
                    })}

                    {/* Summary Row */}
                    <Tr className="bg-gray-800/80 border-t-2 border-gray-600">
                      <Td colSpan={2} className="text-white font-bold text-right">
                        TOTAL
                      </Td>
                      <Td className={summary.totalMatchPnl >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {formatCurrency(summary.totalMatchPnl)}
                      </Td>
                      <Td className={summary.totalFancyPnl >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {formatCurrency(summary.totalFancyPnl)}
                      </Td>
                      <Td className={summary.totalPnl >= 0 ? 'text-green-400 font-bold text-lg' : 'text-red-400 font-bold text-lg'}>
                        {formatCurrency(summary.totalPnl)}
                      </Td>
                    </Tr>
                  </>
                )}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
