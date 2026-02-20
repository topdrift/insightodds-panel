'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { Search, DollarSign } from 'lucide-react';

interface EarningSport {
  sport: string;
  totalBets: number;
  volume: number;
  playerPnl: number;
  platformEarning: number;
}

const ALL_SPORTS = [
  { value: 'CRICKET', label: 'Cricket' },
  { value: 'MATKA', label: 'Matka' },
  { value: 'CASINO', label: 'Casino' },
  { value: 'FOOTBALL', label: 'Football' },
  { value: 'TENNIS', label: 'Tennis' },
];

export default function EarningReportPage() {
  const { addToast } = useToastStore();

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    sports: [] as string[],
  });
  const [results, setResults] = useState<EarningSport[]>([]);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const toggleSport = (sport: string) => {
    setFilters((prev) => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter((s) => s !== sport)
        : [...prev.sports, sport],
    }));
  };

  const fetchReport = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.post('/admin/earning-report', {
        from: filters.from || undefined,
        to: filters.to || undefined,
        sports: filters.sports.length > 0 ? filters.sports : undefined,
      });
      setResults(data.earnings || data.records || data.data || []);
      setCommissionTotal(data.commissionTotal || data.totalCommission || 0);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to fetch earning report', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  // Summary calculations
  const totalBets = results.reduce((acc, r) => acc + (r.totalBets || 0), 0);
  const totalVolume = results.reduce((acc, r) => acc + (r.volume || 0), 0);
  const totalPlayerPnl = results.reduce((acc, r) => acc + (r.playerPnl || 0), 0);
  const totalPlatformEarning = results.reduce((acc, r) => acc + (r.platformEarning || 0), 0);

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <DollarSign className="h-6 w-6" />
        Earning Report
      </h1>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Sports (select multiple)</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SPORTS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleSport(s.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      filters.sports.includes(s.value)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'border border-gray-600 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {filters.sports.length > 0 && (
                <p className="text-xs text-gray-500">
                  Selected: {filters.sports.join(', ')}
                </p>
              )}
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
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Earnings by Sport</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Sport</Th>
                    <Th>Total Bets</Th>
                    <Th>Volume</Th>
                    <Th>Player P&L</Th>
                    <Th>Platform Earning</Th>
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
                  ) : results.length === 0 ? (
                    <Tr>
                      <Td colSpan={5} className="text-center py-8 text-gray-500">
                        No earning data found
                      </Td>
                    </Tr>
                  ) : (
                    <>
                      {results.map((entry, idx) => (
                        <Tr key={entry.sport || idx}>
                          <Td className="text-white font-medium">{entry.sport}</Td>
                          <Td>{entry.totalBets?.toLocaleString() || 0}</Td>
                          <Td>{formatCurrency(entry.volume || 0)}</Td>
                          <Td className={entry.playerPnl >= 0 ? 'text-red-400' : 'text-green-400'}>
                            {formatCurrency(entry.playerPnl || 0)}
                          </Td>
                          <Td className="text-[var(--color-secondary)] font-medium">
                            {formatCurrency(entry.platformEarning || 0)}
                          </Td>
                        </Tr>
                      ))}

                      {/* Total Row */}
                      <Tr className="bg-gray-800/80 border-t-2 border-gray-600">
                        <Td className="text-white font-bold">TOTAL</Td>
                        <Td className="font-bold">{totalBets.toLocaleString()}</Td>
                        <Td className="font-bold">{formatCurrency(totalVolume)}</Td>
                        <Td className={totalPlayerPnl >= 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                          {formatCurrency(totalPlayerPnl)}
                        </Td>
                        <Td className="text-[var(--color-secondary)] font-bold">
                          {formatCurrency(totalPlatformEarning)}
                        </Td>
                      </Tr>
                    </>
                  )}
                </Tbody>
              </Table>
            </CardContent>
          </Card>

          {/* Commission Total Card */}
          {commissionTotal > 0 && (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-gray-400 mb-1">Total Commission</p>
                <p className="text-3xl font-bold text-[var(--color-secondary)]">
                  {formatCurrency(commissionTotal)}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
