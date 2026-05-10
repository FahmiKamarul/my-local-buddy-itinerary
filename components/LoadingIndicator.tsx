"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Jom, generating your cards lah...",
  "Lepak sekejap, almost done boleh?",
  "Ngam ngam, finding the best spots...",
  "Shiok! Curating your local experience...",
  "On-the-way, just a moment lah...",
  "Makan time soon! Preparing your itinerary...",
  "Santai dulu, good things take time lor...",
];

export default function LoadingIndicator({ message }: { message?: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (message) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [message]);

  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      {/* Spinner */}
      <div className="w-10 h-10 rounded-full border-4 border-primary-light/30 border-t-accent animate-spin" />
      <p className="text-sm text-muted max-w-xs">
        {message ?? MESSAGES[idx]}
      </p>
    </div>
  );
}
