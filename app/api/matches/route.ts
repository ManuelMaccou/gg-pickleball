import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { IUser, ICourt, ITeam } from "@/app/types/databaseTypes";
import Team from "@/app/models/Team";


export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { teams, challenger, status, winner, loser, seasonId, regionId, date, day, time, location } = body;

    if (!teams || !Array.isArray(teams) || teams.length < 2) {
      return NextResponse.json(
        { error: "Teams are required and must be an array with at least two team IDs" },
        { status: 400 }
      );
    }

    const newMatch = new Match({
      teams,
      challenger,
      status,
      winner,
      loser,
      seasonId,
      regionId,
      date,
      day,
      time,
      location
    });

    await newMatch.save();

    const populatedMatch = await Match.findById(newMatch._id)
    .populate({
      path: "teams",
      populate: {
        path: "teammates",
        model: "User",
      },
    });

    if (!populatedMatch) {
      return NextResponse.json({ error: "Match not found after creation" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Match created successfully", match: populatedMatch },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating match:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Extract matchId from query parameters
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");
    const userId = searchParams.get("userId");

    if (!matchId && !userId) {
      return NextResponse.json(
        { error: "Either matchId or userId parameter is required" },
        { status: 400 }
      );
    }

    if (matchId) {
      // Fetch the match and populate necessary fields
      const match = await Match.findById(matchId)
      .populate<{ location: ICourt }>("location") // Get location details
      .populate({
        path: "teams",
        populate: { path: "teammates" }, // Populate teammates inside each team
      })
      .populate({
        path: "challenger",
        populate: { path: "teammates" }, // Populate challenger team's teammates
      });

      if (!match) {
        return NextResponse.json(
          { error: "Match not found" },
          { status: 404 }
        );
      }

      // Extract unique users from all teams
      const usersMap = new Map<string, IUser>();

      if (Array.isArray(match.teams)) {
        match.teams.forEach((team: { teammates?: IUser[] }) => {
          if (Array.isArray(team.teammates)) {
            team.teammates.forEach((user: IUser) => {
              usersMap.set(user._id!.toString(), user);
            });
          }
        });
      }

      // Add challenger teammates if they exist
      if (match.challenger && Array.isArray(match.challenger.teammates)) {
        match.challenger.teammates.forEach((user: IUser) => {
          usersMap.set(user._id!.toString(), user);
        });
      }

      const users = Array.from(usersMap.values());

      return NextResponse.json({ match, users });
    }

    if (userId) {
      const teams: ITeam[] = await Team.find({ teammates: userId }).select("_id");

      if (!teams.length) {
        return NextResponse.json(
          { matches: [] },
          { status: 200 }
        );
      }

      const teamIds = teams.map((team) => team._id);

      const matches = await Match.find({
        teams: { $in: teamIds },
      })
        .populate<{ location: ICourt }>("location")
        .populate({
          path: "teams",
          populate: { path: "teammates" },
        })
        .sort({ date: -1 });

      return NextResponse.json({ matches }, { status: 200 });
    }
   
  } catch (error) {
    console.error("Error fetching match:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectToDatabase(); // Ensure DB is connected

    const { matchId, ...updateFields } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    const updatedMatch = await Match.findByIdAndUpdate(
      matchId,
      { ...updateFields },
      { new: true, runValidators: true }
    ).populate("location");

    if (!updatedMatch) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(updatedMatch, { status: 200 });
  } catch (error) {
    console.error("Error updating match:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
