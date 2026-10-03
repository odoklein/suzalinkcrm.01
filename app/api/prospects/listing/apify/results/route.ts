import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getApifyRunResults,
  normalizeApifyResults,
} from "@/lib/listing/apify-service";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get("datasetId");

    if (!datasetId) {
      return NextResponse.json(
        { error: "datasetId is required" },
        { status: 400 },
      );
    }

    const items = await getApifyRunResults(datasetId);
    const normalized = normalizeApifyResults(items);

    // Add IDs to normalized results to match ListingResult expected by frontend
    const resultsWithIds = normalized.map((item) => ({
      id: crypto.randomUUID(), // Generate a temporary ID for the listing table
      ...item,
    }));

    return NextResponse.json({ success: true, data: resultsWithIds });
  } catch (error) {
    console.error("Apify Results Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch run results",
      },
      { status: 500 },
    );
  }
}
