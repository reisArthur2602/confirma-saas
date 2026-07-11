import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@confirma/ui/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors outline-none cursor-pointer disabled:pointer-events-none disabled:cursor-default [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // .btn-primary
        default:
          "rounded-[9px] bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(47,107,243,0.3)] hover:bg-primary/90 disabled:bg-[#c7d6f7] disabled:text-white disabled:shadow-none",
        // .btn-destructive-solid
        destructive:
          "rounded-lg bg-destructive text-white hover:bg-destructive/90",
        // .btn-destructive (outline)
        outline:
          "rounded-lg border border-[#f2c9c9] bg-background text-destructive hover:bg-destructive/5",
        // .btn-secondary
        secondary:
          "rounded-lg border border-input bg-background text-secondary-foreground hover:bg-accent/50",
        // .btn-dark
        dark: "rounded-lg bg-foreground text-background hover:bg-foreground/90",
        // .btn-ghost
        ghost:
          "p-0 text-primary hover:underline disabled:opacity-50",
        link: "p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        // padding: 10px 18px, font-size: 13.5px
        default: "h-10 px-[18px] py-2.5 text-base has-[>svg]:px-4",
        // padding: 9px 17px, font-size: 12.5px
        secondary: "h-9 px-[17px] py-2 text-sm has-[>svg]:px-3.5",
        // .btn-sm — padding: 5px 11px, font-size: 11.5px, border-radius: 7px
        sm: "h-auto rounded-[7px] px-[11px] py-[5px] text-xs has-[>svg]:px-2.5",
        icon: "size-10",
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
