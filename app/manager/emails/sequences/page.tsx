"use client";

import React from "react";

// ============================================
// SEQUENCES PAGE — Re-export from existing
// /manager/emails/sequences
// ============================================

// Import the existing sequences page component
import SequencesPageContent from "@/app/manager/email/sequences/page";

export default function EmailHubSequencesPage() {
    return <SequencesPageContent />;
}
