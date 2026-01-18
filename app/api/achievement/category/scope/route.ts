import Achievement from "@/app/models/Achievement";
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";
import connectToDatabase from "@/lib/mongodb";
import { logError } from "@/lib/sentry/logger";
import { NextRequest, NextResponse } from "next/server";
import { PipelineStage } from "mongoose"; // <-- 1. IMPORT THE TYPE

export async function GET(request: NextRequest) {
  const authorizedUser = await getAuthorizedUser(request);
  if (!authorizedUser || (authorizedUser.permission !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    await connectToDatabase();

    if (!scope) {
      const achievements = await Achievement.find({}).sort({ index: 1 }).lean();
      return NextResponse.json({ achievements });
    }

    // --- START: THE FIX ---
    // 2. EXPLICITLY TYPE THE PIPELINE ARRAY
    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: "achievementcategories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      {
        $unwind: "$categoryDetails"
      },
      {
        $match: {
          "categoryDetails.scope": scope
        }
      },
      {
        $sort: {
          index: 1
        }
      },
      {
        $project: {
          categoryDetails: 0
        }
      }
    ];
    // --- END: THE FIX ---

    const achievements = await Achievement.aggregate(pipeline);

    return NextResponse.json({ achievements });

  } catch (error) {
    logError(error, {
      endpoint: 'GET /api/achievement/category/scope',
      message: 'Failed to fetch achievements by scope',
      query_scope: request.nextUrl.searchParams.get('scope') || 'all',
    });
    
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}