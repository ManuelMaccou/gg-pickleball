import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Team from "@/app/models/Team";
import Season from "@/app/models/Season";
import { ITeam, IUser } from "@/app/types/databaseTypes";


export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { teammates, captain, wins, losses, seasonId, regionId, registrationStep, status, individual } = body;

    if (!teammates) {
      return NextResponse.json(
        {
          systemMessage: "The users were not included in the request body.",
          userMessage: "An unexpected error occured. Please refresh the page and try again."
         }, { status: 400 });
    }

    if (!seasonId || !regionId) {
      return NextResponse.json(
        {
          systemMessage: "Season ID or Region ID were not included in the request body.",
          userMessage: "An unexpected error occured. Please refresh the page and try again."
        }, { status: 400 });
    }

    const newTeam = new Team({
      teammates,
      captain,
      wins,
      losses,
      seasonId,
      regionId,
      registrationStep,
      status,
      individual,
    });

    await newTeam.save();

    return NextResponse.json({ message: "Team created successfully", team: newTeam }, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      {
        systemMessage: "Internal server error.",
        userMessage: "An expected error occured. Please try again."
       }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    // Parse URL query parameters
    const { searchParams } = new URL(req.url);
    const regionId = searchParams.get("regionId");
    const activeSeason = searchParams.get("activeSeason") === "true";
    const teamId = searchParams.get("teamId");

    const query: Partial<ITeam> = {};

    if (activeSeason) {
      const activeSeasonDoc = await Season.findOne({ active: true }).select("_id");

      if (!activeSeasonDoc) {
        return NextResponse.json(
          { 
            systemMessage: "No active season found in the database.", 
            userMessage: "There is currently no active season. Please check back later." 
          }, 
          { status: 404 }
        );
      }
      query.seasonId = activeSeasonDoc._id; // Filter by active season
    }

    if (regionId) {
      query.regionId = regionId; // Filter by region
    }

    if (teamId) {
      query._id = teamId
    }

    const teams = await Team.find(query).populate<{ teammates: IUser[] }>("teammates", "name email profilePicture dupr skillLevel");

    return NextResponse.json(teams, { status: 200 });
  } catch (error) {
    console.error("Error fetching teams:", error);

    return NextResponse.json(
      { 
        systemMessage: `Error fetching teams: ${error instanceof Error ? error.message : "Unknown error"}`, 
        userMessage: "Something went wrong while fetching teams. Please try again later." 
      }, 
      { status: 500 }
    );
  }
}