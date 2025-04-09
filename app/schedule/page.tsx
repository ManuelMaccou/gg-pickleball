'use client'

import { useRouter } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0"
import { Box, Flex, Grid, Heading, Spinner, Text, VisuallyHidden } from "@radix-ui/themes";
import DesktopSidebar from "../components/Sections/DesktopSidebar";
import TopBanner from "../components/Sections/TopBanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiErrorResponse } from "../types/functionTypes";
import { IMatch, ITeam, IUser } from "../types/databaseTypes";
import MatchCard from "./components/MatchCards";

export default function Schedule() {
  const router = useRouter();
  const { user, isLoading } = useUser()

  const [loading, setLoading] = useState<boolean>(true);
  const [currentDbUser, setCurrentDbUser] = useState<IUser | null>(null);
  const [matchesWithOpponents, setMatchesWithOpponents] = useState<
  {
    match: IMatch;
    userTeam: ITeam | null;
    opponentTeam: ITeam | null;
    scores: { [teamId: string]: string };
    confirmed: boolean;
  }[]
>([]);

  const [error, setError] = useState<string | null>(null);

  const fetchAllMatches = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches?userId=${currentDbUser?._id}&populateTeams=true`);

      if (!response.ok) {
        throw new Error(`Failed to fetch matches for user: ${currentDbUser?._id}`);
      }

      const { matches }: { matches: IMatch[] } = await response.json();

      const filteredMatches = matches.filter((match) => match.status !== "CANCELED");

      const matchesWithOpponents = filteredMatches.map((match) => {
        const teams = match.teams as unknown as ITeam[];
      
        // Identify the user's team
        const userTeam: ITeam | null = 
          teams.find((team) => team.teammates.some((player) => player._id === currentDbUser?._id)) || null;
    
      
        // The opponent team
        const opponentTeam: ITeam | null = teams.find((team) => team._id !== userTeam?._id) || null;
      
        return {
          match,
          userTeam,
          opponentTeam,
          scores: match.scores || {},
          confirmed: match.scores?.confirmed || false,
        };
      });

      setMatchesWithOpponents(matchesWithOpponents);
    } catch (error) {
      console.error("Error fetching matches:", error);
      setError("An unexpected error happened. Please try again. Code 631.");
    } finally {
      setLoading(false)
    }
  }, [currentDbUser]);

  // Get currently logged in user
  useEffect(() => {
    if (!user) return;

      const fetchUser = async () => {
        try {
          const response = await fetch(`/api/users/auth0Id/?auth0Id=${user?.sub}`);
  
          if (!response.ok) {
            const errorData: ApiErrorResponse = await response.json();
            throw new Error(`API Error: ${errorData.systemMessage}`);
          }
  
          const currentUser = await response.json();
          setCurrentDbUser(currentUser.user);

          console.log ('current user:', currentUser);

        } catch (error) {
          console.error('Error fetching current user:', error);
          setError((prev) => prev || "An unexpected error happened. Please try again. Code 630.");
        }
      };
  
      fetchUser();
    }, [user]);

    // Fetch all matches for this user
    useEffect(() => {
      if (!currentDbUser) return;
      fetchAllMatches();
    }, [currentDbUser, fetchAllMatches]);

    

    if (!isLoading && !user) {
      router.push('/auth/login')
    }

    if (!isLoading && !user) {
      return (
        <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}}>
          <Flex display={{ initial: 'none', md: 'flex' }}>
            <DesktopSidebar />
          </Flex>
    
          <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
            <TopBanner />
          </Flex>
    
          <Flex direction={'column'} p={'4'} gap={'2'}>
            <Heading>Schedule</Heading>
            <Text>A list of your pending and confirmed matches</Text>
          </Flex>

          <Flex direction={'column'} align={'center'} justify={'center'} px={'4'}>
           <Alert variant="destructive" style={{backgroundColor: "white"}}>
              <AlertCircle/>
              <VisuallyHidden>
                <AlertTitle>Not authorized</AlertTitle>
              </VisuallyHidden>
              <AlertDescription>
              You must be logged in to view this page
              </AlertDescription>
            </Alert>
          </Flex>
        </Flex>
      )
    }

  return (
    <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}} pb={'9'}>
     
      <Flex display={{ initial: 'none', md: 'flex' }}>
        <DesktopSidebar />
      </Flex>

      <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
        <TopBanner />
      </Flex>

      <Flex direction={'column'} width={'100%'}>
        <Flex direction={'column'} p={'4'} gap={'2'}>
          <Heading>Schedule</Heading>
          <Text>
            A list of your pending and confirmed matches. Come back here after you play to 
            record your score and add it to your official ranking.
          </Text>
        </Flex>

        {error && (
          <Box m={'4'}>
            <Alert variant="destructive" style={{backgroundColor: "white"}}>
              <AlertCircle/>
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          </Box>
        )}

        {loading ? (
          <Flex direction={'column'} justify={'center'} align={'center'}>
            <Spinner />
          </Flex>
        ) : (
          <Grid columns={{ initial: "1", md: "2", lg: "3" }} gap="4" m="4" justify="center">
            {matchesWithOpponents.length > 0 ? (
              [...matchesWithOpponents]
                .sort((a, b) => {
                  // ✅ Convert date strings to timestamps
                  const dateA = a.match.date ? new Date(a.match.date).getTime() : 0;
                  const dateB = b.match.date ? new Date(b.match.date).getTime() : 0;

                  // ✅ If dates are different, sort by date first
                  if (dateA !== dateB) return dateA - dateB;

                  // ✅ Extract and convert the end time to 24-hour format
                  const extractEndTime = (matchTime: string) => {
                    if (!matchTime) return 0;

                    const timeParts = matchTime.split("-"); // ["9", "11am"] or ["11", "1pm"]
                    if (timeParts.length < 2) return 0;

                    const endTime = timeParts[1]; // "11am" or "1pm"
                    const isPM = endTime.includes("pm");

                    let hour = parseInt(endTime.replace(/am|pm/, ""), 10);
                    if (isPM && hour !== 12) hour += 12; // Convert PM times to 24-hour format
                    if (!isPM && hour === 12) hour = 0; // Handle 12am case

                    return hour;
                  };

                  const timeA = extractEndTime(a.match.time);
                  const timeB = extractEndTime(b.match.time);

                  return timeA - timeB; // ✅ Sort by end time if dates are the same
                })
                .map(({ match, userTeam, opponentTeam, scores, confirmed }) => (
                  <MatchCard
                    key={match._id}
                    userTeam={userTeam}
                    match={match}
                    opponentTeam={opponentTeam}
                    scores={scores}
                    confirmed={confirmed}
                    fetchAllMatches={fetchAllMatches}
                  />
                ))
            ) : (
              <Text color="gray">No matches have been booked yet.</Text>
            )}
          </Grid>
        )}
      </Flex>
    </Flex>
  )
}
