import { getServerSession } from "next-auth";
import { authOptions, getRedirectPath } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role) {
        redirect("/login");
    }
    redirect(getRedirectPath(session.user.role));
}
