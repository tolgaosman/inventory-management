import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export interface FormStep {
  id: string;
  label: string;
  content: React.ReactNode;
  onValidate?: () => Promise<boolean> | boolean;
}

export interface SteppedFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  steps: FormStep[];
  onSubmit: () => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

export function SteppedFormDialog({
  open,
  onOpenChange,
  title,
  description,
  steps,
  onSubmit,
  isSubmitting,
  submitLabel = "Kaydet",
  onCancel,
}: SteppedFormDialogProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [validating, setValidating] = React.useState(false);

  // Reset step when dialog opens
  React.useEffect(() => {
    if (open) {
      setCurrentStepIndex(0);
    }
  }, [open]);

  const handleNext = async () => {
    const step = steps[currentStepIndex];
    if (step.onValidate) {
      setValidating(true);
      try {
        const isValid = await step.onValidate();
        if (!isValid) return; // Validation failed, stay on step
      } finally {
        setValidating(false);
      }
    }
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const currentStep = steps[currentStepIndex];
  const previousStep = !isFirstStep ? steps[currentStepIndex - 1] : null;
  const nextStep = !isLastStep ? steps[currentStepIndex + 1] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-2xl gap-0 p-0 overflow-hidden bg-background/95 backdrop-blur-sm sm:rounded-2xl shadow-2xl border-muted/40">
        <div className="flex flex-col max-h-[85vh]">
          {/* Header Section */}
          <div className="px-6 pt-6 pb-4 bg-background z-10 border-b border-border/50">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground mb-4">
              {title}
            </DialogTitle>
            {description && (
              <VisuallyHidden.Root>
                <DialogDescription>{description}</DialogDescription>
              </VisuallyHidden.Root>
            )}

            {/* Stepper */}
            {steps.length > 1 && (
              <div className="flex gap-3">
                {steps.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isActive = index === currentStepIndex;
                  const isFuture = index > currentStepIndex;

                  return (
                    <div key={step.id} className="flex-1 flex flex-col gap-2">
                      <div className="text-xs font-medium truncate">
                        <span
                          className={cn(
                            "transition-colors",
                            isCompleted && "text-foreground",
                            isActive && "text-primary font-bold",
                            isFuture && "text-muted-foreground"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-1 w-full rounded-full transition-colors",
                          isCompleted && "bg-emerald-500",
                          isActive && "bg-primary",
                          isFuture && "bg-muted"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Body Section */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-[300px]">
            {currentStep?.content}
          </div>

          {/* Footer Section */}
          <div className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={isFirstStep ? (onCancel || (() => onOpenChange(false))) : handleBack}
              disabled={isSubmitting || validating}
            >
              {isFirstStep ? "İptal" : `Geri: ${previousStep?.label}`}
            </Button>

            <Button
              type="button"
              onClick={isLastStep ? onSubmit : handleNext}
              disabled={isSubmitting || validating}
              className={cn(isLastStep && "bg-primary hover:bg-primary/90 text-primary-foreground")}
            >
              {isSubmitting || validating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Lütfen bekleyin...
                </span>
              ) : isLastStep ? (
                submitLabel
              ) : (
                `İleri: ${nextStep?.label}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
