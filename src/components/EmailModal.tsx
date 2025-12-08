import { useState } from "react";
import { Loader2, Dice6 } from "lucide-react";

interface EmailModalProps {
  isOpen: boolean;
  onSubmit: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}

export function EmailModal({ isOpen, onSubmit, onCancel, isLoading, error }: EmailModalProps) {
  const [emailPrefix, setEmailPrefix] = useState("");
  const [validationError, setValidationError] = useState("");

  const fullEmail = emailPrefix ? `${emailPrefix}@salesforce.com` : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailPrefix.trim()) {
      setValidationError("Please enter your email username");
      return;
    }

    // Basic validation for the prefix (alphanumeric, dots, underscores, hyphens)
    const prefixRegex = /^[a-zA-Z0-9._-]+$/;
    if (!prefixRegex.test(emailPrefix)) {
      setValidationError("Please enter a valid email username");
      return;
    }
    
    setValidationError("");
    onSubmit(fullEmail);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailPrefix(e.target.value);
    if (validationError) {
      setValidationError("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto px-4">
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {/* Email input with @salesforce.com suffix */}
        <div className="relative">
          <div className="flex items-center bg-white rounded-full overflow-hidden shadow-lg">
            <input
              type="text"
              placeholder=""
              value={emailPrefix}
              onChange={handleEmailChange}
              className="flex-1 px-6 py-4 text-gray-700 text-lg outline-none bg-transparent min-w-0"
              disabled={isLoading}
              autoFocus
            />
            <span className="pr-6 text-gray-500 text-lg font-medium whitespace-nowrap">
              @salesforce.com
            </span>
          </div>
          {(validationError || error) && (
            <p className="text-sm text-red-300 mt-2 text-center">{validationError || error}</p>
          )}
        </div>
        
        {/* Roll button */}
        <button
          type="submit"
          disabled={isLoading || !emailPrefix}
          className="w-full flex items-center justify-center gap-3 bg-[#01334c] hover:bg-[#012a3f] text-white rounded-full px-8 py-4 text-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Rolling...
            </>
          ) : (
            <>
              <Dice6 className="h-5 w-5" />
              Roll the dice!
            </>
          )}
        </button>
      </form>
    </div>
  );
}
