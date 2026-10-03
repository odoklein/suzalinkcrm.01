import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCreditUsageSummary,
  projectCreditUsage,
} from "@/lib/listing/apollo-credits";

// ============================================
// GET /api/prospects/listing/apollo/credits
// Returns Apollo credit usage summary and projections
// ============================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "MANAGER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const summary = getCreditUsageSummary(30);
    const projection = projectCreditUsage("free"); // Default to free plan

    return NextResponse.json({
      success: true,
      data: {
        summary,
        projection,
      },
    });
  } catch (error) {
    console.error("[API] Apollo credits error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get credit data" },
      { status: 500 }
    );
  }
}
