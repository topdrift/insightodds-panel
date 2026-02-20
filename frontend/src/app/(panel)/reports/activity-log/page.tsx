'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, Search, Activity, RefreshCw } from 'lucide-react';

interface ActivityLogEntry {
  id: string;
  date: string;
  createdAt: string;
  username: string;
  user: string;
  activityType: string;
  type: string;
  ip: string;
  ipAddress: string;
}

const ACTIVITY_TYPES = [
  { value: '', label: 'All Activities' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'CHANGE_PASSWORD', label: 'Change Password' },
];

export default function ActivityLogPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'AGENT';

  const [filters, setFilters] = useState({
    username: '',
    activityType: '',
    from: '',
    to: '',
    size: 20,
  });
  const [results, setResults] = useState<ActivityLogEntry[]>([]);
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
      const endpoint = isAdmin ? '/admin/activity-log' : '/user/activity-log';
      const payload: any = {
        from: filters.from || undefined,
        to: filters.to || undefined,
        activityType: filters.activityType || undefined,
        page: pg,
        size: filters.size,
      };
      if (isAdmin && filters.username) {
        payload.username = filters.username;
      }
      const { data } = await api.post(endpoint, payload);
      setResults(data.records || data.data || []);
      setTotal(data.total || data.totalCount || 0);
      setPage(pg);
    } catch (err: any) {
      setFetchError(true);
      addToast(err.response?.data?.error || 'Failed to fetch activity logs', 'error');
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
        <Activity className="h-6 w-6" />
        Activity Log
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
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Activity Type</label>
                <select
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={filters.activityType}
                  onChange={(e) => setFilters({ ...filters, activityType: e.target.value })}
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
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
                  <Th>User</Th>
                  <Th>Activity Type</Th>
                  <Th>IP</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={4} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
                        <span className="ml-2">Loading...</span>
                      </div>
                    </Td>
                  </Tr>
                ) : fetchError ? (
                  <Tr>
                    <Td colSpan={4} className="text-center py-8">
                      <p className="text-red-400 mb-3">Failed to load data</p>
                      <Button size="sm" variant="outline" onClick={() => fetchLogs(page)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </Td>
                  </Tr>
                ) : results.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} className="text-center py-8 text-gray-500">
                      No activity logs found
                    </Td>
                  </Tr>
                ) : (
                  results.map((entry, idx) => (
                    <Tr key={entry.id || idx}>
                      <Td className="text-xs whitespace-nowrap">
                        {formatDate(entry.createdAt || entry.date)}
                      </Td>
                      <Td className="text-white font-medium">
                        {entry.username || entry.user || '-'}
                      </Td>
                      <Td>
                        <Badge
                          variant={
                            (entry.activityType || entry.type) === 'LOGIN' ? 'info' :
                            (entry.activityType || entry.type) === 'CHANGE_PASSWORD' ? 'warning' :
                            'default'
                          }
                        >
                          {entry.activityType || entry.type}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-gray-400 font-mono">
                        {entry.ip || entry.ipAddress || '-'}
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
