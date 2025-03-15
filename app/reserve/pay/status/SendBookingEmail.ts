import sgMail from "@sendgrid/mail";
import { IMatch, ITeam, IUser } from "@/app/types/databaseTypes"; // Ensure correct typings

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

interface Player {
  name: string;
  email: string;
}

export const sendMatchEmail = async (match: IMatch) => {
  try {
    // Ensure teams and teammates are populated to avoid type errors
    if (!match.teams || !Array.isArray(match.teams)) {
      throw new Error("Match teams data is missing or not an array.");
    }

    const players: Player[] = [];

    match.teams.forEach((team) => {
      const populatedTeam = team as unknown as ITeam;
      if (!populatedTeam.teammates || !Array.isArray(populatedTeam.teammates)) {
        console.warn(`No teammates found for team: ${populatedTeam._id}`);
        return;
      }

      populatedTeam.teammates.forEach((player) => {
        const user = player as IUser;
        players.push({ name: user.name ?? "Unknown Player", email: user.email });
      });
    });

    if (players.length === 0) {
      throw new Error("No players found for this match.");
    }

    const msg = {
      to: "book@ggpickleball.co",
      from: "play@ggpickleball.co",
      templateId: "d-ed5efb76a01543f0ad0f0a9cb5a50bc2",
      dynamicTemplateData: {
        players: players,
        matchLocation: (match.location as unknown as { name: string })?.name || "Unknown Location",
        matchDay: match.day,
        matchDate: match.date,
        matchTime: match.time,
      },
    };

    await sgMail.send(msg);
    console.log("Match email sent successfully");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error sending email:", error.message);
    } else {
      console.error("An unknown error occurred while sending email.");
    }
    throw new Error("Failed to send match email");
  }
};
