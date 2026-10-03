import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ============================================
// GET /api/actions/recent
// Returns recent team activity for the activity feed
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Non autorisé" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10") || 10,
      100,
    );
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const userId = searchParams.get("userId");

    const userRole = (session.user as { role?: string }).role;
    const isSdrOrBd = userRole === "SDR" || userRole === "BUSINESS_DEVELOPER";

    let assignedMissionIds: string[] = [];
    let teamLeadMissionIds: string[] = [];
    if (isSdrOrBd && !userId) {
      const [assignments, teamLeadMissions] = await Promise.all([
        prisma.sDRAssignment.findMany({
          where: { sdrId: session.user.id },
          select: { missionId: true },
        }),
        prisma.mission.findMany({
          where: { teamLeadSdrId: session.user.id },
          select: { id: true },
        }),
      ]);
      assignedMissionIds = assignments.map((a) => a.missionId);
      teamLeadMissionIds = teamLeadMissions.map((m) => m.id);
    }

    // SDR/BD: restrict to own actions + teammates' actions in missions where they are team lead
    let actionWhere: Prisma.ActionWhereInput | undefined;
    if (userId) {
      actionWhere = { sdrId: userId };
    } else if (isSdrOrBd) {
      actionWhere = {
        campaign: { missionId: { in: assignedMissionIds } },
        OR: [
          { sdrId: session.user.id },
          ...(teamLeadMissionIds.length > 0
            ? [{ campaign: { missionId: { in: teamLeadMissionIds } } }]
            : []),
        ],
      };
    }

    // Fetch recent actions with user and campaign info
    const recentActions = await prisma.action.findMany({
      where: actionWhere,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      // IMPORTANT: Do not rely on Prisma's default selection of all Action scalar fields.
      // If the database schema is behind (e.g. missing Action.meetingAddress), selecting
      // all columns will throw P2022 and break this endpoint.
      select: {
        id: true,
        sdrId: true,
        result: true,
        createdAt: true,
        sdr: {
          select: {
            id: true,
            name: true,
          },
        },
        contact: {
          select: {
            firstName: true,
            lastName: true,
            company: {
              select: {
                name: true,
              },
            },
          },
        },
        company: {
          select: {
            name: true,
          },
        },
        campaign: {
          select: {
            name: true,
          },
        },
      },
    });

    // Fetch recent schedule block status changes (only when not filtering by user)
    const blockWhere: Prisma.ScheduleBlockWhereInput = {
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    };
    if (isSdrOrBd && !userId && assignedMissionIds.length > 0) {
      blockWhere.missionId = { in: assignedMissionIds };
    }
    const recentBlocks = userId
      ? []
      : await prisma.scheduleBlock.findMany({
          take: limit,
          orderBy: { updatedAt: "desc" },
          where: blockWhere,
          include: {
            sdr: {
              select: {
                id: true,
                name: true,
              },
            },
            mission: {
              select: {
                name: true,
              },
            },
          },
        });

    // Format activities
    const activities: {
      id: string;
      user: string;
      userId: string;
      action: string;
      time: string;
      type: "call" | "meeting" | "schedule";
      createdAt: Date;
      result?: string;
      contactOrCompanyName?: string;
      campaignName?: string;
    }[] = [];

    // Add action activities
    for (const action of recentActions) {
      const userName = action.sdr.name
        .split(" ")
        .map((n, i) => (i === 0 ? n : n[0] + "."))
        .join(" ");

      let actionText = "";
      let type: "call" | "meeting" = "call";

      switch (action.result) {
        case "MEETING_BOOKED":
          const companyName = action.contact?.company?.name || "un prospect";
          actionText = `a booké un RDV avec ${companyName}`;
          type = "meeting";
          break;
        case "INTERESTED":
          actionText = "a qualifié un prospect intéressé";
          type = "call";
          break;
        case "CALLBACK_REQUESTED":
          actionText = "a noté un rappel à faire";
          type = "call";
          break;
        case "NO_RESPONSE":
          actionText = "a tenté un contact (pas de réponse)";
          type = "call";
          break;
        case "BAD_CONTACT":
          actionText = "a signalé un mauvais contact";
          type = "call";
          break;
        case "DISQUALIFIED":
          actionText = "a disqualifié un prospect";
          type = "call";
          break;
        default:
          actionText = "a effectué une action";
          type = "call";
      }

      const contactOrCompanyName = action.contact
        ? `${(action.contact.firstName || "").trim()} ${(action.contact.lastName || "").trim()}`.trim() ||
          action.contact.company?.name
        : action.company?.name;

      activities.push({
        id: action.id,
        user: userName,
        userId: action.sdrId,
        action: actionText,
        time: formatRelativeTime(action.createdAt),
        type,
        createdAt: action.createdAt,
        result: action.result,
        contactOrCompanyName: contactOrCompanyName ?? undefined,
        campaignName: action.campaign?.name,
      });
    }

    // Add schedule activities
    for (const block of recentBlocks) {
      const userName = block.sdr.name
        .split(" ")
        .map((n, i) => (i === 0 ? n : n[0] + "."))
        .join(" ");

      const actionText =
        block.status === "IN_PROGRESS"
          ? `a démarré sa session sur ${block.mission.name}`
          : `a terminé sa session sur ${block.mission.name}`;

      activities.push({
        id: block.id,
        user: userName,
        userId: block.sdrId,
        action: actionText,
        time: formatRelativeTime(block.updatedAt),
        type: "schedule",
        createdAt: block.updatedAt,
      });
    }

    // Sort by time and take the most recent
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const sortedActivities = activities.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: sortedActivities,
    });
  } catch (error) {
    console.error("[GET /api/actions/recent] Error:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return date.toLocaleDateString("fr-FR");
}
