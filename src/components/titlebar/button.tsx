import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Button({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center cursor-pointer transition duration-100 ease-in-out hover:opacity-90 active:scale-95",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
