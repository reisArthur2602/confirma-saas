import * as React from "react"

import { cn } from "@confirma/ui/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // .input-base — padding: 10px 13px, border-radius: 9px, font-size: 13px
        "flex h-10 w-full min-w-0 rounded-[9px] border border-input bg-background px-3.25 py-2.5 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // focus: border-color #2f6bf3 + box-shadow 0 0 0 3px rgba(47,107,243,.12)
        "focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(47,107,243,0.12)]",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_rgba(209,60,60,0.12)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
