import { EmailHubLayout } from "@/components/email/EmailHubLayout";

export default function ManagerEmailsLayout({ children }: { children: React.ReactNode }) {
    return (
        <EmailHubLayout variant="manager">
            {children}
        </EmailHubLayout>
    );
}
