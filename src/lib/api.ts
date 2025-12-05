const API_BASE = '/api';

export interface Prize {
  id: number;
  name: string;
  description: string;
  icon: string;
  inventory: number;
}

export interface PrizesResponse {
  prizes: Prize[];
  availableFaces: number[];
}

export interface RollResponse {
  success: boolean;
  entryId?: string;
  winningFace?: number;
  prize?: Prize;
  error?: string;
  code?: string;
}

export interface Entry {
  _id: string;
  email: string;
  prizeId: number;
  prizeName: string;
  prizeIcon: string;
  collected: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntriesResponse {
  entries: Entry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StatsResponse {
  totalRolls: number;
  collected: number;
  pending: number;
  prizeDistribution: { prizeId: number; name: string; icon: string; count: number; inventory: number }[];
}

export async function fetchPrizes(): Promise<PrizesResponse> {
  const res = await fetch(`${API_BASE}/prizes`);
  if (!res.ok) throw new Error('Failed to fetch prizes');
  return res.json();
}

export async function updatePrize(id: number, updates: Partial<Prize>): Promise<{ success: boolean; prize: Prize }> {
  const res = await fetch(`${API_BASE}/prizes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update prize');
  return res.json();
}

export async function resetPrizes(): Promise<{ success: boolean; prizes: Prize[] }> {
  const res = await fetch(`${API_BASE}/prizes/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset prizes');
  return res.json();
}

export async function initiateRoll(email: string): Promise<RollResponse> {
  const res = await fetch(`${API_BASE}/roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function confirmRoll(entryId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/roll/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId }),
  });
  return res.json();
}

export async function releaseRoll(entryId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/roll/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId }),
  });
  return res.json();
}

export async function fetchEntries(params: {
  page?: number;
  limit?: number;
  status?: 'all' | 'collected' | 'pending';
  search?: string;
}): Promise<EntriesResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  
  const res = await fetch(`${API_BASE}/entries?${searchParams}`);
  if (!res.ok) throw new Error('Failed to fetch entries');
  return res.json();
}

export async function updateEntryStatus(entryId: string, collected: boolean): Promise<{ success: boolean; entry: Entry }> {
  const res = await fetch(`${API_BASE}/entries/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collected }),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchAllEntries(params: {
  status?: 'all' | 'collected' | 'pending';
  search?: string;
}): Promise<Entry[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '10000'); // High limit to get all entries
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  
  const res = await fetch(`${API_BASE}/entries?${searchParams}`);
  if (!res.ok) throw new Error('Failed to fetch entries');
  const data: EntriesResponse = await res.json();
  return data.entries;
}
