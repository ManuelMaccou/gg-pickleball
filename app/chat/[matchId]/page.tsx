"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { useRouter, useParams, usePathname } from 'next/navigation';
import { IAvailability, IConversation, ICourt, IMatch, ITeam, IUser } from "@/app/types/databaseTypes";
import { useCallback, useEffect, useRef, useState } from "react"
import { Avatar, Flex, Text, Separator, Button, TextField, IconButton, Box, Dialog, Link } from '@radix-ui/themes';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import DesktopSidebar from "@/app/components/Sections/DesktopSidebar";
import MatchRescheduleDialog from "@/components/ui/MatchRescheduleDialog";
import TopBanner from "@/app/components/Sections/TopBanner";
import { X } from "lucide-react";
import { ApiErrorResponse } from "@/app/types/functionTypes";

export default function Chat() {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const { user, isLoading } = useUser()
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams()
  const matchId = params.matchId

  const [isDesktop, setIsDesktop] = useState(false);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMemorialDialogOpen, setIsMemorialDialogOpen] = useState(false);
  const [isMemorialPark, setIsMemorialPark] = useState(false);
  const [memorialParkConfirm, setMemorialParkConfirm] = useState(false);

  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [usersForChat, setUsersForChat] = useState<IUser[] | null>(null);
  const [bannerIndex, setBannerIndex] = useState<boolean>(true);

  const [match, setMatch] = useState<IMatch | null>(null);
  const [conversation, setConversation] = useState<IConversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);

  // const [regionId, setRegionId] = useState<string | null>(null);
  const [courts, setCourts] = useState<ICourt[]>([]);

  const [team1Availability, setTeam1Availability] = useState<IAvailability[]>([]);
  const [team2Availability, setTeam2Availability] = useState<IAvailability[]>([]);
  const [userTeam, setUserTeam] = useState<ITeam | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<ITeam | null>(null);

  const [open, setOpen] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [scores, setScores] = useState<{ [teamId: string]: string }>({});
  const [message, setMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [pendingMatchUpdate, setPendingMatchUpdate] = useState<IMatch | null>(null);
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);



  useEffect(() => {
    const memorialParkCourtId = process.env.NEXT_PUBLIC_ENV === "dev"
      ? '67d3436c3a795dc67a9a38d7' 
      : '67d3436c3a795dc67a9a38d7';

    if (
      typeof match?.location === "object" &&
      "_id" in match.location &&
      match.location._id.toString() === memorialParkCourtId
    ) {
      setIsMemorialDialogOpen(true);
      setIsMemorialPark(true);
    }
  },[match])

  useEffect(() => {
    if (chatContainerRef.current) {
      if (isDesktop) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      } else {
        chatContainerRef.current.scrollTop = 0;
      }
    }
  }, [conversation?.messages, isDesktop]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
  
    const [year, month, day] = dateString.split("-");
  
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })
      .format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
  };
  

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // Difference in seconds

    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const handleMemorialParkBooking = async() => {
    const payload = {
      matchId: match?._id,
      status: "BOOKED"
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

      setMemorialParkConfirm(false);
      router.push('/schedule')
    } catch (error) {
      console.error("Error confirming scores:", error);
    }
  }

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768); // Adjust breakpoint as needed
    };
  
    handleResize(); // ✅ Set initial value
    window.addEventListener("resize", handleResize);
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user || isLoading) return;

    const fetchCurrentUser = async() => {
      try {
        const respponse = await fetch(`/api/users/auth0Id/?auth0Id=${user.sub}`);

        if (!respponse.ok) {
          throw new Error(`Failed to fetch user: ${respponse.statusText}`);
        }

        const { user: currentUser }: { user: IUser } = await respponse.json();
        if (!currentUser) {
          console.log('current user not found individual success')
          router.push('/register')
          return;
        }

        setCurrentUser(currentUser);

      } catch (error) {
        console.error('Failed to fetch User:', error);
        router.push('/register');
      }
    };

    fetchCurrentUser();
  }, [user, isLoading, router])

  // Get availability for each teammate to create the reschedule feature
  const extractTeamAvailability = (team: ITeam): IAvailability[] => {
    if (!team || !team.teammates || team.teammates.length !== 2) return [];
  
    const [teammate1, teammate2] = team.teammates;
  
    const teammate1Availability: IAvailability[] = (teammate1.availability || []).map(({ day, time }) => ({
      day,
      time,
      date: "", // Default value since teammates don't have a date field
      available: true, // Assume true since this function just extracts shared availability
    }));
  
    const teammate2Availability: IAvailability[] = (teammate2.availability || []).map(({ day, time }) => ({
      day,
      time,
      date: "", // Default value
      available: true, // Default value
    }));
  
    return teammate1Availability.filter(slot1 =>
      teammate2Availability.some(slot2 => slot1.day === slot2.day && slot1.time === slot2.time)
    );
  };

  const updateMatchDetails = async (newCourt: ICourt, newTime: { day: string; time: string; date: string; }) => {
    try {
      const response = await fetch(`/api/matches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          location: newCourt._id,
          time: newTime.time,
          day: newTime.day,
          date: newTime.date,
        }),
      });

      if (!response.ok) throw new Error("Failed to update match");

      const updatedMatch = await response.json();
      setMatch(updatedMatch);
      setIsDialogOpen(false);

      const formattedDate = newTime.date.split("-").slice(1).join("-");
      const systemMessageText = `Match has been rescheduled to ${newTime.day}, ${formattedDate} at ${newTime.time} at ${newCourt.name}.`;
      sendMessage(true, systemMessageText);


    } catch (error) {
      console.error("Error updating match:", error);
    }
  };
  
  useEffect(() => {
    if (!matchId) return;

    const adminId = process.env.NEXT_PUBLIC_ENV === 'dev'
      ? "67bf5eee8dd2fb5ee5a40cba"
      : "67d4a1cf3a795dc67a9a3915";

    const fetchMatch = async() => {
      try {
        const response = await fetch(`/api/matches?matchId=${matchId}&populateTeams=true`);

        if (!response.ok) {
          throw new Error(`Failed to fetch users for matchId: ${matchId}`);
        }

        const { match, users } = await response.json();

        setUserTeam(match.teams.find((team: ITeam) => team.teammates.some((player) => player._id === currentUser?._id)) || null);
        setOpponentTeam(match.teams.find((team: ITeam) => team._id !== userTeam?._id) || null);

        const isDev = process.env.NEXT_PUBLIC_ENV === "dev"

        const updatedUsers: IUser[] = users.some((user: IUser) => user._id === adminId) 
          ? users 
          : [...users, { _id: adminId, name: "Admin", email: "manuelmaccou@gmail.com", profilePicture: isDev ? "http://localhost:3000/api/images/67d333cc8e3b4015c870a101" : "https://www.ggpickleball.co/api/images/67d4a21d3a795dc67a9a3918" }];


        setMatch(match);
        // setRegionId(match.regionId);
        setUsersForChat(updatedUsers);
        setScores(match.scores);

        // Get availability of both teams
        if (match.teams.length !== 2) {
          console.error("Unexpected number of teams in match:", match.teams);
          return;
        }

        const [team1, team2] = match.teams;

        const team1Avail = extractTeamAvailability(team1);
        const team2Avail = extractTeamAvailability(team2);

        setTeam1Availability(team1Avail);
        setTeam2Availability(team2Avail);

        if (match.location) {
          const courtResponse = await fetch(`/api/courts?regionId=${match.regionId}`);
          if (!courtResponse.ok) throw new Error("Failed to fetch court availability");
  
          const { courts } = await courtResponse.json();
          setCourts(courts);
        }


      } catch (error) {
        console.error("Error fetching chat users:", error);
      }
    };

    fetchMatch();
  }, [currentUser?._id, matchId, userTeam?._id])


  useEffect(() => {
    if (!matchId || !usersForChat) return;

    const fetchConversation = async() => {
      try {
        const userIds = usersForChat.map((user) => user._id).join(",");
        const response = await fetch(`/api/conversations?matchId=${matchId}&userIds=${userIds}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch conversation for matchId: ${matchId}`);
        }

        const { conversation } = await response.json();
        setConversation(conversation)

      } catch (error) {
        console.error(`Error fetching conversation for matchId: ${matchId}`, error);
      }
    };

    fetchConversation();
  }, [matchId, usersForChat])

  const sendMessage = useCallback(async (isSystemMessage: boolean, text: string) => {
    const messageText = text.trim();
    if (!messageText) return;

    setIsSendingMessage(true)
  
    try {
      const response = await fetch(`/api/conversations/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId,
          text: messageText,
          userId: isSystemMessage ? undefined : currentUser?._id,
          systemMessage: isSystemMessage
        }),
      });
  
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
  
      const { newMessage } = await response.json(); // Expecting only the new message
      console.log("new message:", newMessage)
  
      // ✅ Append the new message instead of replacing the entire conversation
      setConversation((prev) => {
        if (!prev) {
          return {
            _id: "temp-id", // Temporary ID until fetched from backend
            matchId: matchId as string,
            users: (usersForChat?.map((user) => user._id).filter(Boolean) as string[]) || [],
            messages: [newMessage], // ✅ Initialize with the new message
          };
        }
        return {
          ...prev,
          messages: [...(prev.messages ?? []), newMessage],
        };
      });

      setMessageText("");

      const toEmails = usersForChat
        ? usersForChat
          .map(user => user.email)
          .filter(email => email && email !== currentUser?.email)
        : [];
      
        const messagePreheader = newMessage.text
        ? newMessage.text.length > 70
          ? `${newMessage.text.substring(0, 70)}...`
         : `${newMessage.text}. Reply to this message by clicking the button below.`
        : "Reply to this message by clicking the button below.";

      const chatUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${pathname}`;

      const emailPayload = {
        toEmails,
        messageSender: currentUser?.name,
        messageText: newMessage.text,
        messagePreheader,
        chatUrl
      }

      const emailResponse = await fetch(`/api/email/newMessageEmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

       console.log('chat email sent:', emailResponse)
      
      if (!emailResponse.ok) {
        const errorData: ApiErrorResponse = await emailResponse.json();
        console.error(`Failed to send new message email: ${errorData.systemMessage}`);
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSendingMessage(false)
    }
  }, [matchId, currentUser, usersForChat, pathname]);

  const handleScoreChange = (teamId: string | undefined, value: string) => {
    if (!teamId) return;

    setScores((prevScores) => ({
      ...prevScores,
      [teamId]: value,
    }));
  };

  const submitScores = async () => {
    if (!userTeam || !opponentTeam || !userTeam._id || !opponentTeam) return;

    setIsSubmittingScore(true);

    try {
      const userTeamId: string = String(userTeam._id);
      const opponentTeamId: string = String(opponentTeam._id);

      const existingScores: Record<string, string> = scores || {};

      const formattedScores: { teamId: string; score: number; submittingTeam: string }[] = [
          { teamId: userTeamId, score: parseInt(existingScores[userTeamId] || "0", 10), submittingTeam: userTeamId },
          { teamId: opponentTeamId, score: parseInt(existingScores[opponentTeamId] || "0", 10), submittingTeam: userTeamId },
        ];

      // If scores already exist in state, compare them before sending anything
      if (match && match.scores?.items?.length && match.scores.items.length > 0) {
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

            const updatedMatch = await response.json();
            setPendingMatchUpdate(updatedMatch);

            setMessage({ type: "success", text: "Scores successfuly recorded!" });
            setCloseDialog(true);
          } catch (error) {
            console.error("Error confirming scores:", error);
            setMessage({ type: "error", text: "An error occurred while confirming scores." });
          }
          return; // Stop execution here since we're just confirming

        } else if (teamAlreadySubmitted) {
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

            if (!response.ok) {
              throw new Error("Failed to update scores.");
            }

            const updatedMatch = await response.json();
            setPendingMatchUpdate(updatedMatch);

            setCloseDialog(true);
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
      try {
        const refreshResponse = await fetch(`/api/matches?matchId=${match?._id}`);
        if (!refreshResponse.ok) throw new Error("Failed to fetch latest match data.");

        const refreshedMatchResponse = await refreshResponse.json();
        const refreshedMatch: IMatch = refreshedMatchResponse.match;

        if (refreshedMatch.scores?.items && refreshedMatch.scores.items.length > 0) {
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

            if (match && scoresMatch) {
              // ✅ Update only confirmed status
              const confirmPayload = {
                matchId: match._id,
                scores: {
                  items: refreshedDbScores, // Keep the existing scores
                  confirmed: true, // ✅ Confirm the match
                },
                status: "COMPLETED"
              };

              const response = await fetch("/api/matches", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(confirmPayload),
              });

              if (!response.ok) {
                throw new Error("Failed to fetch latest match data.");
              }

              const updatedMatch = await response.json();
              setPendingMatchUpdate(updatedMatch);

              setMessage({ type: "success", text: "Scores confirmed!" });
              return
              
            } else {
              setMessage({ type: "error", text: "Scores do not match with the other team. Please review and resubmit." });
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching latest match scores:", error);
      }

      // If the database still has no scores, submit new scores
      const payload = {
        matchId: match?._id,
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
        const updatedMatch = await response.json();
        setMatch(updatedMatch)
        
        setCloseDialog(true);
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
  

  // Check Authorization Before Rendering
  useEffect(() => {
    if (!currentUser || !usersForChat) return;

    const isUserAuthorized = usersForChat.some((u) => u._id === currentUser._id);
    setIsAuthorized(isUserAuthorized);

    if (!isUserAuthorized) {
      router.replace("/"); // Redirect unauthorized users to home
    }
  }, [currentUser, usersForChat, router]);

  if (isAuthorized === null && user && !isLoading) {
    return (
      <Flex height="100vh" align="center" justify="center">
        <Text size="4">Loading chat...</Text>
      </Flex>
    );
  }

  if (isAuthorized === false || isLoading) return (
    <Flex height="100vh" align="center" justify="center">
      <Text size="4">You are not authorized to view this page</Text>
    </Flex>
  );
  
  if (!isLoading && !user) {
    router.push(`/auth/login?returnTo=${pathname}`)
  }

  return (
    <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} width={'100%'} px={{initial: '0', md: '5'}}>
      <Flex display={{ initial: 'none', md: 'flex' }}>
        <DesktopSidebar />
      </Flex>

      <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
        <TopBanner />
      </Flex>

      <Flex direction={'column'} style={{marginRight: 'auto', marginLeft: 'auto'}} width={{initial: "100%", md: "60%"}} px={'4'} pt={{initial: '2', md: '7'}}>
        {bannerIndex && (
          <Flex direction="row" p="3" mx={'-4'} justify={'between'}
            style={{ backgroundColor: 'green', color: 'white', alignItems: 'center' }}
          >
            <Text style={{maxWidth: '90%'}}>
              Chat with the players and request a court reservation.
            </Text>
            <X onClick={() => setBannerIndex(false)} style={{ cursor: 'pointer' }} />
          </Flex>
        )}
      

        <Dialog.Root open={isMemorialDialogOpen} onOpenChange={setIsMemorialDialogOpen}>
          <Dialog.Content className="dialog-content">
            <Dialog.Title>Import note about Memorial Park</Dialog.Title>
            <Dialog.Description>
              <Flex direction={'column'} gap={'3'}>
                <Text>
                  We added Memorial Park as an affordable alternative to booking your own court. 
                  Reservations for Memorial Park cannot be made through this platform, so we can&apos;t guarantee
                  availability. Open play at the park is managed by Santa Monica Pickleball Center and the city of
                  Santa Monica. Depending on the time you want to play, open play is free or there&apos;s a small 
                  fee of $5 ($3 for Santa Monica residents). You can learn more by clicking on these links:
                </Text>
                <Link href="https://santamonicapickleballclub.org/" target="blank">
                  Free open play with Santa Monica Pickleball Club - Weekday mornings | Weekend afternoons
                </Link>
                <Link href="https://www.santamonica.gov/process-explainers/how-to-enroll-in-drop-in-pickleball" target="blank">
                  Open play for a small fee - Monday and Wednesday evenings | Weekend mornings
                </Link>
              </Flex>
              
            
            </Dialog.Description>
            <Dialog.Close>
              <Button mt={'5'} onClick={() => setIsMemorialDialogOpen(false)}>Got it</Button>
            </Dialog.Close>
          </Dialog.Content>
         </Dialog.Root>

         <Dialog.Root open={memorialParkConfirm} onOpenChange={setMemorialParkConfirm}>
            <Dialog.Content className="dialog-content">
              <Dialog.Title>Confirm match</Dialog.Title>
              <Dialog.Description>
              <Flex direction={'column'} gap={'3'}>
                <Text>
                  This will confirm your match for Memorial Park in Santa Monica. Note that 
                  we cannot gurarantee availability for these courts, and you may have to register 
                  for open play depending on the time you play. 
                </Text>
                <Link href="https://santamonicapickleballclub.org/" target="blank">
                  Free open play with Santa Monica Pickleball Club - Weekday mornings | Weekend afternoons
                </Link>
                <Link href="https://www.santamonica.gov/process-explainers/how-to-enroll-in-drop-in-pickleball" target="blank">
                  Open play for a small fee - Monday and Wednesday evenings | Weekend mornings
                </Link>
              </Flex>
              </Dialog.Description>
              <Flex direction={'row'} gap={'5'} mt={'6'}>
                <Dialog.Close>
                  <Box>
                    <Button variant="outline" onClick={() => setMemorialParkConfirm(false)}>Cancel</Button>
                  </Box>
                </Dialog.Close>
                <Box>
                  <Button onClick={handleMemorialParkBooking} disabled={!match}>Confirm</Button>
                </Box>
              </Flex>
            </Dialog.Content>
         </Dialog.Root>


        {/* Users Profile */}
        {usersForChat && usersForChat.length > 0 && (
          <>
          <Flex direction={'row'} align={'center'} justify={'center'} gap={{initial: '0', md: '5'}} mt="4">
            {/*
            <Flex direction={'row'} maxWidth={'40%'} wrap={'wrap'}> 
              {usersForChat.map((user) => (
                <Avatar
                  size={'4'}
                  key={user._id}
                  src={user.profilePicture}
                  fallback={user.name?.charAt(0).toUpperCase() || ''} 
                  radius='full'
                />
              ))}
            </Flex>
            */}
            

            {/* Display User Names Below */}
            <Flex direction={'column'}>
            
              <Text>{usersForChat.map(user => user.name?.split(" ")[0]).join(", ")}</Text>

              <Separator orientation="horizontal" my={'4'} size={'4'} style={{color: '#FFFFFF'}} />
              {match && (
                <Text wrap="pretty">
                  {match.day}, {formatDate(match.date)}, {match.time} at{" "}
                  {typeof match.location === "object" &&
                  match.location !== null &&
                  "name" in match.location
                    ? (match.location as { name: string }).name
                    : "Unknown Location"}
                </Text>
              )}
            
            </Flex>
          </Flex>

          <Flex direction={'row'} justify={{initial: 'between', md: 'center'}} align={'end'} gap={{initial: '5', md: '5'}} mt={'5'}>
            
            

            {match && match.status === "PENDING" ? (
              <>
              <MatchRescheduleDialog 
              team1Availability={team1Availability}
              team2Availability={team2Availability}
              courts={courts}
              onConfirm={updateMatchDetails}
              open={isDialogOpen}
              setOpen={setIsDialogOpen}
            />
              <Button size={'4'} onClick={() => isMemorialPark ? setMemorialParkConfirm(true) : router.push(`/reserve/${matchId}`) }>
              { isMemorialPark ? "Confirm match" : "Request court" }
            </Button>
            </>
            ) : match && match.status === "BOOKED" ? (
              <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger>
                
                  <Button size={'4'} mt="2">
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
                          if (closeDialog && pendingMatchUpdate) {
                            setMatch(pendingMatchUpdate);
                            setPendingMatchUpdate(null);
                          }
                          setCloseDialog(false);
                          setMessage({ type: null, text: "" })
                        }}
                      >{
                        closeDialog ? "Close" : "Cancel"}
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
            ) : null
          }

          </Flex>

          <Separator orientation="horizontal" my={'4'} size="4" style={{color: '#FFFFFF'}} />

          {/* Chat area */}

          <Box display={{initial: 'block', md: 'none'}} mb={'3'}>
            <TextField.Root
              placeholder="Send message…"
              size='3'
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{ flexGrow: 1, height: "50px" }}
            >
              <TextField.Slot side='right' pr="3">
                <IconButton size="2" variant="ghost" disabled={!currentUser || !messageText || isSendingMessage} loading={isSendingMessage} onClick={() => sendMessage(false, messageText)}>
                  <PaperPlaneIcon height="25" width="25" />
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
          </Box>

          <Flex ref={chatContainerRef} direction={'column'} maxHeight={{initial: '52vh', md: '60vh'}} style={{ flexGrow: 1, minHeight: "200px", overflowY: "auto", paddingBottom: "100px" }}>
          {conversation?.messages?.length ? (
            [...conversation.messages] // ✅ Create a shallow copy before sorting
              .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0; // ✅ Default to 0 if undefined
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return isDesktop ? dateA - dateB : dateB - dateA;
              })
              .map((msg, index) => {
              const user = usersForChat?.find((u) => u._id === msg.user);
              return (
                
                <Flex key={msg._id ?? `temp-${index}`} direction="row" align="start" my={{initial: '4', md: '3'}}>
                  {!msg.systemMessage ? (
                   <>
                    <Avatar size="4" src={user?.profilePicture} fallback={user?.name?.charAt(0) || "U"} radius="full" />
                    <Flex direction="column" ml="3">
                      <Flex direction={'row'} gap={'2'}>
                        <Text size="1" weight={'bold'}>
                          {user?.name?.split(' ')[0] ?? user?.name} 
                        </Text>
                        <Text size="1" style={{ color: "gray" }}>
                          {formatTimestamp(msg.createdAt || "")}
                        </Text>

                      </Flex>
                     
                      <Text
                        m="2"
                        size={'4'}
                        style={{
                          wordWrap: "break-word",
                          color: "white"
                        }}
                      >
                        {msg.text}
                      </Text>
                    </Flex>
                  </>
                  ) : (
                    <Flex direction="column" ml="3">
                    <Text size="1" align={'center'}
                      style={{ color: "gray" }}>
                      {formatTimestamp(msg.createdAt || "")}
                    </Text>
                    <Text
                    align={'center'}
                      m="2"
                      size={'4'}
                      style={{
                        wordWrap: "break-word",
                        color: '#bfbfbf'
                      }}
                    >
                      {msg.text}
                    </Text>
                  </Flex>
                  )}
                  
                </Flex>
              );
            })
          ) : (
            <Flex direction={'column'} align={'center'} justify={'center'} m={'9'}>
              <Text align={'center'} style={{color: 'grey'}} size={'4'}>
                Game on!
              </Text>
            </Flex>
          )}
          </Flex>

          <Box display={{initial: 'none', md: 'block'}} mb={'7'}>
            <TextField.Root
              placeholder="Send message…"
              size='3'
              value={messageText}
              disabled={!currentUser}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { // Prevent Shift + Enter from triggering
                  e.preventDefault(); // ✅ Stops line breaks
                  if (messageText.trim() !== "") { // Prevent sending empty messages
                    sendMessage(false, messageText);
                  }
                }
              }}
              style={{ flexGrow: 1, height: "50px" }}
            >
              <TextField.Slot side='right' pr="3">
                <IconButton size="2" variant="ghost" disabled={!currentUser || !messageText || isSendingMessage}  loading={isSendingMessage} onClick={() => sendMessage(false, messageText)}>
                  <PaperPlaneIcon height="25" width="25" />
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
          </Box>




          </>
        )}
      </Flex>
    </Flex>
  );
}