'use client'

import { Card, Flex, Text, TextField, Avatar, Button, Badge, Dialog, Box } from "@radix-ui/themes";
import { IMatch, ITeam } from "@/app/types/databaseTypes";
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react";

interface MatchCardProps {
  match: IMatch;
  userTeam: ITeam | null;
  opponentTeam: ITeam | null;
  scores: { [teamId: string]: string };
  confirmed: boolean;
  fetchAllMatches: () => Promise<void>; 
}

export default function MatchCard({ match, userTeam, opponentTeam, scores: initialScores, fetchAllMatches }: MatchCardProps) {


  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [scores, setScores] = useState<{ [teamId: string]: string }>(initialScores || {});
  const [message, setMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);


  useEffect(() => {
    console.log('initial scores:', scores)
  }, [scores])

  const handleScoreChange = (teamId: string | undefined, value: string) => {
    if (!teamId) return;

    setScores((prevScores) => ({
      ...prevScores,
      [teamId]: value,
    }));
  };

  useEffect(() => {
    console.log("match on load:", match)
  }, [match])

  const submitScores = async () => {
    if (!userTeam || !opponentTeam || !userTeam._id || !opponentTeam._id) return;

    setIsSubmittingScore(true);

    try{
      const userTeamId: string = String(userTeam._id);
      const opponentTeamId: string = String(opponentTeam._id);

      const existingScores: Record<string, string> = scores || {};

      const formattedScores: { teamId: string; score: number; submittingTeam: string }[] = [
          { teamId: userTeamId, score: parseInt(existingScores[userTeamId] || "0", 10), submittingTeam: userTeamId },
          { teamId: opponentTeamId, score: parseInt(existingScores[opponentTeamId] || "0", 10), submittingTeam: userTeamId },
        ];

      // If scores already exist in state, compare them before sending anything
      if (match.scores?.items?.length && match.scores.items.length > 0) {
        console.log('scores exist. Confirming')

        const dbScores: { teamId: string; score: number, submittingTeam: string }[] = match.scores.items.map((entry) => ({
          teamId: typeof entry.teamId === "string" ? entry.teamId : entry.teamId.toString(), // ✅ Convert ObjectId to string
          score: entry.score ?? 0, // ✅ Prevent undefined scores
          submittingTeam: typeof entry.submittingTeam === "string" ? entry.submittingTeam : entry.submittingTeam.toString(),
        }));

        const teamAlreadySubmitted = dbScores.some((entry) => entry.submittingTeam === userTeamId);

        // Compare new scores with existing scores
        const scoresMatch =
        dbScores.some((entry) => entry.teamId === userTeamId && entry.score === formattedScores[0].score) &&
        dbScores.some((entry) => entry.teamId === opponentTeamId && entry.score === formattedScores[1].score);

        if (scoresMatch && !teamAlreadySubmitted) {
          // Scoresmatch and the submitting team is different, update confirmation
          const payload = {
            matchId: match._id,
            scores: {
              items: dbScores, // Keep existing scores
              confirmed: true, // Update confirmation only
            },
            status: "COMPLETED"
          };

          try {
            const response = await fetch("/api/matches", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error("Failed to confirm scores.");
            }

            console.log('Scored match')

            setCloseDialog(true);
            // await fetchAllMatches();

            console.log("Setting success message...");

            setMessage({ type: "success", text: "Scores successfuly recorded!" });
          
          } catch (error) {
            console.error("Error confirming scores:", error);
            setMessage({ type: "error", text: "An error occurred while confirming scores." });
          }
          return; // Stop execution here since we're just confirming

        } else if (teamAlreadySubmitted) {
          console.log('Same team resubmitting.')

          // The same team is resubmitting, update their previous entry
          const updatedScores = dbScores.map((entry) =>
            entry.submittingTeam === userTeamId
              ? formattedScores.find((score) => score.teamId === entry.teamId) || entry
              : entry
          );

          const updatePayload = {
            matchId: match._id,
            scores: {
              items: updatedScores, // Overwrite only the submitting team's previous score
              confirmed: false, // Do not confirm yet
            },
          };

          try {
            const response = await fetch("/api/matches", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatePayload),
            });

            if (!response.ok) throw new Error("Failed to update scores.");
            setCloseDialog(true);
            // await fetchAllMatches();

            console.log("Setting success message...");

            setMessage({ type: "success", text: "Your score submission has been updated." });
          } catch (error) {
            console.error("Error updating scores:", error);
            setMessage({ type: "error", text: "An error occurred while updating your scores." });
          }
          return;
        } else {
          setMessage({ type: "error", text: "Scores do not match with the other team. Please review and resubmit." });
          return;
        }
      }

      // If no scores exist in the database, re-fetch in case someone else submitted them
      console.log('scores do not exist. Double checking.')

      try {
        const refreshResponse = await fetch(`/api/matches?matchId=${match._id}`);
        if (!refreshResponse.ok) throw new Error("Failed to fetch latest match data.");

        const refreshedMatchResponse = await refreshResponse.json();
        const refreshedMatch: IMatch = refreshedMatchResponse.match;

        console.log("refreshed match:", refreshedMatch);

        if (refreshedMatch.scores?.items && refreshedMatch.scores.items.length > 0) {
          console.log('scores didnt exist. Now they do.')

          // New scores exist, compare them instead of saving new ones

          const refreshedDbScores: { teamId: string; score: number; submittingTeam: string }[] = refreshedMatch.scores.items.map((entry) => ({
            teamId: typeof entry.teamId === "string" ? entry.teamId : entry.teamId.toString(),
            score: entry.score ?? 0,
            submittingTeam: typeof entry.submittingTeam === "string" ? entry.submittingTeam : entry.submittingTeam.toString(),
          }));
          
          const teamAlreadySubmitted = refreshedDbScores.some((entry) => entry.submittingTeam === userTeamId);

          if (!teamAlreadySubmitted) {
            const scoresMatch =
            refreshedDbScores.some((entry) => entry.teamId === userTeamId && entry.score === formattedScores[0].score) &&
            refreshedDbScores.some((entry) => entry.teamId === opponentTeamId && entry.score === formattedScores[1].score);

            if (scoresMatch) {
              // ✅ Update only confirmed status
              const confirmPayload = {
                matchId: match._id,
                scores: {
                  items: refreshedDbScores, // Keep the existing scores
                  confirmed: true, // ✅ Confirm the match
                },
                status: "COMPLETED"
              };

              await fetch("/api/matches", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(confirmPayload),
              });

              console.log('Confirmed newly added scores')

              setCloseDialog(true);
              // await fetchAllMatches();
              console.log("Setting success message...");
              setMessage({ type: "success", text: "Scores confirmed!" });
              return;
              
            } else {
              setMessage({ type: "error", text: "Scores do not match with the other team. Please review and resubmit." });
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching latest match scores:", error);
      }

      console.log('Still no scores after double checking.')
      // If the database still has no scores, submit new scores
      const payload = {
        matchId: match._id,
        scores: {
          items: formattedScores, // Save new scores
          confirmed: false, // Do not confirm yet
        },
      };

      try {
        const response = await fetch("/api/matches", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to submit scores.");
        }

        console.log('Scored saved')

        setCloseDialog(true);
        // await fetchAllMatches();
        console.log("Setting success message...");
        setMessage({ type: "success", text: "Scores submitted. Waiting for confirmation from the other team." });
      } catch (error) {
        console.error("Error submitting scores:", error);
        setMessage({ type: "error", text: "An error occurred while submitting scores." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong." });
      console.error(error);
    
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
  
    const [year, month, day] = dateString.split("-");
  
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })
      .format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
  };

  useEffect(() => {
    console.log("Dialog open state:", open);
  }, [open]);

  return (
    <Card key={match._id} style={{ border: "1px solid #8A7E00", padding: "10px" }}>
      <Flex direction="column" gap="3">
        {/* Match Date & Status */}
        <Flex direction={'row'} justify="between" align="start">
          <Flex direction={'column'}>
          <Text weight="bold">
            {match.day}, {formatDate(match.date)}
          </Text>
            <Text>{match.time}</Text>
          </Flex>

          <Badge 
            size={'3'} 
            color={match.status === "BOOKED" ? 'green' : match.status === "COMPLETED" ? 'purple' : 'blue'}
          >
            {match.status}
          </Badge>

        </Flex>

        {/* Location */}
        <Text>
          Location: <b>
            {match.location && typeof match.location === "object" && "name" in match.location
              ? (match.location as { name: string }).name
              : "Unknown"}
          </b>
        </Text>


        {/* Teams Display */}
        {opponentTeam && (
          <Flex direction="column" gap="2">
            <Text weight="bold">Opponent Team</Text>
            {opponentTeam.teammates.map((teammate) => (
              <Flex key={teammate._id} align="center" gap="3">
                <Avatar src={teammate.profilePicture} alt={teammate.name} fallback={teammate.name?.charAt(0) || ''} />
                <Text>{teammate.name}</Text>
                <Text weight="bold">{teammate.dupr || teammate.skillLevel || "N/A"}</Text>
              </Flex>
            ))}
          </Flex>
        )}

        <Flex direction={'row'} justify={'between'}>
          <Button mt="2" style={{ width: match.status === "BOOKED" ? "45%" : "100%" }}  onClick={() => router.push(`/chat/${match._id}`)}>
            Go to chat
          </Button>
          {match.status === "BOOKED" && (
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger>
              <Button variant="outline" mt="2" style={{ width: "45%" }}>
                  {match.scores?.items?.some((score) => score.submittingTeam?.toString() === userTeam?._id)
                    ? "Resubmit Scores" 
                    : "Submit Scores"} 
                </Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth={"500px"}>
                <Dialog.Title>Record Match Score</Dialog.Title>
                <Dialog.Description>
                  Enter the final scores for the match.
                </Dialog.Description>
                
                {[userTeam, opponentTeam].map((team) =>
                  team ? (
                    <Flex key={team._id} direction="column" gap="3" p="2" >
                      <Text>{team.teammates[0].name?.split(' ')[0]} & {team.teammates[1].name?.split(' ')[0]}</Text>
                      <Flex direction={'row'} mb={'5'}>
                        {team.teammates.map((teammate) => (
                          <Flex key={teammate._id} align="center">
                            <Avatar
                              src={teammate.profilePicture}
                              alt={teammate.name} fallback={teammate.name?.charAt(0) || ''} 
                              radius="full"
                            />
                          </Flex>
                        ))}
                        <TextField.Root
                          placeholder="Enter score"
                          value={scores[team._id!] || ""}
                          onChange={(e) => handleScoreChange(team._id, e.target.value)}
                          ml={'5'}
                        />
                      </Flex>
                    </Flex>
                  ) : null
                )}

                {message.type && <Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>}

                <Flex justify="end" gap="5" mt={'5'}>
                  <Dialog.Close>
                    <Box>
                      <Button
                        variant="outline"
                        loading={isSubmittingScore}
                        disabled={isSubmittingScore}
                        onClick={() => {
                          if (closeDialog) {
                            fetchAllMatches();
                          }
                          setCloseDialog(false);
                          setMessage({ type: null, text: "" })
                        }}
                      >
                        {closeDialog ? "Close" : "Cancel"}
                      </Button>
                    </Box>
                  </Dialog.Close>
                  <Box display={closeDialog ? "none" : "block"}>
                    <Button
                      loading={isSubmittingScore}
                      disabled={isSubmittingScore}
                      onClick={submitScores}
                    >
                      Submit
                    </Button>
                  </Box>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          )}
        </Flex>
        
      </Flex>
    </Card>
  );
}