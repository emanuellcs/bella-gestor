"use client"

import {
    Toast,
    ToastClose,
    ToastDescription,
    ToastProvider,
    ToastTitle,
    ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, XCircle } from "lucide-react"

export function Toaster() {
    const { toasts } = useToast()

    const getIcon = (variant?: "default" | "destructive" | null) => {
        if (variant === "destructive") {
            return <XCircle className="h-5 w-5 text-red-500" />
        }
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }

    return (
        <ToastProvider>
            {toasts.map(function ({ id, title, description, action, variant, ...props }) {
                // Normaliza variant para evitar null
                const toastVariant = variant === null ? undefined : variant

                return (
                    <Toast key={id} variant={toastVariant} {...props}>
                        <div className="flex items-start gap-3 w-full">
                            <div className="flex-shrink-0 mt-0.5">
                                {getIcon(variant)}
                            </div>
                            <div className="grid gap-1 flex-1">
                                {title && <ToastTitle className="text-base font-semibold">{title}</ToastTitle>}
                                {description && (
                                    <ToastDescription className="text-sm opacity-90">
                                        {description}
                                    </ToastDescription>
                                )}
                            </div>
                        </div>
                        {action}
                        <ToastClose />
                    </Toast>
                )
            })}
            <ToastViewport />
        </ToastProvider>
    )
}
