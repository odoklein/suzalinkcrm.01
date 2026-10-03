"use client";

import SessionTaskBoard from "@/components/sessions/SessionTaskBoard";

export default function DevSessionTasksPage() {
    return (
        <div
            className="min-h-full p-4 md:p-6"
            style={{ background: "#F4F6F9", fontFamily: "'Inter', system-ui, sans-serif" }}
        >
            <SessionTaskBoard />
        </div>
    );
}
