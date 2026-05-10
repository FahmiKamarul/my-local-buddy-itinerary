"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DestinationInput from "@/components/DestinationInput";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(destination: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Aiyoh, something went wrong lah. Jom try again?");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("mybuddy_deck", JSON.stringify(data.deck));
      sessionStorage.setItem("mybuddy_destination", destination);
      router.push("/swipe");
    } catch {
      setError("Aiyoh, network error lah. Check your connection and try again boleh?");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
      <div className="w-full max-w-sm space-y-8">
        {/* Hero section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-light/20 mb-2">
            <span className="text-3xl">✈️</span>
          </div>
          <h1 className="text-3xl font-bold text-primary">
            MY Buddy
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Your local Malaysian trip planner.<br />
            Discover hidden gems, plan like a local lah!
          </p>
        </div>

        {/* Decorative travel tags */}
        <div className="flex flex-wrap justify-center gap-2">
          {["🏖️ Beaches", "🍜 Street Food", "🏛️ Heritage", "🌿 Nature"].map((tag) => (
            <span
              key={tag}
              className="text-xs px-3 py-1.5 rounded-full bg-surface border border-primary-light/30 text-primary font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Destination input */}
        {!loading && (
          <DestinationInput onSubmit={handleSubmit} loading={loading} />
        )}

        {/* Loading state */}
        {loading && <LoadingIndicator />}

        {/* Error state */}
        {error && (
          <ErrorMessage message={error} onRetry={() => setError(null)} />
        )}
      </div>
    </div>
  );
}
