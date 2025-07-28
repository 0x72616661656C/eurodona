import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
;("use client")

import { useEffect } from "react"

import { useState } from "react"

import { Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react"

export const getStatusColor = (status: string) => {
  const colors = {
    pending: "bg-muted",
    downloading: "bg-foreground",
    completed: "bg-muted",
    error: "bg-muted",
  }
  return colors[status as keyof typeof colors] || "bg-muted"
}

export const getStatusIcon = (status: string) => {
  const icons = {
    pending: Clock,
    downloading: Loader2,
    completed: CheckCircle,
    error: AlertCircle,
  }
  const Icon = icons[status as keyof typeof icons]
  return Icon ? <Icon className={`h-3 w-3 ${status === "downloading" ? "animate-spin" : ""}`} /> : null
}

export const formatFileSize = (size: string) => {
  const match = size.match(/(\d+(?:\.\d+)?)\s*([KMGT]?B)/i)
  if (!match) return size

  const [, value, unit] = match
  const numValue = Number.parseFloat(value)
  return numValue < 10 ? `${numValue.toFixed(1)}${unit}` : `${Math.round(numValue)}${unit}`
}

export const useMediaQuery = (query: string) => {
  const [value, setValue] = useState(false)

  useEffect(() => {
    const result = matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setValue(event.matches)

    result.addEventListener("change", onChange)
    setValue(result.matches)

    return () => result.removeEventListener("change", onChange)
  }, [query])

  return value
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
