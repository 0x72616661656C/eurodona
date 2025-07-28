"use client"

import { useEffect, useState } from "react"
import { Window } from "@tauri-apps/api/window"
import { Icons } from "@/components/titlebar/icons"
import { Button } from "@/components/titlebar/button"
import { cn } from "@/lib/utils"

interface WindowControlsProps {
  className?: string
}

export function WindowControls({ className }: WindowControlsProps) {
  const [isWindowMaximized, setIsWindowMaximized] = useState(false)
  const appWindow = new Window("main")

  useEffect(() => {
    appWindow.isMaximized().then(setIsWindowMaximized)

    const unlisten = appWindow.onResized(async () => {
      setIsWindowMaximized(await appWindow.isMaximized())
    })

    return () => {
      unlisten.then((f) => f())
    }
  }, [])

  const minimizeWindow = () => appWindow.minimize()
  const maximizeWindow = () => appWindow.toggleMaximize()
  const closeWindow = () => appWindow.close()

  return (
    <div className={cn("flex h-8", className)}>
      {/* Minimizar */}
      <Button
        onClick={minimizeWindow}
        className="max-h-8 w-[46px] cursor-default rounded-none bg-transparent text-black/90 hover:bg-black/[.05] active:bg-black/[.03] dark:text-white dark:hover:bg-white/[.06] dark:active:bg-white/[.04]"
      >
        <Icons.minimizeWin />
      </Button>

      {/* Maximizar/Restaurar */}
      <Button
        onClick={maximizeWindow}
        className="max-h-8 w-[46px] cursor-default rounded-none bg-transparent text-black/90 hover:bg-black/[.05] active:bg-black/[.03] dark:text-white dark:hover:bg-white/[.06] dark:active:bg-white/[.04]"
      >
        {!isWindowMaximized ? <Icons.maximizeWin /> : <Icons.maximizeRestoreWin />}
      </Button>

      {/* Fechar */}
      <Button
        onClick={closeWindow}
        className="max-h-8 w-[46px] cursor-default rounded-none bg-transparent text-black/90 hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/90 dark:text-white"
      >
        <Icons.closeWin />
      </Button>
    </div>
  )
}
