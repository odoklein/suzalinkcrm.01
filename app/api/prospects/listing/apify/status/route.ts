import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApifyRunStatus } from "@/lib/listing/apify-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const status = await getApifyRunStatus(runId);

    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error("Apify Status Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check run status",
      },
      { status: 500 },
    );
  }
}
