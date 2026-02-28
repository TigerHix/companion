import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface BackendBadgeProps extends React.ComponentProps<typeof Badge> {
  backend: "claude" | "codex"
  compact?: boolean
}

const backendStyles = {
  claude: "bg-backend-claude/12 text-backend-claude",
  codex: "bg-backend-codex/12 text-backend-codex",
} as const

export function BackendBadge({
  backend,
  compact = false,
  className,
  children,
  ...props
}: BackendBadgeProps) {
  return (
    <Badge
      data-backend={backend}
      className={cn(
        "border-transparent",
        compact ? "h-4 rounded-md px-1.5 text-[9px] font-semibold leading-none" : "h-5 px-2 text-[10px]",
        backendStyles[backend],
        className,
      )}
      {...props}
    >
      {children ?? (compact ? (backend === "codex" ? "CX" : "CC") : (backend === "codex" ? "Codex" : "Claude"))}
    </Badge>
  )
}
