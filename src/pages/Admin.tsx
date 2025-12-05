import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ParticleBackground } from "@/components/ParticleBackground";
import { ParticipantsTable } from "@/components/ParticipantsTable";
import { StatsCards, PrizeDistribution } from "@/components/StatsCards";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Dice6, Search, Save, RotateCcw, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { fetchPrizes, fetchEntries, fetchStats, fetchAllEntries, updatePrize, resetPrizes, Prize, Entry, StatsResponse } from "@/lib/api";

export default function Admin() {
  const { theme, toggleTheme } = useTheme();
  
  // Prizes state
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(true);
  
  // Entries state
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'collected' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  
  // Stats state
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Load prizes
  const loadPrizes = useCallback(async () => {
    setPrizesLoading(true);
    try {
      const data = await fetchPrizes();
      setPrizes(data.prizes);
    } catch (error) {
      toast.error('Failed to load prizes');
    } finally {
      setPrizesLoading(false);
    }
  }, []);

  // Load entries
  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const data = await fetchEntries({
        page,
        limit: 20,
        status: statusFilter,
        search: searchDebounce,
      });
      setEntries(data.entries);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error('Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  }, [page, statusFilter, searchDebounce]);

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrizes();
    loadStats();
  }, [loadPrizes, loadStats]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePrizeUpdate = async (prizeId: number, field: keyof Prize, value: string | number) => {
    const updatedPrizes = prizes.map(p => 
      p.id === prizeId ? { ...p, [field]: value } : p
    );
    setPrizes(updatedPrizes);
  };

  const handlePrizeSave = async (prizeId: number) => {
    const prize = prizes.find(p => p.id === prizeId);
    if (!prize) return;
    
    try {
      await updatePrize(prizeId, {
        name: prize.name,
        description: prize.description,
        icon: prize.icon,
        inventory: prize.inventory,
      });
      toast.success('Prize saved');
      loadStats();
    } catch (error) {
      toast.error('Failed to save prize');
    }
  };

  const handleReset = async () => {
    try {
      const data = await resetPrizes();
      setPrizes(data.prizes);
      toast.success('Prizes reset to defaults');
      loadStats();
    } catch (error) {
      toast.error('Failed to reset prizes');
    }
  };

  const handleStatusChange = () => {
    loadEntries();
    loadStats();
  };

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const allEntries = await fetchAllEntries({
        status: statusFilter,
        search: searchDebounce,
      });

      // Create CSV content
      const headers = ['Email', 'Prize', 'Prize Icon', 'Status', 'Collection Status', 'Date'];
      const rows = allEntries.map(entry => [
        entry.email,
        entry.prizeName,
        entry.prizeIcon,
        entry.status,
        entry.collected ? 'Collected' : 'Pending',
        new Date(entry.createdAt).toLocaleString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `participants-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${allEntries.length} entries to CSV`);
    } catch (error) {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <ParticleBackground />

      <header className="relative z-10 flex items-center justify-between border-b border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage prizes and participants</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <Dice6 className="h-4 w-4" />
              Roll Dice
            </Button>
          </Link>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="relative z-10 p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <StatsCards stats={stats} isLoading={statsLoading} />
          
          <Tabs defaultValue="participants" className="space-y-4">
            <TabsList>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="prizes">Prizes</TabsTrigger>
            </TabsList>

            <TabsContent value="participants" className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={handleExportCSV}
                    disabled={exporting}
                    className="gap-2"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </div>

              <ParticipantsTable
                entries={entries}
                onStatusChange={handleStatusChange}
                isLoading={entriesLoading}
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />

              <PrizeDistribution stats={stats} />
            </TabsContent>

            <TabsContent value="prizes" className="space-y-4">
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Reset All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset All Prizes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will restore all prizes to their default names and inventory counts.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset}>Reset All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {prizesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {prizes.map((prize) => (
                    <Card key={prize.id} className={prize.inventory === 0 ? "opacity-60" : ""}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                            {prize.icon}
                          </div>
                          <div>
                            <CardTitle className="text-lg">Dice Face {prize.id}</CardTitle>
                            <CardDescription>Configure prize #{prize.id}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={prize.name}
                            onChange={(e) => handlePrizeUpdate(prize.id, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={prize.description}
                            onChange={(e) => handlePrizeUpdate(prize.id, "description", e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Icon</Label>
                            <Input
                              value={prize.icon}
                              onChange={(e) => handlePrizeUpdate(prize.id, "icon", e.target.value)}
                              className="text-center text-xl"
                              maxLength={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Inventory</Label>
                            <Input
                              type="number"
                              min={0}
                              value={prize.inventory}
                              onChange={(e) => handlePrizeUpdate(prize.id, "inventory", parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <Button onClick={() => handlePrizeSave(prize.id)} className="w-full" size="sm">
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
