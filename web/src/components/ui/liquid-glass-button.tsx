import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const LiquidGlassButton = forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(
  ({ className, active, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "btn-liquid-glass relative flex items-center justify-center size-9 shrink-0",
        active && "btn-liquid-glass-active",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
LiquidGlassButton.displayName = "LiquidGlassButton";

export { LiquidGlassButton };
