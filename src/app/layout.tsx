import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/styles.css";
import { AppProviders } from "@/app-providers";

export const metadata: Metadata = {
  title: "Wedding Seating Planner",
  description: "Plan wedding table seating and share saved seating plans.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
