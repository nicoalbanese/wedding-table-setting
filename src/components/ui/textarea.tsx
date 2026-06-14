import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-[#c7bda9] bg-white px-3 py-2 text-base text-[#211f1a] shadow-xs transition-[background,border-color,box-shadow,color] outline-none placeholder:text-[#6f6a60] focus-visible:border-[#2b7567] focus-visible:ring-[3px] focus-visible:ring-[#2b7567]/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[#8b2f20] aria-invalid:ring-[#8b2f20]/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
