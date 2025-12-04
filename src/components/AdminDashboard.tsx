import { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { GiftConfig, getGifts, updateGift, resetGifts } from "@/lib/giftStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Save, RotateCcw, Package } from "lucide-react";
import { toast } from "sonner";

interface AdminDashboardProps {
  onGiftsUpdate: () => void;
}

export function AdminDashboard({ onGiftsUpdate }: AdminDashboardProps) {
  const [gifts, setGifts] = useState<GiftConfig[]>([]);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setGifts(getGifts());
  }, []);

  useEffect(() => {
    cardsRef.current.forEach((card, index) => {
      if (card) {
        gsap.fromTo(
          card,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4, delay: index * 0.1, ease: "power2.out" }
        );
      }
    });
  }, [gifts]);

  const handleUpdate = (giftId: number, field: keyof GiftConfig, value: string | number) => {
    const updatedGifts = updateGift(giftId, { [field]: value });
    setGifts(updatedGifts);
  };

  const handleSave = (giftId: number) => {
    toast.success("Gift configuration saved!");
    onGiftsUpdate();
  };

  const handleReset = () => {
    resetGifts();
    setGifts(getGifts());
    onGiftsUpdate();
    toast.success("All gifts reset to default!");
  };

  const totalInventory = gifts.reduce((sum, g) => sum + g.inventory, 0);
  const activeGifts = gifts.filter((g) => g.inventory > 0).length;

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Inventory</p>
              <p className="text-2xl font-bold text-foreground">{totalInventory}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Gifts</p>
              <p className="text-2xl font-bold text-foreground">{activeGifts} / 6</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Quick Actions</p>
              <p className="text-lg font-medium text-foreground">Reset All</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Gifts?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore all gifts to their default names and inventory counts. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Reset All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Gift Configuration Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {gifts.map((gift, index) => (
          <Card
            key={gift.id}
            ref={(el) => (cardsRef.current[index] = el)}
            className={`relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-card ${
              gift.inventory === 0 ? "opacity-60" : ""
            }`}
          >
            {gift.inventory === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                <span className="rounded-full bg-destructive px-4 py-1 text-sm font-medium text-destructive-foreground">
                  Out of Stock
                </span>
              </div>
            )}
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {gift.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">Dice Face {gift.id}</CardTitle>
                  <CardDescription>Configure gift #{gift.id}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`name-${gift.id}`} className="text-sm font-medium text-muted-foreground">
                  Gift Name
                </Label>
                <Input
                  id={`name-${gift.id}`}
                  value={gift.name}
                  onChange={(e) => handleUpdate(gift.id, "name", e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`desc-${gift.id}`} className="text-sm font-medium text-muted-foreground">
                  Description
                </Label>
                <Input
                  id={`desc-${gift.id}`}
                  value={gift.description}
                  onChange={(e) => handleUpdate(gift.id, "description", e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`icon-${gift.id}`} className="text-sm font-medium text-muted-foreground">
                    Icon (Emoji)
                  </Label>
                  <Input
                    id={`icon-${gift.id}`}
                    value={gift.icon}
                    onChange={(e) => handleUpdate(gift.id, "icon", e.target.value)}
                    className="bg-background/50 text-center text-xl"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`inv-${gift.id}`} className="text-sm font-medium text-muted-foreground">
                    Inventory
                  </Label>
                  <Input
                    id={`inv-${gift.id}`}
                    type="number"
                    min={0}
                    value={gift.inventory}
                    onChange={(e) => handleUpdate(gift.id, "inventory", parseInt(e.target.value) || 0)}
                    className="bg-background/50"
                  />
                </div>
              </div>
              <Button
                onClick={() => handleSave(gift.id)}
                className="w-full"
                size="sm"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
