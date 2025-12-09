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
import { ArrowLeft, Dice6, Search, Save, RotateCcw, Loader2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { fetchPrizes, fetchEntries, fetchStats, fetchAllEntries, updatePrize, resetPrizes, Prize, Entry, StatsResponse } from "@/lib/api";
import { upload } from '@vercel/blob/client';

// Compress and resize image before upload
async function compressImage(file: File, maxSize: number = 512): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      // Resize if larger than maxSize
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: 'image/png' }));
        } else {
          resolve(file);
        }
      }, 'image/png', 0.9);
    };
    img.src = URL.createObjectURL(file);
  });
}

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

      <header className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 bg-card/50 p-4 sm:p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage prizes and participants</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
              <Dice6 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Roll Dice</span>
              <span className="xs:hidden">Roll</span>
            </Button>
          </Link>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="relative z-10 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          <StatsCards stats={stats} isLoading={statsLoading} />
          
          <Tabs defaultValue="participants" className="space-y-4">
            <TabsList>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="prizes">Prizes</TabsTrigger>
            </TabsList>

            <TabsContent value="participants" className="space-y-4">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
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
                    className="gap-2 flex-1 sm:flex-none"
                    size="sm"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Export CSV</span>
                    <span className="sm:hidden">Export</span>
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
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl overflow-hidden">
                            {prize.icon.startsWith('/') || prize.icon.startsWith('http') ? (
                              <img src={prize.icon} alt={prize.name} className="h-10 w-10 object-contain" />
                            ) : (
                              prize.icon
                            )}
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
                        <div className="space-y-2">
                          <Label>Icon (Emoji or Image)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={prize.icon}
                              onChange={(e) => handlePrizeUpdate(prize.id, "icon", e.target.value)}
                              placeholder="🎁 or upload image"
                              className="flex-1"
                            />
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  
                                  // Show loading state
                                  const originalIcon = prize.icon;
                                  handlePrizeUpdate(prize.id, "icon", "⏳");
                                  
                                  try {
                                    // Compress image to 512x512 max before upload
                                    const compressedFile = await compressImage(file, 512);
                                    
                                    const isProduction = window.location.hostname !== 'localhost';
                                    
                                    if (isProduction) {
                                      // Use Vercel Blob client-side upload (bypasses serverless size limits)
                                      const blob = await upload(compressedFile.name, compressedFile, {
                                        access: 'public',
                                        handleUploadUrl: '/api/upload',
                                      });
                                      handlePrizeUpdate(prize.id, "icon", blob.url);
                                    } else {
                                      // Local dev uses multer with FormData
                                      const formData = new FormData();
                                      formData.append('file', compressedFile);
                                      const response = await fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                      });
                                      
                                      if (!response.ok) {
                                        throw new Error('Upload failed');
                                      }
                                      
                                      const data = await response.json();
                                      handlePrizeUpdate(prize.id, "icon", data.url);
                                    }
                                    
                                    toast.success('Image uploaded!');
                                  } catch (error) {
                                    console.error('Upload error:', error);
                                    handlePrizeUpdate(prize.id, "icon", originalIcon);
                                    toast.error('Failed to upload image');
                                  }
                                }}
                              />
                              <Button type="button" variant="outline" size="icon" asChild>
                                <span><Upload className="h-4 w-4" /></span>
                              </Button>
                            </label>
                          </div>
                          {(prize.icon.startsWith('/') || prize.icon.startsWith('http')) ? (
                            <div className="mt-2 flex justify-center">
                              <img src={prize.icon} alt="Prize icon" className="h-16 w-16 object-contain rounded-lg border" />
                            </div>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Upload image (256x256px recommended) or use emoji
                          </p>
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
