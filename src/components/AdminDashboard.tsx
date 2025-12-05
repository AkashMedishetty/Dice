import { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { fetchPrizes, updatePrize, resetPrizes, Prize } from "@/lib/api";
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
import { Save, RotateCcw, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AdminDashboardProps {
  onGiftsUpdate: () => void;
}

export function AdminDashboard({ onGiftsUpdate }: AdminDashboardProps) {
  const [gifts, setGifts] = useState<Prize[]>([]);
  const [localEdits, setLocalEdits] = useState<Record<number, Partial<Prize>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [isResetting, setIsResetting] = useState(false);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadPrizes();
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

  const loadPrizes = async () => {
    try {
      setIsLoading(true);
      const response = await fetchPrizes();
      setGifts(response.prizes);
      setLocalEdits({});
    } catch (error) {
      toast.error("Failed to load prizes");
      console.error("Failed to load prizes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = (giftId: number, field: keyof Prize, value: string | number) => {
    setLocalEdits(prev => ({
      ...prev,
      [giftId]: {
        ...prev[giftId],
        [field]: value,
      }
    }));
  };

  const getDisplayValue = (gift: Prize, field: keyof Prize) => {
    const edit = localEdits[gift.id];
    if (edit && field in edit) {
      return edit[field];
    }
    return gift[field];
  };

  const handleSave = async (giftId: number) => {
    const edits = localEdits[giftId];
    if (!edits || Object.keys(edits).length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      setSavingIds(prev => new Set(prev).add(giftId));
      const response = await updatePrize(giftId, edits);
      
      if (response.success) {
        setGifts(prev => prev.map(g => g.id === giftId ? response.prize : g));
        setLocalEdits(prev => {
          const newEdits = { ...prev };
          delete newEdits[giftId];
          return newEdits;
        });
        toast.success("Gift configuration saved!");
        onGiftsUpdate();
      }
    } catch (error) {
      toast.error("Failed to save changes");
      console.error("Failed to save prize:", error);
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(giftId);
        return newSet;
      });
    }
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      const response = await resetPrizes();
      
      if (response.success) {
        setGifts(response.prizes);
        setLocalEdits({});
        onGiftsUpdate();
        toast.success("All gifts reset to default!");
      }
    } catch (error) {
      toast.error("Failed to reset prizes");
      console.error("Failed to reset prizes:", error);
    } finally {
      setIsResetting(false);
    }
  };

  const totalInventory = gifts.reduce((sum, g) => sum + g.inventory, 0);
  const activeGifts = gifts.filter((g) => g.inventory > 0).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                <Button variant="outline" size="icon" className="h-10 w-10" disabled={isResetting}>
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
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
        {gifts.map((gift, index) => {
          const displayInventory = getDisplayValue(gift, 'inventory') as number;
          const isSaving = savingIds.has(gift.id);
          const hasChanges = localEdits[gift.id] && Object.keys(localEdits[gift.id]).length > 0;
          
          return (
            <Card
              key={gift.id}
              ref={(el) => (cardsRef.current[index] = el)}
              className={`relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-card ${
                displayInventory === 0 ? "opacity-60" : ""
              }`}
            >
              {displayInventory === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                  <span className="rounded-full bg-destructive px-4 py-1 text-sm font-medium text-destructive-foreground">
                    Out of Stock
                  </span>
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    {getDisplayValue(gift, 'icon')}
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
                    value={getDisplayValue(gift, 'name') as string}
                    onChange={(e) => handleUpdate(gift.id, "name", e.target.value)}
                    className="bg-background/50"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`desc-${gift.id}`} className="text-sm font-medium text-muted-foreground">
                    Description
                  </Label>
                  <Input
                    id={`desc-${gift.id}`}
                    value={getDisplayValue(gift, 'description') as string}
                    onChange={(e) => handleUpdate(gift.id, "description", e.target.value)}
                    className="bg-background/50"
                    disabled={isSaving}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`icon-${gift.id}`} className="text-sm font-medium text-muted-foreground">
                      Icon (Emoji)
                    </Label>
                    <Input
                      id={`icon-${gift.id}`}
                      value={getDisplayValue(gift, 'icon') as string}
                      onChange={(e) => handleUpdate(gift.id, "icon", e.target.value)}
                      className="bg-background/50 text-center text-xl"
                      maxLength={2}
                      disabled={isSaving}
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
                      value={displayInventory}
                      onChange={(e) => handleUpdate(gift.id, "inventory", parseInt(e.target.value) || 0)}
                      className="bg-background/50"
                      disabled={isSaving}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleSave(gift.id)}
                  className="w-full"
                  size="sm"
                  disabled={isSaving || !hasChanges}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
