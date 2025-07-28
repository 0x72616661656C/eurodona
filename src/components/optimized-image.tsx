"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageIcon } from "lucide-react"

interface OptimizedImageProps {
  src?: string
  alt: string
  className?: string
  fallback?: string
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  fallback = "/placeholder.svg?height=300&width=200",
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState(src || fallback)

  useEffect(() => {
    if (src && src !== imageSrc) {
      setImageLoaded(false)
      setImageError(false)
      setImageSrc(src)
    }
  }, [src, imageSrc])

  const handleLoad = useCallback(() => setImageLoaded(true), [])
  const handleError = useCallback(() => {
    setImageError(true)
    setImageSrc(fallback)
  }, [fallback])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Skeleton className="w-full h-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground animate-pulse" />
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc || "/placeholder.svg"}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-300 ${
          imageLoaded ? "opacity-100 group-hover:scale-105" : "opacity-0"
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />

      {imageError && imageSrc === fallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-6 w-6 mx-auto mb-1" />
            <span className="text-xs">Sem imagem</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default OptimizedImage
