import { NextResponse } from 'next/server';

type DuprRatingDetails = {
  singles: string;
  doubles: string;
  singlesReliability: string;
  doublesReliability: string;
  matchId: number;
};

type DuprRatingMessage = {
  duprId: string;
  name: string;
  token: null;
  rating: DuprRatingDetails;
};

// --- This is our main discriminated union ---
type DuprWebhookPayload = 
  | {
      clientId: string;
      event: 'RATING';
      message: DuprRatingMessage;
    }
  | {
      clientId: string;
      event: 'REGISTRATION';
      message: { status: string };
    };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  console.log("Received GET request to DUPR webhook endpoint. Responding with 200 OK.");
  return NextResponse.json({ message: 'Webhook endpoint is active.' }, { status: 200 });
}


/**
 * Handles incoming POST requests from DUPR webhooks.
 */
export async function POST(request: Request) {
  const ourClientId = process.env.DUPR_CLIENT_KEY;

  if (!ourClientId) {
    console.error("CRITICAL: DUPR_CLIENT_KEY is not set in environment variables.");
    // Still return 200 to DUPR, but log the severe internal error.
    return NextResponse.json({ status: "error", message: "Internal server configuration error" }, { status: 200 });
  }

  try {
    const payload = await request.json() as DuprWebhookPayload;
    console.log("Received DUPR Webhook Payload:", JSON.stringify(payload, null, 2));

    // --- SECURITY CHECK ---
    // Verify that the clientId in the payload matches our clientId.
    if (payload.clientId !== ourClientId) {
      console.warn(`SECURITY WARNING: Received webhook with mismatched clientId. Expected: ${ourClientId}, Received: ${payload.clientId}`);
      // IMPORTANT: Still return 200 OK to prevent DUPR from retrying/disabling the webhook,
      // but do not process the payload any further.
      return NextResponse.json({ status: "ignored", message: "Invalid client ID" }, { status: 200 });
    }

    // --- PROCESS THE EVENT ---
    // Use a switch statement to handle different event types.
    switch (payload.event) {
      case 'REGISTRATION':
        console.log("✅ Received DUPR REGISTRATION ping. Webhook is successfully registered.");
        // No further action is needed for registration, just the 200 OK response.
        break;

      case 'RATING':
        console.log("✅ Received RATING update event. Processing...");
        
        //
        // <<< YOUR BUSINESS LOGIC GOES HERE >>>
        //
        // For example, you might:
        // 1. Extract the user's DUPR ID and new ratings from `payload.message`.
        const { duprId, rating } = payload.message;
        console.log(`Updating rating for DUPR ID ${duprId}:`, rating);
        
        // 2. Save the new ratings to your database.
        // await db.updateUserRating(duprId, rating);

        // 3. Invalidate Next.js cache for pages that show this user's data.
        // revalidateTag(`user-profile-${duprId}`);
        // revalidatePath(`/players/${duprId}`);

        break;

      default:
        const unknownEventPayload = payload as { event: string };
        console.warn(`Received unknown DUPR event type: '${unknownEventPayload.event}'`);
        break;
    }

  } catch (error: unknown) { // Catch as unknown
    // Check if the error is a standard Error object
    if (error instanceof Error) {
      console.error("Error processing DUPR webhook:", error.message);
    } else {
      // If it's something else (e.g., a string was thrown), log it directly
      console.error("An unexpected error occurred processing DUPR webhook:", error);
    }
    // You should log this error to a monitoring service (Sentry, etc.).
  }

  // --- ACKNOWLEDGE RECEIPT ---
  // IMPORTANT: Always return a 200 OK to DUPR to confirm receipt of the event.
  // If you return a non-200 status, DUPR may retry sending the webhook and
  // eventually disable it if failures persist.
  return NextResponse.json({ status: 'success', message: 'Webhook received' }, { status: 200 });
}