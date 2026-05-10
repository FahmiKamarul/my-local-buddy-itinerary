import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MY Buddy — Your Local Malaysian Trip Planner",
  description: "Plan your Malaysian day trip with a local buddy lah!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-amber-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
