export interface GiftConfig {
  id: number;
  name: string;
  description: string;
  inventory: number;
  icon: string;
}

const DEFAULT_GIFTS: GiftConfig[] = [
  { id: 1, name: "Premium T-Shirt", description: "Exclusive event merchandise", inventory: 50, icon: "👕" },
  { id: 2, name: "Wireless Earbuds", description: "High-quality audio experience", inventory: 20, icon: "🎧" },
  { id: 3, name: "Gift Card $25", description: "Redeemable store credit", inventory: 100, icon: "🎁" },
  { id: 4, name: "Smart Watch", description: "Premium wearable tech", inventory: 10, icon: "⌚" },
  { id: 5, name: "VIP Pass", description: "Access to exclusive sessions", inventory: 30, icon: "🎫" },
  { id: 6, name: "Mystery Box", description: "Surprise premium item", inventory: 40, icon: "📦" },
];

const STORAGE_KEY = "dice-roller-gifts";

export function getGifts(): GiftConfig[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [...DEFAULT_GIFTS];
    }
  }
  return [...DEFAULT_GIFTS];
}

export function saveGifts(gifts: GiftConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gifts));
}

export function updateGiftInventory(giftId: number, newInventory: number): GiftConfig[] {
  const gifts = getGifts();
  const updatedGifts = gifts.map((g) =>
    g.id === giftId ? { ...g, inventory: Math.max(0, newInventory) } : g
  );
  saveGifts(updatedGifts);
  return updatedGifts;
}

export function decrementGiftInventory(giftId: number): GiftConfig[] {
  const gifts = getGifts();
  const updatedGifts = gifts.map((g) =>
    g.id === giftId ? { ...g, inventory: Math.max(0, g.inventory - 1) } : g
  );
  saveGifts(updatedGifts);
  return updatedGifts;
}

export function updateGift(giftId: number, updates: Partial<GiftConfig>): GiftConfig[] {
  const gifts = getGifts();
  const updatedGifts = gifts.map((g) =>
    g.id === giftId ? { ...g, ...updates } : g
  );
  saveGifts(updatedGifts);
  return updatedGifts;
}

export function getActiveGiftIds(): number[] {
  const gifts = getGifts();
  return gifts.filter((g) => g.inventory > 0).map((g) => g.id);
}

export function hasAnyInventory(): boolean {
  return getActiveGiftIds().length > 0;
}

export function resetGifts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getGiftById(id: number): GiftConfig | undefined {
  return getGifts().find((g) => g.id === id);
}
