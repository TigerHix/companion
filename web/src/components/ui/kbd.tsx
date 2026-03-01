import { cn } from "@/lib/utils"

function Kbd({
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-muted text-muted-foreground border-border",
        "inline-flex h-5 items-center justify-center rounded-[4px] border px-1.5",
        "text-xs font-medium font-mono leading-none select-none",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
