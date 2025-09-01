import { Types } from "mongoose";
import Admin from "@/app/models/Admin";
import connectToDatabase from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/sentry/logger";
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

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

    const admin = await Admin.findOne({ user: userId }).populate("location");

    if (!admin) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json({ admin });
  } catch (error) {
    logError(error, {
      userId: userId,
      message: 'Failed to fetch admin data based on UserId',
    });
    
    return NextResponse.json({ error: "There was an unexpected error. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  
  const user = await getAuthorizedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase();

    const body = await request.json();
    const { user, location } = body;

    if (!user || !location) {
      logError(new Error('Request body missing user or location field'), {
        endpoint: 'POST /api/admin',
        task: 'Creating an admin'
      });

      return NextResponse.json({ error: "Missing required fields: user and location." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(user) || !Types.ObjectId.isValid(location)) {
      logError(new Error('user or location ID is not in right format'), {
        endpoint: 'POST /api/admin',
        task: 'Creating an admin'
      });

      return NextResponse.json({ error: "Invalid request. Please include all required fields." }, { status: 400 });
    }

    const admin = new Admin({
      user,
      location,
    });

    await admin.save();

    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    logError(error, {
      message: 'Error creating admin.'
    });
    return NextResponse.json({ error: "There was an unexpected error. Please try again." }, { status: 500 });
  }
}
