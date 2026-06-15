"use client";

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </I18nProvider>
  );
}
