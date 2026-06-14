import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-[#2b7567] focus-visible:ring-[3px] focus-visible:ring-[#2b7567]/15 aria-invalid:border-[#8b2f20] aria-invalid:ring-[#8b2f20]/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-[#2b7567] text-white [a&]:hover:bg-[#1f5d52]",
        secondary:
          "border-[#d8d1c2] bg-white text-[#2f2d29] [a&]:hover:bg-[#f7f4ed]",
        destructive:
          "bg-[#8b2f20] text-white focus-visible:ring-[#8b2f20]/20 [a&]:hover:bg-[#742719]",
        outline:
          "border-[#d8d1c2] text-[#211f1a] [a&]:hover:bg-[#f7f4ed]",
        ghost: "[a&]:hover:bg-[#f7f4ed] [a&]:hover:text-[#211f1a]",
        link: "text-[#2b7567] underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
