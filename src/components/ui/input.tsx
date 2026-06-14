import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-[#c7bda9] bg-white px-3 py-1 text-base text-[#211f1a] shadow-xs transition-[background,border-color,box-shadow,color] outline-none selection:bg-[#2b7567] selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#211f1a] placeholder:text-[#6f6a60] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[#2b7567] focus-visible:ring-[3px] focus-visible:ring-[#2b7567]/15",
        "aria-invalid:border-[#8b2f20] aria-invalid:ring-[#8b2f20]/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
