import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startApifyRun } from "@/lib/listing/apify-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { keywords, location, limit } = body;

    if (!keywords || !location) {
      return NextResponse.json(
        { error: "Keywords and Location are required" },
        { status: 400 },
      );
    }

    const runId = await startApifyRun({ keywords, location, limit });

    return NextResponse.json({ success: true, runId });
  } catch (error) {
    console.error("Apify Run Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start Apify run",
      },
      { status: 500 },
    );
  }
}
