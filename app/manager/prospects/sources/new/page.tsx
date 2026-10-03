"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SourceSetupWizard } from "@/components/prospects/SourceSetupWizard";

export default function NewSourcePage() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(true);

    const handleClose = () => {
        setIsOpen(false);
        router.push("/manager/prospects/sources");
    };

    const handleSuccess = () => {
        router.push("/manager/prospects/sources");
    };

    return (
        <SourceSetupWizard
            isOpen={isOpen}
            onClose={handleClose}
            onSuccess={handleSuccess}
        />
    );
}
