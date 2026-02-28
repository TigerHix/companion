import { cn } from "@/lib/utils"
import { LoaderIcon } from "lucide-react"

function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof LoaderIcon>) {
  return (
    <LoaderIcon
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
