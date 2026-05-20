import { useEffect, useSyncExternalStore } from "react"
import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

import {
  getResolvedTheme,
  subscribeResolvedTheme,
} from "@/store/theme.store"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const resolved = useSyncExternalStore(
    subscribeResolvedTheme,
    getResolvedTheme,
    () => "light" as const,
  )

  useEffect(() => {
    const applyAlertRole = (): void => {
      document.querySelectorAll("[data-sonner-toast]").forEach((node) => {
        node.setAttribute("role", "alert")
      })
    }
    applyAlertRole()
    const toaster = document.querySelector("[data-sonner-toaster]")
    if (!toaster) {
      return
    }
    const observer = new MutationObserver(applyAlertRole)
    observer.observe(toaster, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
