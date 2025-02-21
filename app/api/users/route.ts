import { NextRequest, NextResponse } from "next/server";

import User from "@/app/models/User";
import connectToDatabase from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase(); // Ensure MongoDB is connected

    const body = await req.json();
    const { name, email, profilePicture, duprUrl, dupr, skillLevel, availability, auth0Id, activeSeasons, firstTimeInvite }:
      {name: string, email: string, profilePicture: string, duprUrl: string, dupr: number, skillLevel: string, availability: { day: string; time: string }[], auth0Id: string, activeSeasons: string[], firstTimeInvite: boolean} = body;

      if (!name) {
        return NextResponse.json(
          {
            systemMessage: "Name is missing from the request body.",
            userMessage: "Please enter a name.",
          },
          { status: 400 }
        );
      }

      if (!email) {
        return NextResponse.json(
          {
            systemMessage: "Email is missing from the request body.",
            userMessage: "Please enter an email address.",
          },
          { status: 400 }
        );
      }

    const existingUser = await User.findOne({ auth0Id });
    if (existingUser) {
      console.log("email exists") 
      return NextResponse.json(
        {
          user: existingUser,
          exists: true,
          systemMessage: `A player with this email (${email}) already exists in the database.`,
          userMessage: "A player with this email already exists. Please use a different email.",
        },
        { status: 200 }
      );
    }

    const newUser = new User({
      name,
      email,
      profilePicture,
      duprUrl,
      dupr,
      skillLevel,
      availability,
      auth0Id,
      activeSeasons,
      firstTimeInvite,
    });

    await newUser.save();

    return NextResponse.json({ exists: false, message: "User created successfully", user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        systemMessage: "Internal Server Error.",
        userMessage: "Something went wrong. Please try again later.",
      },
      { status: 500 }
    );
  }
}