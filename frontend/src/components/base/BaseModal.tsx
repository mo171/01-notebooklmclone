import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface BaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  width: number
  height: number
  background?:string
}

export function BaseModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width,
  height,
  background
}: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          // `width: 500vw` used to let the dialog exceed the viewport (a 1450px
          // modal on a 1280px screen hung 85px off each edge). Clamp to the
          // viewport so the modal is always fully visible.
          width: "100%",
          maxWidth: `min(${width}px, calc(100vw - 2rem))`,
          height: `min(${height}px, calc(100vh - 2rem))`,
          background: background,
        }}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle className="text-gray-500">{title}</DialogTitle>}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="py-4 overflow-auto overflow-y-auto">{children}</div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
