"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group font-sans"
      icons={{
        success: <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />,
        info: <Info className="size-4 text-blue-500 shrink-0" />,
        warning: <AlertTriangle className="size-4 text-amber-500 shrink-0" />,
        error: <XCircle className="size-4 text-red-500 shrink-0" />,
        loading: <Loader2 className="size-4 text-primary animate-spin shrink-0" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast flex items-start gap-3 w-full rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-xl backdrop-blur-md p-3.5 font-sans transition-all duration-200",
          title: "text-xs sm:text-sm font-bold text-foreground leading-tight",
          description: "text-xs text-muted-foreground font-medium mt-0.5 leading-relaxed",
          actionButton: "bg-primary text-primary-foreground font-semibold text-xs px-3 py-1.5 rounded-lg",
          cancelButton: "bg-muted text-muted-foreground font-medium text-xs px-3 py-1.5 rounded-lg",
          icon: "mt-0.5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
