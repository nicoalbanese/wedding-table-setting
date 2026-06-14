import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-[760] whitespace-nowrap transition-all outline-none focus-visible:border-[#2b7567] focus-visible:ring-[3px] focus-visible:ring-[#2b7567]/15 disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 aria-invalid:border-[#8b2f20] aria-invalid:ring-[#8b2f20]/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[#2b7567] text-white hover:bg-[#1f5d52]",
        destructive:
          "border border-[#e4b5aa] bg-[#fff8f5] text-[#8b2f20] hover:bg-[#ffefe8] focus-visible:ring-[#8b2f20]/20",
        outline:
          "border border-[#d8d1c2] bg-white text-[#2f2d29] shadow-xs hover:border-[#2b7567] hover:bg-[#f7f4ed]",
        secondary:
          "border border-[#d8d1c2] bg-white text-[#2f2d29] hover:border-[#2b7567] hover:bg-[#f7f4ed]",
        ghost:
          "text-[#2f2d29] hover:bg-[#f7f4ed] hover:text-[#211f1a]",
        link: "text-[#2b7567] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
