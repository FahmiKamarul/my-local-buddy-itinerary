"use client";

import { useState } from "react";
import { isRecognisedLocation } from "@/lib/locations";

interface DestinationInputProps {
  onSubmit: (destination: string) => void;
  loading?: boolean;
}

export default function DestinationInput({ onSubmit, loading }: DestinationInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Eh, enter your destination lah! Where you want to go?");
      return;
    }

    if (!isRecognisedLocation(trimmed)) {
      setError(
        "Alamak, that doesn't look right lah! Type a place name (1–100 characters) — anywhere in Malaysia boleh!"
      );
      return;
    }

    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="space-y-1">
        <label htmlFor="destination" className="block text-sm font-medium text-primary">
          Where you going lah?
        </label>
        <input
          id="destination"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Melaka, Penang, Sarawak, Langkawi..."
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl border border-primary-light/40 bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 transition-all"
          autoComplete="off"
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-600 pt-1">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-xl bg-accent hover:bg-accent-hover px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Jom, loading..." : "Jom Plan! 🗺️"}
      </button>
    </form>
  );
}
