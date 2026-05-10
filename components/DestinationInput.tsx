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
        `Alamak, we don't recognise "${trimmed}" lah! Try "Melaka", "Penang", "KL", "JB" or "Ipoh" — boleh?`
      );
      return;
    }

    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="space-y-1">
        <label htmlFor="destination" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
          placeholder="e.g. Melaka, Penang, KL..."
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
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
        className="w-full min-h-[44px] rounded-xl bg-amber-500 px-6 py-3 text-base font-semibold text-white active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Jom, loading..." : "Jom Plan! 🗺️"}
      </button>
    </form>
  );
}
