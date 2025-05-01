import User from "@/app/models/User";
import Client from "@/app/models/Client";
import { updateCheckinAchievements } from "@/utils/achievementFunctions/updateCheckinAchievements";
import connectToDatabase from "@/lib/mongodb";
import { haversineDistance } from "@/utils/haversineDistance";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { userId, locationId, latitude, longitude } = await req.json();

    if (!userId || !locationId || latitude == null || longitude == null) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    const client = await Client.findById(locationId);
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });
    }

    if (!client.latitude || !client.longitude) {
      return new Response(JSON.stringify({ error: "Client does not have GPS coordinates set" }), { status: 500 });
    }

    // Calculate distance between user and client
    const distanceMeters = haversineDistance(
      { latitude, longitude },
      { latitude: client.latitude, longitude: client.longitude }
    );

    console.log(`User is ${distanceMeters.toFixed(2)} meters from client.`);

    const allowedDistance = 300; // meters

    if (distanceMeters > allowedDistance) {
      return new Response(JSON.stringify({ error: "You must be physically near the location to check-in." }), { status: 403 });
    }

    // User is close enough — proceed
    const { achievementKey, checkinCount } = await updateCheckinAchievements(user, locationId);

    return new Response(JSON.stringify({
      success: true,
      achievementKey,
      checkinCount,
      client,
    }), { status: 200 });

  } catch (error) {
    console.error('Check-in failed:', error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
