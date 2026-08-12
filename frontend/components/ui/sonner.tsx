"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-sans"
      icons={{
        success: <CheckCircle2 className="size-4 shrink-0 text-status-good" />,
        info: <Info className="size-4 shrink-0 text-primary" />,
        warning: <AlertTriangle className="size-4 shrink-0 text-status-warning" />,
        error: <XCircle className="size-4 shrink-0 text-status-critical" />,
        loading: <Loader2 className="size-4 shrink-0 animate-spin text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast flex w-full items-start gap-3 rounded-lg border border-border bg-popover p-3.5 font-sans text-popover-foreground shadow-soft",
          title: "text-sm font-medium text-foreground leading-tight",
          description: "text-xs text-muted-foreground mt-0.5 leading-relaxed",
          actionButton: "bg-primary text-primary-foreground font-medium text-xs px-3 py-1.5 rounded-md",
          cancelButton: "bg-muted text-muted-foreground font-medium text-xs px-3 py-1.5 rounded-md",
          icon: "mt-0.5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
