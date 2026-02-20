'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useToastStore } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { ChevronLeft, Percent, Eye } from 'lucide-react';

interface CommissionOverview {
  userId: string;
  username: string;
  name: string;
  role: string;
  sport: string;
  totalCommission: number;
  records: number;
}

interface CommissionDetail {
  id: string;
  eventName: string;
  event: string;
  marketName: string;
  market: string;
  sport: string;
  commission: number;
  amount: number;
  date: string;
  createdAt: string;
}

export default function CommissionReportPage() {
  const { addToast } = useToastStore();

  const [overview, setOverview] = useState<CommissionOverview[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail view
  const [selectedUser, setSelectedUser] = useState<CommissionOverview | null>(null);
  const [details, setDetails] = useState<CommissionDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/commission-report');
      setOverview(data.records || data.data || data || []);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to fetch commission report', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const fetchDetails = async (item: CommissionOverview) => {
    setSelectedUser(item);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/admin/commission-report/${item.userId}`);
      setDetails(data.records || data.data || data || []);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to fetch commission details', 'error');
    }
    setDetailLoading(false);
  };

  const goBack = () => {
    setSelectedUser(null);
    setDetails([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
      </div>
    );
  }

  // Detail View
  if (selectedUser) {
    return (
      <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-white">
            Commission Details - {selectedUser.name} ({selectedUser.username})
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Commission Records
              <Badge variant="info" className="ml-3">{selectedUser.sport}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Event</Th>
                  <Th>Market</Th>
                  <Th>Sport</Th>
                  <Th>Amount</Th>
                  <Th>Commission</Th>
                </Tr>
              </Thead>
              <Tbody>
                {detailLoading ? (
                  <Tr>
                    <Td colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-secondary)] border-t-transparent" />
                        <span className="ml-2">Loading...</span>
                      </div>
                    </Td>
                  </Tr>
                ) : details.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className="text-center py-8 text-gray-500">
                      No commission records found
                    </Td>
                  </Tr>
                ) : (
                  details.map((d, idx) => (
                    <Tr key={d.id || idx}>
                      <Td className="text-xs whitespace-nowrap">
                        {d.createdAt || d.date ? new Date(d.createdAt || d.date).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        }) : '-'}
                      </Td>
                      <Td className="text-white text-xs max-w-[200px] truncate">
                        {d.eventName || d.event || '-'}
                      </Td>
                      <Td className="text-xs">{d.marketName || d.market || '-'}</Td>
                      <Td>
                        <Badge variant="default">{d.sport || '-'}</Badge>
                      </Td>
                      <Td>{formatCurrency(d.amount || 0)}</Td>
                      <Td className="text-[var(--color-secondary)] font-medium">
                        {formatCurrency(d.commission || 0)}
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Overview View
  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <h1 className="mb-6 text-2xl font-bold text-white flex items-center gap-2">
        <Percent className="h-6 w-6" />
        Commission Report
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Commission Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Sport</Th>
                <Th>Total Commission</Th>
                <Th>Records</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {overview.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center py-8 text-gray-500">
                    No commission data found
                  </Td>
                </Tr>
              ) : (
                overview.map((item, idx) => (
                  <Tr key={`${item.userId}-${item.sport}-${idx}`}>
                    <Td>
                      <div>
                        <span className="text-white font-medium">{item.name}</span>
                        <span className="text-gray-400 text-xs ml-2">@{item.username}</span>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant="info">{item.role}</Badge>
                    </Td>
                    <Td>
                      <Badge variant="default">{item.sport}</Badge>
                    </Td>
                    <Td className="text-[var(--color-secondary)] font-medium">
                      {formatCurrency(item.totalCommission || 0)}
                    </Td>
                    <Td className="text-gray-400">{item.records || 0}</Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fetchDetails(item)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="ml-1">Details</span>
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
