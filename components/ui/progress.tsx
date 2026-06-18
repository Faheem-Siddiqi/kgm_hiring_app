import * as React from "react";
import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & { value?: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-transform duration-500"
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </div>
  );
}

export { Progress };
