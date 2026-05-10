"use client";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center space-y-3">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-[44px] min-w-[44px] px-5 py-2 rounded-full bg-red-600 text-white text-sm font-medium active:scale-95 transition-transform"
        >
          Cuba lagi (Try again)
        </button>
      )}
    </div>
  );
}
