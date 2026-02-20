'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, Search, Database } from 'lucide-react';

type ReportType = 'NEW_USERS' | 'DEPOSITS' | 'WITHDRAWALS' | 'BETS' | 'LOGINS';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'NEW_USERS', label: 'New Users' },
  { value: 'DEPOSITS', label: 'Deposits' },
  { value: 'WITHDRAWALS', label: 'Withdrawals' },
  { value: 'BETS', label: 'Bets' },
  { value: 'LOGINS', label: 'Logins' },
];

const USER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'CLIENT', label: 'Client' },
];

// Column definitions per report type
const COLUMNS: Record<ReportType, { key: string; label: string }[]> = {
  NEW_USERS: [
    { key: 'date', label: 'Date' },
    { key: 'username', label: 'Username' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'parent', label: 'Created By' },
  ],
  DEPOSITS: [
    { key: 'date', label: 'Date' },
    { key: 'username', label: 'Username' },
    { key: 'amount', label: 'Amount' },
    { key: 'balance', label: 'Balance After' },
    { key: 'remark', label: 'Remark' },
  ],
  WITHDRAWALS: [
    { key: 'date', label: 'Date' },
    { key: 'username', label: 'Username' },
    { key: 'amount', label: 'Amount' },
    { key: 'balance', label: 'Balance After' },
    { key: 'remark', label: 'Remark' },
  ],
  BETS: [
    { key: 'date', label: 'Date' },
    { key: 'username', label: 'Username' },
    { key: 'event', label: 'Event' },
    { key: 'market', label: 'Market' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ],
  LOGINS: [
    { key: 'date', label: 'Date' },
    { key: 'username', label: 'Username' },
    { key: 'ip', label: 'IP Address' },
    { key: 'userAgent', label: 'Device' },
  ],
};

export default function DataReportPage() {
  const { addToast } = useToastStore();

  const [filters, setFilters] = useState({
    reportType: 'NEW_USERS' as ReportType,
    from: '',
    to: '',
    userType: '',
    size: 20,
  });
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchReport = async (pg: number = 1) => {
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.post('/admin/data-report', {
        reportType: filters.reportType,
        from: filters.from || undefined,
        to: filters.to || undefined,
        userType: filters.userType || undefined,
        page: pg,
        size: filters.size,
      });
      setResults(data.records || data.data || []);
      setTotal(data.total || data.totalCount || 0);
      setPage(pg);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to fetch data report', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(1);
  };

  const totalPages = Math.ceil(total / filters.size);
  const columns = COLUMNS[filters.reportType];

  const renderCellValue = (row: any, col: { key: string; label: string }) => {
    const value = row[col.key];

    if (col.key === 'date') {
      return (
        <span className="text-xs whitespace-nowrap">
          {formatDate(row.createdAt || row.date || '')}
        </span>
      );
    }
    if (col.key === 'amount') {
      const num = typeof value === 'number' ? value : parseFloat(value) || 0;
      return (
        <span className={num >= 0 ? 'text-green-400' : 'text-red-400'}>
          {formatCurrency(num)}
        </span>
      );
    }
    if (col.key === 'balance') {
      return formatCurrency(typeof value === 'number' ? value : parseFloat(value) || 0);
    }
    if (col.key === 'role' || col.key === 'type') {
      return <Badge variant="info">{value || '-'}</Badge>;
    }
    if (col.key === 'status') {
      return (
        <Badge
          variant={
            value === 'WON' || value === 'SETTLED' ? 'success' :
            value === 'LOST' ? 'danger' :
            value === 'OPEN' || value === 'PENDING' ? 'warning' :
            'default'
          }
        >
          {value || '-'}
        </Badge>
      );
    }
    if (col.key === 'username') {
      return <span className="text-white font-medium">{value || '-'}</span>;
    }
    if (col.key === 'ip') {
      return <span className="font-mono text-xs text-gray-400">{row.ip || row.ipAddress || '-'}</span>;
    }
    if (col.key === 'event') {
      return (
        <span className="text-xs max-w-[150px] truncate block">
          {row.eventName || row.event || '-'}
        </span>
      );
    }
    if (col.key === 'market') {
      return (
        <span className="text-xs max-w-[120px] truncate block">
          {row.marketName || row.market || '-'}
        </span>
      );
    }
    if (col.key === 'remark') {
      return (
        <span className="text-xs text-gray-400 max-w-[200px] truncate block">
          {row.remark || row.remarks || '-'}
        </span>
      );
    }
    if (col.key === 'parent') {
      return <span className="text-xs text-gray-400">{row.parent || row.createdBy || row.parentUsername || '-'}</span>;
    }
    if (col.key === 'userAgent') {
      return (
        <span className="text-xs text-gray-400 max-w-[200px] truncate block">
          {row.userAgent || row.device || '-'}
        </span>
      );
    }
    return value ?? '-';
  };

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <Database className="h-6 w-6" />
        Data Report
      </h1>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Report Type</label>
                <select
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={filters.reportType}
                  onChange={(e) => {
                    setFilters({ ...filters, reportType: e.target.value as ReportType });
                    setSearched(false);
                    setResults([]);
                  }}
                >
                  {REPORT_TYPES.map((t) => (
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
              {REPORT_TYPES.find((t) => t.value === filters.reportType)?.label || 'Report'}
              {total > 0 && <span className="text-sm font-normal text-gray-400 ml-2">({total} records)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  {columns.map((col) => (
                    <Th key={col.key}>{col.label}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={columns.length} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
                        <span className="ml-2">Loading...</span>
                      </div>
                    </Td>
                  </Tr>
                ) : results.length === 0 ? (
                  <Tr>
                    <Td colSpan={columns.length} className="text-center py-8 text-gray-500">
                      No records found
                    </Td>
                  </Tr>
                ) : (
                  results.map((row, idx) => (
                    <Tr key={row.id || idx}>
                      {columns.map((col) => (
                        <Td key={col.key}>
                          {renderCellValue(row, col)}
                        </Td>
                      ))}
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
                onClick={() => fetchReport(page - 1)}
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
                onClick={() => fetchReport(page + 1)}
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
