import { Link } from "react-router-dom";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ParticleBackground } from "@/components/ParticleBackground";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Dice6 } from "lucide-react";

export default function Admin() {
  const { theme, toggleTheme } = useTheme();

  const handleGiftsUpdate = () => {
    // This will trigger a refresh when navigating back to the main page
  };

  return (
    <div className="relative min-h-screen bg-background">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Dice Roller</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage gifts and inventory</p>
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

      {/* Main Content */}
      <main className="relative z-10 p-6">
        <div className="mx-auto max-w-6xl">
          <AdminDashboard onGiftsUpdate={handleGiftsUpdate} />
        </div>
      </main>
    </div>
  );
}
