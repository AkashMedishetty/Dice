import { StatsResponse } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Package } from "lucide-react";

interface StatsCardsProps {
  stats: StatsResponse | null;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalInventory = stats.prizeDistribution.reduce((sum, p) => sum + p.inventory, 0);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Rolls</p>
            <p className="text-2xl font-bold">{stats.totalRolls}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold">{stats.collected}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
            <Clock className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <Package className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Remaining Inventory</p>
            <p className="text-2xl font-bold">{totalInventory}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PrizeDistribution({ stats }: { stats: StatsResponse | null }) {
  if (!stats) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-4 font-semibold">Prize Distribution</h3>
        <div className="space-y-3">
          {stats.prizeDistribution.map((prize) => {
            const total = prize.count + prize.inventory;
            const percentage = total > 0 ? (prize.count / total) * 100 : 0;
            
            return (
              <div key={prize.prizeId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{prize.icon}</span>
                    <span>{prize.name}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {prize.count} won / {prize.inventory} left
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
