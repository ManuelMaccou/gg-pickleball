'use client'

import { useUser } from "@auth0/nextjs-auth0"
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Flex, Grid, Heading, RadioCards, Spinner, Text } from "@radix-ui/themes";
import DesktopSidebar from "../components/Sections/DesktopSidebar";
import TopBanner from "../components/Sections/TopBanner";
import { useEffect, useState } from "react";
import { IAvailability, ICourt, IMatch, ISeason, ITeam, IUser } from "../types/databaseTypes";
import { ApiErrorResponse } from "../types/functionTypes";

type TeamWithAvailability = ITeam & {
  matchingAvailability: IAvailability[];
};

export default function Challenge() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [teams, setTeams] = useState<ITeam[]>([]);
  const [currentUsersTeam, setCurrentUsersTeam] = useState<ITeam | null>(null);
  const [filteredTeams, setFilteredTeams] = useState<TeamWithAvailability[]>([]);
  const [courts, setCourts] = useState<ICourt[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<ICourt | null>(null);
  const [courtAvailability, setCourtAvailability] = useState<IAvailability[]>([]);
  const [loggedInTeamAvailability, setLoggedInTeamAvailability] = useState<IAvailability[]>([]);

  const [regionId, setRegionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get logged in user's team's regionId. Used to fetch courts in this region.
  useEffect(() => {
    const fetchLoggedInUsersTeamsRegion = async () => {
      if (isLoading || !user?.sub) return;
  
      try {
        const [currentUserResponse, activeSeasonResponse] = await Promise.all([
          fetch(`/api/users/auth0Id?auth0Id=${user.sub}`),
          fetch('/api/seasons/active'),
        ]);
  
        if (!currentUserResponse.ok) throw new Error("Failed to fetch user.");
        if (!activeSeasonResponse.ok) throw new Error("Failed to fetch active season.");
  
        const { user: currentUser } = await currentUserResponse.json();
        const activeSeason: ISeason = await activeSeasonResponse.json();
        if (activeSeason && activeSeason._id) {
          setActiveSeasonId(activeSeason._id);
        };
       
        const currentUsersTeamResponse = await fetch(
          `/api/teams/findByUserAndSeason?userId=${currentUser._id}&seasonId=${activeSeason._id}`
        );
  
        if (!currentUsersTeamResponse.ok) throw new Error("Failed to fetch current user's team.");
  
        const { team: currentUsersTeam } = await currentUsersTeamResponse.json();
        setCurrentUsersTeam(currentUsersTeam);
        setRegionId(currentUsersTeam.regionId);

        if (!currentUsersTeam.teammates || !Array.isArray(currentUsersTeam.teammates)) {
          throw new Error("Invalid team data: Missing or incorrect teammates.");
        }

        // Get current user's team's availability
        const teammatesAvailability = currentUsersTeam.teammates.map((teammate: IUser) =>
          (teammate.availability || []).map(({ day, time }: { day: string; time: string }) => ({
            day,
            date: "", // No date in user availability, setting default
            time,
            available: true, // Assume true since we fetch availability from DB
          }))
        );
        
        // ✅ Find the intersection (common availability between both teammates)
        const teamAvailability: IAvailability[] =
          teammatesAvailability.length > 1
            ? teammatesAvailability.reduce((acc: IAvailability[], teammateAvail: IAvailability[]) =>
                acc.filter((slot: IAvailability) =>
                  teammateAvail.some((t: IAvailability) => t.day === slot.day && t.time === slot.time)
                )
              )
            : teammatesAvailability[0] || [];
        
        setLoggedInTeamAvailability(teamAvailability);
        
      } catch (error) {
        console.error("Error fetching user, season, or team:", error);
        setError(error instanceof Error ? error.message : "Unknown error occurred. Code 505");
      }
    };
  
    fetchLoggedInUsersTeamsRegion();
  }, [isLoading, user?.sub]);
  
  
  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/teams?activeSeason=true`);
        if (!response.ok) throw new Error("Failed to fetch teams.");

        const data = await response.json();
        setTeams(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Fetch court availability when court filter changes
  useEffect(() => {
    if (!regionId) return;

    const fetchCourtAvailability = async () => {
      try {
        const response = await fetch(`/api/courts?regionId=${regionId}`);
        if (!response.ok) throw new Error("Failed to fetch courts.");

        const data = await response.json();
        const courts: ICourt[] = data.courts || [];
        console.log("courts:", data.courts)
        setCourts(courts); 

        // If "All Courts" is selected, merge availability from all courts
        if (!selectedCourt) {
          const mergedAvailability: IAvailability[] = courts.flatMap((court) => court.availability || []);
          setCourtAvailability(mergedAvailability);
        } else {
          // Fetch only the selected court's availability
          const selectedCourtData = courts.find((court) => court._id === selectedCourt._id);
          setCourtAvailability(selectedCourtData?.availability || []);
        }
      } catch (err) {
        console.error("Error fetching courts or availability:", err);
      }
    };
  
    fetchCourtAvailability();
  }, [selectedCourt, regionId]);

  useEffect(() => {
    console.log('court availability:', courtAvailability)
  }, [courtAvailability]);

  // Filter teams based on availability
  useEffect(() => {
    if (!teams || teams.length === 0 || courtAvailability.length === 0) {
      return;
    } 

    setLoading(true)
    const processTeams = async () => {
      try {
        const filtered: TeamWithAvailability[] = teams
          .filter((team) => team.teammates.length === 2)
          .map((team) => {
            const teammatesAvailability = team.teammates.map((teammate: IUser) =>
              (teammate.availability || []).map(({ day, time }: { day: string; time: string }) => ({
                day,
                date: "",
                time,
                available: true,
              }))
            );

            const teamAvailability: IAvailability[] =
              teammatesAvailability.length > 1
                ? teammatesAvailability.reduce((acc, teammateAvail) =>
                    acc.filter(slot => teammateAvail.some(t => t.day === slot.day && t.time === slot.time))
                  )
                : teammatesAvailability[0] || [];

            if (teamAvailability.length === 0) return null;

            const groupBy = (array: IAvailability[], key: keyof IAvailability) => {
              return array.reduce((acc, item) => {
                const group = item[key] as string;
                if (!acc[group]) acc[group] = [];
                acc[group].push(item);
                return acc;
              }, {} as Record<string, IAvailability[]>);
            };

            const sortTimeSlots = (a: string, b: string) => {
              const parseTime = (time: string) => new Date(`2000-01-01 ${time.split("-")[0]}`).getTime();
              return parseTime(a) - parseTime(b);
            };

            const getConsecutiveBlocks = (slots: string[]) => {
              const validBlocks: string[] = [];
              for (let i = 0; i <= slots.length - 4; i++) {
                const block = slots.slice(i, i + 4);
                if (isConsecutive(block)) {
                  validBlocks.push(block[0]); // Store the first time of the valid block
                }
              }
              return validBlocks;
            };

            const isConsecutive = (times: string[]): boolean => {
              if (times.length < 2) return false;
              for (let i = 0; i < times.length - 1; i++) {
                if (!isNextHalfHour(times[i], times[i + 1])) {
                  return false;
                }
              }
              return true;
            };

            const isNextHalfHour = (time1: string, time2: string): boolean => {
              const extractTimeParts = (time: string): { start: string; end: string; period: string } | null => {
                const match = time.match(/^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?(am|pm)$/);

                if (!match) return null;
            
                const [ , startHour, startMin = "00", endHour, endMin = "00", period] = match;
            
                return {
                  start: `${startHour}:${startMin}`, // e.g. "10:30"
                  end: `${endHour}:${endMin}`, // e.g. "11:00"
                  period // "am" or "pm"
                };
              };
            
              const prev = extractTimeParts(time1);
              const next = extractTimeParts(time2);
            
              if (!prev || !next) {
                return false;
              }
            
              // Convert both to 24-hour time for comparison
              const convertTo24Hour = (time: string, period: string): string => {
                const [hourStr, minStr] = time.split(":"); // Keep hour mutable, min immutable
                let hour = Number(hourStr);
                const min = Number(minStr); // Ensure min is constant
              
                if (period === "pm" && hour !== 12 && (hour !== 11 && min !== 30)) hour += 12;
                if (period === "am" && hour === 12) hour = 0;
              
                return `${hour}:${min.toString().padStart(2, "0")}`; // Ensure "HH:MM" format
              };
              
            
              const prevEnd = convertTo24Hour(prev.end, prev.period);
              const nextStart = convertTo24Hour(next.start, next.period);
              const isSequential = prevEnd === nextStart;
            
              return isSequential;
            };

            const findTwoHourBlocks = (loggedInSlots: string[],
              teamSlots: string[],
              courtSlots: string[],
            ) => {
            
              // ✅ Extract valid consecutive 2-hour blocks **first**
              const validLoggedInBlocks = getConsecutiveBlocks(loggedInSlots);
              const validTeamBlocks = getConsecutiveBlocks(teamSlots);
              const validCourtBlocks = getConsecutiveBlocks(courtSlots);
            
              // ✅ Find shared availability across all lists
              const finalMatches = validLoggedInBlocks.filter(time =>
                validTeamBlocks.includes(time) && validCourtBlocks.includes(time)
              );
                    
              console.log("✅ Final Matches:", finalMatches);
              return finalMatches;
            };  

            const findConsecutiveMatches = (
              teamAvailability: IAvailability[],
              loggedInTeamAvailability: IAvailability[],
              courtAvailability: IAvailability[]
            ) => {
              const matches: IAvailability[] = [];
            
              // ✅ Group availability by day
              const teamAvailabilityByDay = groupBy(teamAvailability, "day");
              const loggedInTeamAvailabilityByDay = groupBy(loggedInTeamAvailability, "day");
              const courtAvailabilityByDay = groupBy(courtAvailability, "day");
            
              for (const day in teamAvailabilityByDay) {
                if (!teamAvailabilityByDay[day] || !courtAvailabilityByDay[day]) {
                  continue;
                }

                const loggedInSlots = (loggedInTeamAvailabilityByDay[day] || []).map(slot => slot.time).sort(sortTimeSlots);
                const teamSlots = (teamAvailabilityByDay[day] || []).map(slot => slot.time).sort(sortTimeSlots);
                const courtSlots = (courtAvailabilityByDay[day] || []).map(slot => slot.time).sort(sortTimeSlots);
                const courtSlotsWithDate = (courtAvailabilityByDay[day] || []).map(slot => ({
                  day: slot.day,
                  date: slot.date,
                  time: slot.time,
                }));

                if (loggedInSlots.length === 0 || teamSlots.length === 0 || courtSlots.length === 0) {
                  continue;
                }
            
                // ✅ Find 2-hour consecutive blocks in both team & court availability
                const consecutiveMatches = findTwoHourBlocks(loggedInSlots, teamSlots, courtSlots);

                if (consecutiveMatches.length > 0) {
                  matches.push(
                    ...consecutiveMatches.map(time => {
                      const matchingCourtSlot = courtSlotsWithDate.find(slot => slot.time === time);
                      return {
                        day: matchingCourtSlot?.day || day, // ✅ Use day from court availability or fallback to loop day
                        date: matchingCourtSlot?.date || "", // ✅ Get the correct date from courtSlotsWithDate
                        time, // ✅ Use the matched time
                        available: true,
                      };
                    })
                  );
                }  else {
                  console.log(`❌ No 2-hour matches found for ${day}`);
                }
              }
            
              return matches;
            };     
      
            // Find matches with merged court availability (for "All Courts") or selected court
            const matchingAvailability = findConsecutiveMatches(
              teamAvailability,
              loggedInTeamAvailability,
              courtAvailability
            );

            console.log("✅ Matching Availability (2-hour blocks):", matchingAvailability);
      
            // If no matches with courts, exclude the team
            if (matchingAvailability.length === 0) return null;
      
            return {
              ...team,
              matchingAvailability: selectedCourt?.name === "Pickle Pop" ? matchingAvailability.slice(0, 3) : matchingAvailability.slice(0, 2), // ✅ Show only next 2 available matches
            };
          })
          .filter((team): team is TeamWithAvailability => !!team);

        setFilteredTeams(filtered);
      } catch (error) {
        console.error("Error processing teams:", error);
        setError('There was an error loading teams. Please try again.')
      } 
    };
      processTeams().finally(() => setLoading(false));
  }, [teams, courtAvailability, loggedInTeamAvailability, selectedCourt?.name]);
  
  const handleSelectChange = (value: string) => {
    if (value === "All") {
      setSelectedCourt(null);
    } else {
      const selected = courts.find((court) => court._id === value) || null;
      setSelectedCourt(selected);
    }
  };

  const createMatch = async(
    day: string, date: string, time: string,
    location: string, teams: string[],
    seasonId: string, regionId: string
  ) => {
    const matchPayload: Partial<IMatch> = {
      day,
      date,
      time,
      location,
      teams,
      seasonId,
      regionId
    }
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchPayload),
      })

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        console.error(`Failed to create match: ${errorData}`);
      }

      const newMatch = await response.json();
      const matchDetails = newMatch.match;

      console.log('match details:', matchDetails)

      if (!matchDetails || !matchDetails.teams || !Array.isArray(matchDetails.teams)) {
        console.error("Error: Match details or teams are missing.");
        return; // Prevent further execution
      }

      const toEmails: string[] = [];
      
      matchDetails.teams.forEach((team: ITeam) => {
        if (!team.teammates || !Array.isArray(team.teammates)) {
          console.warn(`Warning: No teammates found for team: ${team._id}`);
          return;
        }

        team.teammates.forEach((player: IUser) => {
          if (player.email && !toEmails.includes(player.email)) {
            toEmails.push(player.email);
          }
        });
      });

      const matchUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/chat/${matchDetails._id}`

      const emailPayload = {
        toEmails,
        matchUrl 
      }

      const emailResponse = await fetch(`/api/email/newMatchEmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

      console.log('chat email sent:', emailResponse)

      if (!emailResponse.ok) {
        const errorData: ApiErrorResponse = await emailResponse.json();
       console.error(`Failed to chat email: ${errorData.systemMessage}`);
      }

      router.push(`/chat/${matchDetails._id}`);

    } catch (error) {
      console.error("Error fetching user, season, or team:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred. Code 505");
    }
  }

  const defaultCourt = courts.length > 0 ? courts[0]._id : "All";

  useEffect(() => {
    if (courts.length > 0 && !selectedCourt) {
      setSelectedCourt(courts[0]);
    }
  }, [courts, selectedCourt]); 

  const convertToTwoHourSlot = (timeSlot: string): string => {
    const match = timeSlot.match(/^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?(am|pm)$/);
    if (!match) return "";
  
    const [ , startHourStr, startMin = "00", , , suffix ] = match;
    const startHour = parseInt(startHourStr, 10);
  
    let endHour = startHour + 2;
    let endSuffix = suffix;
  
    // Handle AM/PM transitions
    if (endHour >= 12) {
      if (endHour > 12) endHour -= 12;
      if (suffix === "am" && startHour < 10) endSuffix = "am"; // Still morning
      else endSuffix = "pm"; // Afternoon transition
    }
  
    // If the start time has ":30", ensure end time also has ":30"
    const startMinutes = startMin === "30" ? ":30" : "";
    const endMinutes = startMin === "30" ? ":30" : "";
  
    return `${startHour}${startMinutes}-${endHour}${endMinutes}${endSuffix}`;
  };

  const filterTimes = (availability: { date: string; day: string; time: string }[], selectedCourt: { name: string } | null) => {
    if (!selectedCourt || selectedCourt.name !== "Pickle Pop") return availability;
  
    return availability.filter((slot) => {
      const startTime = slot.time.split("-")[0]; // Extract start time (e.g., "1:30")
      return !startTime.includes(":30"); // Exclude times that start with ":30"
    });
  };

  if (!isLoading && !user) {
    router.push('/auth/login')
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
          <Heading>Challenge</Heading>
          <Text>
            Select a court to view available matches based on team and court availability. 
            Then select the team you want to challenge.
          </Text>
        </Flex>
      

        {/* Filters */}
      
        <Flex direction={'row'} p={'4'} gap={'3'}>
          {/*
          <Flex direction={'column'} gap={'2'} width={'50%'}>
            <Text>Date</Text>
            <DatePicker onDateSelect={setSelectedDate} />
          </Flex>
          */}
          <Flex direction={'column'} gap={'2'}>
            <Text weight={'bold'}>Viewing times for:</Text>
            <RadioCards.Root value={selectedCourt?._id || defaultCourt} onValueChange={handleSelectChange} columns={{initial: "2", md: "3"}}>
                {courts.map((court) => (
                  <RadioCards.Item key={court._id} value={court._id ?? ""}>
                    <Flex direction="column" width="100%" align="center">
                      <Text weight="bold">{court.name}</Text>
                    </Flex>
                  </RadioCards.Item>
                ))}
            </RadioCards.Root>
          </Flex>
        </Flex>

        {/* Loading and Error States */}
        {loading && <Spinner size="3" />}
        {error && <Text color="red">{error}</Text>}

        {/* Team List */}
        {!loading && !error && teams.length === 0 && <Text>No teams found.</Text>}

        <Grid columns={{ initial: "1", md: "2", lg: "3" }} gap="4" m="4">
          {/* ✅ Show a message when no teams match the court availability */}
          {!loading && filteredTeams.length === 0 ? (
            <Text color="gray" align="center">
              No teams or courts are available at this time. Try selecting a different court or checking back later.
            </Text>
          ) : (
            filteredTeams
            .filter((team) => team._id !== currentUsersTeam?._id)
            .map((team) => (
              <Card key={team._id} style={{border: '1px solid #8A7E00'}}>
                <Flex direction="column" pl="2">
                  {team.teammates.map((teammate) => (
                    <Flex direction={'row'} key={teammate._id} align="center" gap={'4'} wrap={'wrap'}>
                      <Avatar 
                        src={teammate.profilePicture}
                        alt={teammate.name} 
                        fallback={teammate.name?.charAt(0) || 'U'}
                        width="30" height="30"
                        radius="full"
                        mt={'2'}
                      />
                      <Flex direction={'column'}>
                        <Text>{teammate.name}</Text>
                      </Flex>

                      <Flex direction="column">
                        {teammate.dupr ? (
                          <Text weight={'bold'}>{teammate.dupr}</Text>
                        ) : teammate.skillLevel ? (
                          <Text weight={'bold'}>{teammate.skillLevel}</Text>
                        ) : (
                          <Text color="gray">N/A</Text> // Provide a fallback
                        )}
                      </Flex>
                    </Flex>
                    
                  ))}

                  {/* Available Times */}
                  <Flex direction="column" mt={'4'}>
                    <Text weight="bold">Next available:</Text>
                    {team.matchingAvailability && team.matchingAvailability.length > 0 ? (
                      filterTimes(team.matchingAvailability, selectedCourt).map((slot) => {
                        const [year, month, day] = slot.date.split("-"); // ["2025", "03", "06"]
                        const formattedDate = slot.date ? 
                          new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })
                            .format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day))) // ✅ Keep correct date
                          : "";

                        return (
                          <Text key={`${team._id}-${slot.day}-${slot.time}`}>
                            {slot.day}, {formattedDate} at {slot.time.split("-")[0]}
                            {slot.time.split("-")[1] === "12pm" ? "am" : slot.time.split("-")[1].slice(-2)}
                          </Text>
                        );
                      })
                    ) : (
                      <Text color="gray">No available times</Text>
                    )}
                  </Flex>

                  <Flex direction={'column'} align={'end'}>
                    <Button 
                      mt={'4'}
                      style={{width: '150px'}}
                      onClick={() => {
                        if (!currentUsersTeam?._id || !team?._id || !team.matchingAvailability.length) return;
                        
                        createMatch(
                          team.matchingAvailability[0].day ?? "",
                          team.matchingAvailability[0].date ?? "",
                          convertToTwoHourSlot(team.matchingAvailability[0].time) ?? "",
                          selectedCourt?._id ?? "",
                          [currentUsersTeam._id, team._id],
                          activeSeasonId ?? "",
                          regionId ?? ""
                        );
                      }}
                    >
                      Challenge
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            ))
          )}
        </Grid>
      </Flex>
    </Flex>
  );
}