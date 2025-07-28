"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon, Move } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  resizable = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  resizable?: boolean
}) {
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const [resizeDirection, setResizeDirection] = React.useState<string>("")
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent, direction: string) => {
    if (!resizable) return

    e.preventDefault()
    setIsResizing(true)
    setResizeDirection(direction)

    const rect = contentRef.current?.getBoundingClientRect()
    if (rect) {
      setSize({ width: rect.width, height: rect.height })
      setPosition({ x: rect.left, y: rect.top })
    }
  }

  const handleDragStart = (e: React.MouseEvent) => {
    if (!resizable) return

    e.preventDefault()
    setIsDragging(true)

    const rect = contentRef.current?.getBoundingClientRect()
    if (rect) {
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizable) return

      if (isResizing && contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect()
        let newWidth = size.width
        let newHeight = size.height
        let newX = position.x
        let newY = position.y

        if (resizeDirection.includes("right")) {
          newWidth = e.clientX - rect.left
        }
        if (resizeDirection.includes("left")) {
          newWidth = rect.right - e.clientX
          newX = e.clientX
        }
        if (resizeDirection.includes("bottom")) {
          newHeight = e.clientY - rect.top
        }
        if (resizeDirection.includes("top")) {
          newHeight = rect.bottom - e.clientY
          newY = e.clientY
        }

        // Limites mínimos
        newWidth = Math.max(300, newWidth)
        newHeight = Math.max(200, newHeight)

        // Limites máximos (viewport)
        newWidth = Math.min(window.innerWidth - 40, newWidth)
        newHeight = Math.min(window.innerHeight - 40, newHeight)

        contentRef.current.style.width = `${newWidth}px`
        contentRef.current.style.height = `${newHeight}px`

        if (resizeDirection.includes("left") || resizeDirection.includes("top")) {
          contentRef.current.style.left = `${newX}px`
          contentRef.current.style.top = `${newY}px`
          contentRef.current.style.transform = "none"
        }
      }

      if (isDragging && contentRef.current) {
        const newX = e.clientX - position.x
        const newY = e.clientY - position.y

        contentRef.current.style.left = `${newX}px`
        contentRef.current.style.top = `${newY}px`
        contentRef.current.style.transform = "none"
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setIsDragging(false)
      setResizeDirection("")
    }

    if (isResizing || isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
      document.body.style.cursor = isResizing
        ? resizeDirection.includes("right") || resizeDirection.includes("left")
          ? "ew-resize"
          : resizeDirection.includes("top") || resizeDirection.includes("bottom")
            ? "ns-resize"
            : "nw-resize"
        : "move"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
  }, [isResizing, isDragging, resizeDirection, size, position, resizable])

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          resizable && "resize-none", // Remove resize CSS nativo quando usando handles customizados
          className,
        )}
        {...props}
      >
        {children}

        {/* Botão de fechar */}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 z-10"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}

        {/* Handles de redimensionamento */}
        {resizable && (
          <>
            {/* Handle de arrastar (título) */}
            <div
              className="absolute top-0 left-0 right-0 h-12 cursor-move flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              onMouseDown={handleDragStart}
            >
              <Move className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Handles das bordas */}
            <div
              className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "top")}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "bottom")}
            />
            <div
              className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize hover:bg-primary/20 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "left")}
            />
            <div
              className="absolute top-0 bottom-0 right-0 w-1 cursor-ew-resize hover:bg-primary/20 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "right")}
            />

            {/* Handles dos cantos */}
            <div
              className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-primary/30 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "top-left")}
            />
            <div
              className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-primary/30 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "top-right")}
            />
            <div
              className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-primary/30 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "bottom-left")}
            />
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-primary/30 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, "bottom-right")}
            />
          </>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
