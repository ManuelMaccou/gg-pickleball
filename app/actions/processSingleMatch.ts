'use server'

import { startSession } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements'; // Adjust path
import { logError } from '@/lib/sentry/logger';

// Define the arguments needed for the update logic
type SingleMatchParams = {
  team1Ids: string[];
  team2Ids: string[];
  winners: string[];
  location: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
  matchDate: Date;
  isHistorical: boolean;
  isGlobalContext: boolean;
};

export async function processSingleMatchAction(params: SingleMatchParams) {
  await connectToDatabase();
  
  // 1. Start the session here (on the server)
  const session = await startSession();
  
  try {
    session.startTransaction();

    // 2. Call your complex function, passing the session
    const result = await updateUserAndAchievements(
      params, 
      { session } // <--- Passing the required session
    );

    // 3. Commit if successful
    await session.commitTransaction();
    
    // Return plain data to the client
    return { success: true, data: result };

  } catch (error: any) {
    // 4. Rollback on error
    await session.abortTransaction();
    
    logError(error, { task: 'processSingleMatchAction', matchId: params.matchId });
    throw new Error(error.message || "Failed to process match achievements");
  } finally {
    session.endSession();
  }
}