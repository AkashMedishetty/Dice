import { ObjectId } from 'mongodb';

export interface Prize {
  _id?: ObjectId;
  id: number;
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

export const DEFAULT_PRIZES: Omit<Prize, '_id' | 'createdAt' | 'updatedAt'>[] = [
  { id: 1, name: "Premium T-Shirt", description: "Exclusive event merchandise", inventory: 50, icon: "👕" },
  { id: 2, name: "Wireless Earbuds", description: "High-quality audio experience", inventory: 20, icon: "🎧" },
  { id: 3, name: "Gift Card $25", description: "Redeemable store credit", inventory: 100, icon: "🎁" },
  { id: 4, name: "Smart Watch", description: "Premium wearable tech", inventory: 10, icon: "⌚" },
  { id: 5, name: "VIP Pass", description: "Access to exclusive sessions", inventory: 30, icon: "🎫" },
  { id: 6, name: "Mystery Box", description: "Surprise premium item", inventory: 40, icon: "📦" },
];

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
