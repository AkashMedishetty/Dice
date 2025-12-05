import { ObjectId } from 'mongodb';

export interface Prize {
  _id?: ObjectId;
  id: number; // Dice face number (1-6)
  name: string;
  description: string;
  icon: string;
  inventory: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Entry {
  _id?: ObjectId;
  email: string;
  prizeId: number;
  prizeName: string;
  prizeIcon: string;
  collected: boolean;
  status: 'reserved' | 'confirmed' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

export interface PrizeResponse {
  id: number;
  name: string;
  description: string;
  icon: string;
  inventory: number;
}

export interface EntryResponse {
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

export interface StatsResponse {
  totalRolls: number;
  collected: number;
  pending: number;
  prizeDistribution: { prizeId: number; name: string; icon: string; count: number }[];
}

export interface RollResponse {
  success: boolean;
  entryId?: string;
  winningFace?: number;
  prize?: PrizeResponse;
  error?: string;
  code?: 'INVALID_EMAIL' | 'NO_INVENTORY' | 'DB_ERROR' | 'NOT_FOUND' | 'CONFLICT';
}

export interface EntriesResponse {
  entries: EntryResponse[];
  total: number;
  page: number;
  totalPages: number;
}

export const DEFAULT_PRIZES: Omit<Prize, '_id' | 'createdAt' | 'updatedAt'>[] = [
  { id: 1, name: "Premium T-Shirt", description: "Exclusive event merchandise", inventory: 50, icon: "👕" },
  { id: 2, name: "Wireless Earbuds", description: "High-quality audio experience", inventory: 20, icon: "🎧" },
  { id: 3, name: "Gift Card $25", description: "Redeemable store credit", inventory: 100, icon: "🎁" },
  { id: 4, name: "Smart Watch", description: "Premium wearable tech", inventory: 10, icon: "⌚" },
  { id: 5, name: "VIP Pass", description: "Access to exclusive sessions", inventory: 30, icon: "🎫" },
  { id: 6, name: "Mystery Box", description: "Surprise premium item", inventory: 40, icon: "📦" },
];
