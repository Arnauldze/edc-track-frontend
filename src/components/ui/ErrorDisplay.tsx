// ══════════════════════════════════════════════════════════════
// ERROR DISPLAY - Reusable error message component
// ══════════════════════════════════════════════════════════════

import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorDisplay({ 
  error, 
  retry,
  className = ""
}: { 
  error: string; 
  retry?: () => void;
  className?: string;
}) {
  return (
    <div className={`p-4 bg-red-50 border border-red-200 rounded-md ${className}`}>
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          {retry && (
            <button
              onClick={retry}
              className="mt-3 flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ErrorPage({ 
  error, 
  retry 
}: { 
  error: string; 
  retry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md w-full">
        <ErrorDisplay error={error} retry={retry} />
      </div>
    </div>
  );
}
