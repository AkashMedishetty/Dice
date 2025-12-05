import { Prize } from "@/lib/api";

interface InventoryStatusProps {
  gifts: Prize[];
}

export function InventoryStatus({ gifts }: InventoryStatusProps) {
  const totalInventory = gifts.reduce((sum, g) => sum + g.inventory, 0);
  const activeGifts = gifts.filter((g) => g.inventory > 0).length;

  return (
    <div className="flex items-center gap-4 rounded-full bg-card/80 px-6 py-3 shadow-card backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        <span className="text-sm font-medium text-muted-foreground">
          {activeGifts}/6 Active
        </span>
      </div>
      <div className="h-4 w-px bg-border" />
      <span className="text-sm font-medium text-muted-foreground">
        {totalInventory} Gifts Remaining
      </span>
    </div>
  );
}
