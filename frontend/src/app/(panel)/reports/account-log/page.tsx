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
import { ChevronLeft, ChevronRight, Search, FileText, RefreshCw } from 'lucide-react';

interface AccountLogEntry {
  id: string;
  date: string;
  createdAt: string;
  type: string;
  amount: number;
  balance: number;
  remark: string;
  remarks: string;
}

const LOG_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAW', label: 'Withdraw' },
  { value: 'BET_PLACED', label: 'Bet Placed' },
  { value: 'BET_SETTLED', label: 'Bet Settled' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'SETTLEMENT', label: 'Settlement' },
];

export default function AccountLogPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'AGENT';

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    username: '',
    type: '',
    size: 20,
  });
  const [results, setResults] = useState<AccountLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchLogs = async (pg: number = 1) => {
    setLoading(true);
    setSearched(true);
    setFetchError(false);
    try {
      if (isAdmin) {
        const { data } = await api.post('/admin/account-log', {
          from: filters.from || undefined,
          to: filters.to || undefined,
          username: filters.username || undefined,
          type: filters.type || undefined,
          page: pg,
          size: filters.size,
        });
        setResults(data.records || data.data || []);
        setTotal(data.total || data.totalCount || 0);
      } else {
        // CLIENT: combine activity-log and coin-history
        const [activityRes, coinRes] = await Promise.all([
          api.post('/user/activity-log', {
            from: filters.from || undefined,
            to: filters.to || undefined,
            page: pg,
            size: filters.size,
          }),
          api.get('/user/coin-history', {
            params: {
              from: filters.from || undefined,
              to: filters.to || undefined,
              page: pg,
              size: filters.size,
            },
          }),
        ]);
        const combined = [
          ...(activityRes.data.records || activityRes.data.data || []),
          ...(coinRes.data.records || coinRes.data.data || []),
        ].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setResults(combined);
        setTotal(combined.length);
      }
      setPage(pg);
    } catch (err: any) {
      setFetchError(true);
      addToast(err.response?.data?.error || 'Failed to fetch account logs', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const totalPages = Math.ceil(total / filters.size);

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <FileText className="h-6 w-6" />
        Account Log
      </h1>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              {isAdmin && (
                <Input
                  label="Username"
                  placeholder="Enter username"
                  value={filters.username}
                  onChange={(e) => setFilters({ ...filters, username: e.target.value })}
                />
              )}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Type</label>
                <select
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  {LOG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
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
              Results {total > 0 && <span className="text-sm font-normal text-gray-400">({total} records)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                  <Th>Balance</Th>
                  <Th>Remarks</Th>
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
                      <Button size="sm" variant="outline" onClick={() => fetchLogs(page)}>
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
                  results.map((entry, idx) => (
                    <Tr key={entry.id || idx}>
                      <Td className="text-xs whitespace-nowrap">
                        {formatDate(entry.createdAt || entry.date)}
                      </Td>
                      <Td>
                        <Badge
                          variant={
                            entry.type === 'DEPOSIT' ? 'success' :
                            entry.type === 'WITHDRAW' ? 'danger' :
                            entry.type === 'COMMISSION' ? 'info' :
                            'default'
                          }
                        >
                          {entry.type}
                        </Badge>
                      </Td>
                      <Td className={entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(entry.amount)}
                      </Td>
                      <Td>{formatCurrency(entry.balance)}</Td>
                      <Td className="text-xs text-gray-400 max-w-[300px] truncate">
                        {entry.remark || entry.remarks || '-'}
                      </Td>
                    </Tr>
                  ))
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
                onClick={() => fetchLogs(page - 1)}
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
                onClick={() => fetchLogs(page + 1)}
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
