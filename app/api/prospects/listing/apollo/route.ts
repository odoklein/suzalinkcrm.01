import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchFromApollo } from "@/lib/listing/apollo-service";

// ============================================
// SEARCH APOLLO FOR LEADS
// ============================================

/**
 * POST /api/prospects/listing/apollo
 *
 * Search Apollo.io for companies and contacts based on filters.
 * This is the UI layer's entry point to Apollo search functionality.
 *
 * Permissions: Role MANAGER
 */

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Check permission (Only Managers can access listing)
    if (session.user.role !== "MANAGER") {
      return NextResponse.json(
        {
          success: false,
          error: "Permission denied. Only managers can access this feature.",
        },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      // Basic filters
      industry,
      companySize,
      country,
      region,
      state,
      jobTitle,
      keywords,

      // Revenue & Funding
      revenueRange,
      fundingMin,
      fundingMax,
      latestFundingStage,

      // Company Details
      yearFoundedMin,
      yearFoundedMax,
      companyType,
      technologies,

      // Growth & Intent
      isHiring,
      departmentHeadcount,
      jobPostings,

      limit = 25,
    } = body;

    // Validate required fields
    if (
      !industry &&
      !companySize &&
      !country &&
      !region &&
      !state &&
      !jobTitle &&
      !keywords &&
      !revenueRange &&
      !fundingMin &&
      !fundingMax &&
      !latestFundingStage &&
      !yearFoundedMin &&
      !yearFoundedMax &&
      !companyType &&
      !technologies &&
      !isHiring &&
      !departmentHeadcount &&
      !jobPostings
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one filter is required",
        },
        { status: 400 },
      );
    }

    // Validate limit
    if (limit > 100) {
      return NextResponse.json(
        { success: false, error: "Limit cannot exceed 100" },
        { status: 400 },
      );
    }

    // Call Apollo service
    const { results, total } = await searchFromApollo({
      industry,
      companySize,
      country,
      region,
      state,
      jobTitle,
      keywords,
      revenueRange,
      fundingMin,
      fundingMax,
      latestFundingStage,
      yearFoundedMin,
      yearFoundedMax,
      companyType,
      technologies,
      isHiring,
      departmentHeadcount,
      jobPostings,
      limit,
      page: 1, // TODO: Add pagination support if needed
    });

    // Map to ListingResult (add ID and ensure type safety)
    const mappedResults = results.map((r) => ({
      id:
        r.metadata?.apolloId ||
        `apollo_${Math.random().toString(36).substr(2, 9)}`,
      source: "apollo",
      company: r.company || { name: "Unknown Company" },
      person: r.person,
      confidence: r.confidence,
    }));

    return NextResponse.json({
      success: true,
      data: mappedResults,
      pagination: {
        total,
        limit,
        page: 1,
      },
      metadata: {
        provider: "apollo",
        filters: {
          industry,
          companySize,
          country,
          jobTitle,
          keywords,
        },
      },
    });
  } catch (error) {
    console.error("[API] Apollo listing search failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to search Apollo. Please try again.",
      },
      { status: 500 },
    );
  }
}
