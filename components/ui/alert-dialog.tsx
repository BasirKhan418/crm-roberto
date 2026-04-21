"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/25 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-[calc(100%-1.5rem)] max-w-md max-h-[calc(var(--app-viewport-height)-1.5rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-xl border bg-popover p-5 pr-12 pb-[calc(1.25rem+var(--app-safe-area-bottom)+var(--app-keyboard-inset-height))] text-popover-foreground shadow-lg duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))] sm:w-[calc(100%-2rem)] sm:max-h-[calc(var(--app-viewport-height)-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <AlertDialogPrimitive.Cancel asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="absolute top-3 right-3">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </AlertDialogPrimitive.Cancel>
        ) : null}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("font-heading text-base font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action data-slot="alert-dialog-action" className={cn(className)} {...props} />
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel data-slot="alert-dialog-cancel" className={cn(className)} {...props} />
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
