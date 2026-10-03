"use client";

import { useState } from "react";
import { Tabs, Button } from "@/components/ui";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export interface WizardStep {
    id: string;
    label: string;
    component: React.ReactNode;
    isValid?: boolean; // If false, Next button is disabled
    validationError?: string;
}

interface WizardFormProps {
    steps: WizardStep[];
    onComplete: () => void;
    isSubmitting?: boolean;
}

export function WizardForm({ steps, onComplete, isSubmitting }: WizardFormProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const currentStep = steps[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setCurrentStepIndex((prev) => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    };

    const handleTabChange = (stepId: string) => {
        const index = steps.findIndex((s) => s.id === stepId);
        // Only allow navigating to previous steps or the next immediate step if current is valid
        if (index < currentStepIndex || (index === currentStepIndex + 1 && currentStep.isValid)) {
            setCurrentStepIndex(index);
        }
    };

    return (
        <div className="space-y-6">
            {/* Progress / Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                <Tabs
                    tabs={steps.map((step, index) => ({
                        id: step.id,
                        label: `${index + 1}. ${step.label}`,
                        // Add check icon for completed steps?
                    }))}
                    activeTab={currentStep.id}
                    onTabChange={handleTabChange}
                    variant="pills"
                    className="bg-transparent border-none p-0"
                />
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {currentStep.component}
            </div>

            {/* Footer / Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                <Button
                    variant="ghost"
                    onClick={handlePrev}
                    disabled={isFirstStep || isSubmitting}
                >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Précédent
                </Button>

                <div className="flex items-center gap-4">
                    {currentStep.validationError && (
                        <span className="text-sm text-red-500 font-medium">{currentStep.validationError}</span>
                    )}
                    <Button
                        variant={isLastStep ? "primary" : "secondary"}
                        onClick={handleNext}
                        disabled={!currentStep.isValid || isSubmitting}
                    >
                        {isLastStep ? (
                            <>
                                {isSubmitting ? "Création..." : "Créer la mission"}
                                {!isSubmitting && <Check className="w-4 h-4 ml-2" />}
                            </>
                        ) : (
                            <>
                                Suivant
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
