import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import { IAvailability } from "@/app/types/databaseTypes";
import { Types } from "mongoose"; 

interface UserWithAvailability {
  _id: string;
  name: string;
  skillLevel: "Beginner" | "Intermediate" | "Advanced";
  availability: IAvailability[];
}

async function getUserAvailabilities(userIds: string[]): Promise<UserWithAvailability[]> {
  try {
    await connectToDatabase();

    // Ensure MongoDB ObjectIds are valid
    const validIds = userIds.filter((id) => Types.ObjectId.isValid(id));

    const users = await User.find({ _id: { $in: validIds } })
      .select("name skillLevel availability")
      .lean();

    return users.map((user) => ({
      _id: (user._id as Types.ObjectId).toString(), // Explicitly cast _id
      name: typeof user.name === "string" ? user.name : "Unknown",
      skillLevel: ["Beginner", "Intermediate", "Advanced"].includes(user.skillLevel)
        ? (user.skillLevel as "Beginner" | "Intermediate" | "Advanced")
        : "Beginner",
      availability: Array.isArray(user.availability) ? user.availability : [],
    })) as UserWithAvailability[];
  } catch (error) {
    console.error("Error fetching user availabilities:", error);
    return [];
  }
}

function compareAvailabilities(users: UserWithAvailability[]) {
  const availabilityMaps: Record<string, Record<string, Set<string>>> = {};
  const pairs: { 
    user1Name: string;
    user1SkillLevel: string;
    user2Name: string;
    user2SkillLevel: string;
    matches: number 
  }[] = [];

  // Convert each user's availability into a set-based map
  users.forEach((user) => {
    const map: Record<string, Set<string>> = {};
    user.availability.forEach(({ day, time }) => {
      if (!map[day]) map[day] = new Set();
      map[day].add(time);
    });
    availabilityMaps[user._id] = map;
  });

  // Compare each pair of users
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const user1 = users[i];
      const user2 = users[j];
      let matches = 0;

      Object.keys(availabilityMaps[user1._id]).forEach((day) => {
        if (availabilityMaps[user2._id][day]) {
          matches += [...availabilityMaps[user1._id][day]].filter((time) =>
            availabilityMaps[user2._id][day].has(time)
          ).length;
        }
      });

      pairs.push({ 
        user1Name: user1.name, 
        user1SkillLevel: user1.skillLevel, 
        user2Name: user2.name, 
        user2SkillLevel: user2.skillLevel, 
        matches 
      });
    }
  }

  // Sort pairs by most matches
  pairs.sort((a, b) => b.matches - a.matches);
  return pairs;
}

export async function POST(req: Request) {
  try {
    const { userIds } = await req.json();
    if (!Array.isArray(userIds) || userIds.length < 2) {
      return NextResponse.json({ error: "At least two user IDs are required." }, { status: 400 });
    }

    const users = await getUserAvailabilities(userIds);
    if (users.length < 2) {
      return NextResponse.json({ error: "Not enough valid users found." }, { status: 400 });
    }

    const results = compareAvailabilities(users);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
