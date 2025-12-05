import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Dice6 } from "lucide-react";
import { validateEmail } from "@/lib/validation";

interface EmailModalProps {
  isOpen: boolean;
  onSubmit: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}

export function EmailModal({ isOpen, onSubmit, onCancel, isLoading, error }: EmailModalProps) {
  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      setValidationError("Please enter a valid email address");
      return;
    }
    
    setValidationError("");
    onSubmit(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validationError) {
      setValidationError("");
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail("");
      setValidationError("");
      onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dice6 className="h-5 w-5 text-primary" />
            Ready to Roll?
          </DialogTitle>
          <DialogDescription>
            Enter your email to participate and win exciting prizes!
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={handleEmailChange}
                className="pl-10"
                disabled={isLoading}
                autoFocus
              />
            </div>
            {(validationError || error) && (
              <p className="text-sm text-destructive">{validationError || error}</p>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !email}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rolling...
                </>
              ) : (
                <>
                  <Dice6 className="mr-2 h-4 w-4" />
                  Roll the Dice!
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
