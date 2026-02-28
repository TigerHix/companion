import * as React from "react"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-area"
      className={cn(
        "relative overflow-auto",
        // Custom scrollbar styling
        "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
        "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { ScrollArea }
