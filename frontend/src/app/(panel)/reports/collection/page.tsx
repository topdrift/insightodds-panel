'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { Search, Wallet } from 'lucide-react';

interface CollectionEntry {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  balance: number;
  creditReference: number;
  creditRef: number;
  totalDeposits: number;
  totalWithdrawals: number;
  deposits: number;
  withdrawals: number;
}

const USER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'CLIENT', label: 'Client' },
];

export default function CollectionReportPage() {
  const { addToast } = useToastStore();

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    username: '',
    userType: '',
  });
  const [results, setResults] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get('/admin/collection-report', {
        params: {
          from: filters.from || undefined,
          to: filters.to || undefined,
          username: filters.username || undefined,
          userType: filters.userType || undefined,
        },
      });
      setResults(data.records || data.data || data || []);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to fetch collection report', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  // Summary calculations
  const totalBalance = results.reduce((acc, r) => acc + (r.balance || 0), 0);
  const totalDeposits = results.reduce((acc, r) => acc + (r.totalDeposits ?? r.deposits ?? 0), 0);
  const totalWithdrawals = results.reduce((acc, r) => acc + (r.totalWithdrawals ?? r.withdrawals ?? 0), 0);

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <Wallet className="h-6 w-6" />
        Collection Report
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
              <Input
                label="Username"
                placeholder="Enter username"
                value={filters.username}
                onChange={(e) => setFilters({ ...filters, username: e.target.value })}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">User Type</label>
                <select
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={filters.userType}
                  onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
                >
                  {USER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
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

      {/* Summary Cards */}
      {searched && results.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-gray-400">Total Balance</p>
              <p className="text-xl font-bold text-[var(--color-secondary)]">
                {formatCurrency(totalBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-gray-400">Total Deposits</p>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(totalDeposits)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-gray-400">Total Withdrawals</p>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(totalWithdrawals)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Results {results.length > 0 && <span className="text-sm font-normal text-gray-400">({results.length} users)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Balance</Th>
                  <Th>Credit Ref</Th>
                  <Th>Total Deposits</Th>
                  <Th>Total Withdrawals</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
                        <span className="ml-2">Loading...</span>
                      </div>
                    </Td>
                  </Tr>
                ) : results.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className="text-center py-8 text-gray-500">
                      No records found
                    </Td>
                  </Tr>
                ) : (
                  results.map((entry, idx) => (
                    <Tr key={entry.id || entry.userId || idx}>
                      <Td>
                        <div>
                          <span className="text-white font-medium">{entry.name}</span>
                          <span className="text-gray-400 text-xs ml-2">@{entry.username}</span>
                        </div>
                      </Td>
                      <Td>
                        <Badge variant="info">{entry.role}</Badge>
                      </Td>
                      <Td className="text-[var(--color-secondary)] font-medium">
                        {formatCurrency(entry.balance || 0)}
                      </Td>
                      <Td>{formatCurrency(entry.creditReference ?? entry.creditRef ?? 0)}</Td>
                      <Td className="text-green-400">
                        {formatCurrency(entry.totalDeposits ?? entry.deposits ?? 0)}
                      </Td>
                      <Td className="text-red-400">
                        {formatCurrency(entry.totalWithdrawals ?? entry.withdrawals ?? 0)}
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
