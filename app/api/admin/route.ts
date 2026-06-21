import { Types } from "mongoose";
import Admin from "@/app/models/Admin";
import connectToDatabase from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/sentry/logger";
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";
import SourceRewardConfig from "@/app/models/SourceRewardConfig";
import { BrandApplication } from "@/app/models/BrandApplication";

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!user.superAdmin && userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    if (!userId) {
      logError(new Error('UserId was not included in the query param.'), {
        endpoint: 'GET /api/admin',
        task: 'Fetching admin details'
      });
      return NextResponse.json({ error: "There was an error completing this request." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(userId)) {
      logError(new Error('UserId was not in the right format.'), {
        endpoint: 'GET /api/admin',
        task: 'Fetching admin details'
      });
      return NextResponse.json({ error: "There was an error completing this request." }, { status: 400 });
    }

    const admin = await Admin.findOne({ user: userId }).populate("location").lean() as any;

    if (!admin) {
      // No Admin record — before falling back to "not a brand partner," check
      // whether this user has an approved BrandApplication. If so, their
      // Client/Admin setup failed after approval — surface that distinctly
      // so the frontend doesn't send them back to /apply in a loop.
      const approvedApplication = await BrandApplication.findOne({
        userId,
        status: 'approved',
      })
        .select('brandName email legalCompanyName _id')
        .lean() as any;

      if (approvedApplication) {
        return NextResponse.json({
          admin: null,
          setupIncomplete: true,
          application: {
            id: approvedApplication._id.toString(),
            brandName: approvedApplication.brandName,
            email: approvedApplication.email,
            legalCompanyName: approvedApplication.legalCompanyName,
          },
        }, { status: 200 });
      }

      return new Response(null, { status: 204 });
    }

    if (!admin.location) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasConfiguredRewards = await SourceRewardConfig.exists({
      "sponsorships.sponsoringClientId": admin.location._id
    });

    return NextResponse.json({
      admin,
      location: {
        ...admin.location,
        hasConfiguredRewards: !!hasConfiguredRewards
      }
    });
  } catch (error) {
    const errorId = logError(error, {
      userId: userId,
      message: 'Failed to fetch admin data based on UserId',
      endpoint: 'GET /api/admin'
    });
    return NextResponse.json({ errorId, error: "There was an unexpected error. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Creating an admin record is a superadmin-only operation.
  // The legitimate path is inviteAdminToClient(), which writes directly to
  // the Admin model and never goes through this route. Locking this down
  // prevents any authenticated user from self-promoting by calling it directly.
  const user = await getAuthorizedUser(request);
  if (!user?.superAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    const body = await request.json();
    const { user: userId, location } = body;

    if (!userId || !location) {
      logError(new Error('Request body missing user or location field'), {
        endpoint: 'POST /api/admin',
        task: 'Creating an admin'
      });
      return NextResponse.json({ error: "Missing required fields: user and location." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(location)) {
      logError(new Error('user or location ID is not in right format'), {
        endpoint: 'POST /api/admin',
        task: 'Creating an admin'
      });
      return NextResponse.json({ error: "Invalid request. Please include all required fields." }, { status: 400 });
    }

    const admin = new Admin({ user: userId, location });
    await admin.save();

    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    const errorId = logError(error, { 
      message: 'Error creating admin.',
      endpoint: 'POST /api/admin'
     });
    return NextResponse.json({ errorId, error: "There was an unexpected error. Please try again." }, { status: 500 });
  }
}