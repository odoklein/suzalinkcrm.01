"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { CommsInbox } from "@/components/comms";
import { MessageSquare } from "lucide-react";

export default function BDCommsPage() {
    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Communications"
                subtitle="Discussions avec l'équipe et les clients"
                icon={<MessageSquare className="w-5 h-5" />}
            />
            
            <div className="h-[calc(100vh-200px)]">
                <CommsInbox />
            </div>
        </div>
    );
}
