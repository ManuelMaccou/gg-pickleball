'use client'

import { useEffect, useMemo, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Badge, Button, Callout, Card, Flex, Spinner, Table, Text } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons"
import * as Accordion from '@radix-ui/react-accordion';
import Image from "next/image";
import darkGgLogo from '../../../public/logos/gg_logo_black_transparent.png'
import { AdminPermissionType, IAchievement, IClient, IRewardCode, IUser } from "@/app/types/databaseTypes";
import { Types } from "mongoose";
import Link from "next/link";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import MobileMenu from "./components/MobileMenu";
import { redeemRewardAction } from "@/app/actions/redeemRewardAction";
import { useLocationRewardCodes } from '@/app/hooks/useLocationRewardCodes';
import MatchHistory from "@/components/sections/MatchHistory";
import { DateTime } from "luxon";
import { logError } from "@/lib/sentry/logger";

interface ClientStats {
  visits?: Date[];
  lastVisit?: Date;
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  matches?: Types.ObjectId[];
  achievements: {
    _id: Types.ObjectId;
    achievementId: Types.ObjectId;
    name: string;
    earnedAt: Date;
    count?: number;
  }[];
}

interface IPopulatedMatch {
  _id: Types.ObjectId;
  team1: {
    players: IUser[];
    score: number;
  };
  team2: {
    players: IUser[];
    score: number;
  };
  winners: IUser[];
  location: IClient; // or whatever your populated location type is
  matchId: string;
  createdAt: Date;
  updatedAt: Date;
}

type TopPlayer = {
  name: string;
  winCount: number;
};

const formatDate = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) {
    return '—';
  }
  // Check the type at runtime
  if (typeof dateInput === 'string') {
    // If it's a string, use fromISO
    return DateTime.fromISO(dateInput).toFormat('MM/dd/yy');
  } else if (dateInput instanceof Date) {
    // If it's a Date object, use fromJSDate
    return DateTime.fromJSDate(dateInput).toFormat('MM/dd/yy');
  }
  // Fallback for any other unexpected type
  return '—';
};

export default function GgpickleballAdmin() {

  const { user } = useUserContext();
  const router = useRouter();
  const isMobile =useIsMobile();
  
  const userId = user?.id
  const userName = user?.name
  
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [location, setLocation] = useState<IClient | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [isGettingMatches, setIsGettingMatches] = useState<boolean>(true);
  const [isGettingAchievementsAndRewards, setIsGettingAchievementsAndRewards] = useState<boolean>(true);
  const [matches, setMatches] = useState<IPopulatedMatch[] | []>([]);
  const [allClientAchievements, setAllClientAchievements] = useState<IAchievement[]>([]);
  const [allPlayers, setAllPlayers] = useState<IUser[]>([]);
  const [uniquePlayerCount, setUniquePlayerCount] = useState<number>(0);
  const [top5PlayersByWins, setTop5PlayersByWins] = useState<TopPlayer[]>([]);
  const [isAnalyzingPlayers, setIsAnalyzingPlayers] = useState<boolean>(true);
  //const [openAccordion, setOpenAccordion] = useState<string | null>(null); // If type = single
  const [openAccordion, setOpenAccordion] = useState<string[]>([]); // If type = multiple
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const { 
    rewardCodes: allRewardCodes, 
    isLoading: isGettingRewardCodes, 
    mutate: mutateRewardCodes // Get the mutate function for updates
  } = useLocationRewardCodes(location?._id);

  const handleRedeem = async (rewardCode: string) => {
  setRedeemError(null);
  setIsRedeeming(rewardCode);

  // --- 1. OPTIMISTIC UI UPDATE ---
  // Create a new Date object for the optimistic update.
  const optimisticDate = new Date();

  await mutateRewardCodes(
    (currentData) => {
      if (!currentData) return;
      
      const updatedCodes = currentData.rewardCodes.map(code => 
        code.code === rewardCode 
          // --- FIX 1: Provide a Date object, not a string ---
          ? { ...code, redeemed: true, redemptionDate: optimisticDate } 
          : code
      );
      return { ...currentData, rewardCodes: updatedCodes };
    },
    { revalidate: false }
  );

  try {
    // --- 2. CALL THE SERVER ACTION ---
    const result = await redeemRewardAction(rewardCode);

    if (!result.success) {
      logError(new Error(result.message), { 
        rewardCode,
        component: 'GgpickleballAdmin',
        context: 'Server action failed' 
      });
      // 2. Set a user-friendly error message for the UI
      setRedeemError(result.message);
      
      await mutateRewardCodes(); 
    } else {
      // --- 3. RE-VALIDATE WITH SERVER DATA ---
      await mutateRewardCodes(
        (currentData) => {
          if (!currentData) return;
          const updatedCodes = currentData.rewardCodes.map(code => {
            if (code.code === rewardCode) {
              return { 
                ...code, 
                redeemed: true, 
                // --- FIX 2: Parse the string from the server into a Date object ---
                redemptionDate: result.redemptionDate ? new Date(result.redemptionDate) : undefined
              };
            }
            return code;
          });
          return { ...currentData, rewardCodes: updatedCodes };
        },
        { revalidate: false } 
      );
    }
  } catch (error) {
     logError(error, { 
      rewardCode, 
      component: 'GgpickleballAdmin',
      context: 'Client-side exception' 
    });
    setRedeemError("An unexpected error occurred. Please try again.");

    await mutateRewardCodes();
  } finally {
    setIsRedeeming(null);
  }
};
  
  // Get admin data
  useEffect(() => {
    if (!userId) return;
  
    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);

        if (response.status === 204) {
          setAdminError("You don't have permission to access this page.");
          return;
        }

        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch admin data");
        }

        if (data.admin.permission) {
          setAdminPermission(data.admin.permission)
        };
  
        setLocation(data.admin.location);
      } catch (error: unknown) {
        console.error("Error fetching admin data:", error);
      
        if (error instanceof Error) {
          setAdminError(error.message);
        } else {
          setAdminError("Unknown error occurred");
        }
      
      } finally {
        setIsGettingAdmin(false);
      }
    };
  
    getAdminUser();
  }, [userId]);

  // Get all matches from admin's location
  useEffect(() => {
    if (!location) return;
  
    const getMatchesByLocation = async () => {
      setMatchError(null);
      try {
        const response = await fetch(`/api/match/location?locationId=${location._id}`);
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch match data");
        }

        setMatches(data.matches);
        
      } catch (error) {
        console.error("Error fetching admin data:", error);
        setMatchError((error as Error).message);
      } finally {
        setIsGettingMatches(false);
      }
    };
  
    getMatchesByLocation();
  }, [location]);

  // Get all achievements and rewards for this location
  useEffect(() => {
    if (!location) return;
  
    const fetchClientAchievementsAndRewards = async () => {
      try {
        const res = await fetch(`/api/client/achievements?clientId=${location._id}`);
        const data = await res.json();
  
        if (!res.ok) {
          console.error('Failed to fetch client achievements:', data.error || res.statusText);
          return;
        }
  
        setAllClientAchievements(data.achievements || []);
      } catch (error) {
        console.error('Error fetching client achievements:', error);
      } finally {
        setIsGettingAchievementsAndRewards(false);
      }
    };
  
    fetchClientAchievementsAndRewards();
  }, [location]);

  const achievementMap = useMemo(() => {
    const map = new Map<string, IAchievement>();
    allClientAchievements.forEach(ach => {
      map.set(ach.name, ach);
    });
    return map;
  }, [allClientAchievements]);
  
  // Get total player count and top 5 players for this location
  useEffect(() => {
    if (matches.length === 0) {
      setIsAnalyzingPlayers(false)
      return;
    }
     
  
    const playerMap = new Map<string, IUser>();
    const winCounts = new Map<string, { name: string; count: number }>();
  
    matches.forEach(match => {
      [...match.team1.players, ...match.team2.players].forEach(player => {
        playerMap.set(player._id.toString(), player);
      });
  
      match.winners.forEach(player => {
        const prev = winCounts.get(player.name) || { name: player.name, count: 0 };
        winCounts.set(player.name, { name: player.name, count: prev.count + 1 });
      });
    });
  
    const top5: TopPlayer[] = Array.from(winCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ name, count }) => ({ name, winCount: count }));
  
      setAllPlayers(
        Array.from(playerMap.values()).sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        )
      );
    setUniquePlayerCount(playerMap.size);
    setTop5PlayersByWins(top5);
    setIsAnalyzingPlayers(false);
  }, [matches]);

  const rewardsByUser = useMemo(() => {
    const map = new Map<string, IRewardCode[]>();
    if (!allRewardCodes) return map; // Return empty map if data is not yet loaded

    allRewardCodes.forEach(code => {
      if (code.userId) {
        const userId = code.userId.toString();
        if (!map.has(userId)) {
          map.set(userId, []);
        }
        map.get(userId)!.push(code);
      }
    });
    return map;
  }, [allRewardCodes]);
  
  // Final loading status
  useEffect(() => {
    if (!isGettingAdmin && !isGettingMatches && !isAnalyzingPlayers && !isGettingAchievementsAndRewards && !isGettingRewardCodes) {
      setIsLoading(false);
    }
  }, [isGettingAdmin, isGettingMatches, isAnalyzingPlayers, isGettingAchievementsAndRewards, isGettingRewardCodes]);

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push(`/auth/login?returnTo=/admin`)
    }
  })

  if (isMobile === null) {
    return null;
  }

  return (
    <Flex direction={'column'} minHeight={'100vh'}>

      {/* Header */}
      <Flex justify={"between"} align={'center'} direction={"row"} py={'4'} px={{initial: '3', md: '9'}}>
        <Flex direction={'column'} position={'relative'} maxWidth={'80px'}>
          <Image
            src={darkGgLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
          />
        </Flex>

        {!auth0IsLoading && (
          <Flex direction={'row'} align={'center'} justify={'center'}>
            <Text size={'3'} weight={'bold'} align={'right'}>
              {userName ? (
                auth0User 
                  ? `Welcome ${String(userName).includes('@') ? String(userName).split('@')[0] : userName}`
                  : `${String(userName).includes('@') ? String(userName).split('@')[0] : userName} (guest)`
              ) : ''}
            </Text>

            {isMobile && (
              <MobileMenu />
            )}

          </Flex>
        )}
      </Flex>
       
      {/* Location Logo */}
      {location && (
        <Flex direction={'column'} style={{backgroundColor: location?.bannerColor, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', zIndex: 2}}>
          <Flex direction={'column'} position={'relative'} height={{initial: '60px', md: '80px'}} my={'5'}>
            <Image
              src={location.admin_logo}
              alt="Location logo"
              priority
              fill
              style={{objectFit: 'contain'}}
            />
          </Flex>
        </Flex>
      )}

      {/* Dashboard */}
      <Flex direction={'column'} flexGrow={'1'} height={'600px'} width={'100vw'} maxWidth={'1500px'} px={'4'} style={{alignSelf: 'center'}}>
       {matchError ?? adminError ? (
          <>
            <Flex direction={'column'} justify={'center'} gap={'4'} display={adminError ? 'flex' : 'none'}>
              <Callout.Root size={'3'} color="red" >
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  {adminError}
                </Callout.Text>
              </Callout.Root>
            </Flex>
            <Flex direction={'column'} justify={'center'} gap={'4'} display={matchError ? 'flex' : 'none'}>
              <Callout.Root color="red">
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  {matchError}
                </Callout.Text>
              </Callout.Root>
            </Flex>
          </>
        ) : isLoading ? (
          <Flex direction={'column'} justify={'center'} align={'center'} mt={'9'}>
            <Spinner size={'3'} style={{color: 'black'}} />
          </Flex>
          ) : matches ? (
          <Flex direction={'row'} height={'100%'} gap={'4'} wrap={'wrap'} align={'stretch'}>
            
            {/* Left sidebar nav */}
            {!isMobile && adminPermission === 'admin' && (
              <Flex direction={'column'} width={'250px'} py={'4'} px={'2'} style={{backgroundColor: '#F1F1F1', borderRight: '1px solid #d3d3d3'}}>
                <Flex direction={'column'} gap={'3'} px={'2'}>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin'} style={{backgroundColor: 'white', borderRadius: '10px'}}>Dashboard</Link>
                  </Flex>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin/achievements'}>Set achievements</Link>
                  </Flex>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin/rewards'}>Configure rewards</Link>
                  </Flex>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin/upload-matches'}>Bulk upload matches</Link>
                  </Flex>
                </Flex>
              </Flex>
            )}
           
            <Flex direction={'row'} flexGrow={'1'} gap={'4'} maxHeight={{initial: "200px", md: '100%'}} pb={'7'}>
              <Flex>
              {/* PUT THE GROUP BELOW IN THIS, MAKE IT A COLUMN, AND ADD "ALL REWARDS" */}

              </Flex>
              <Flex direction={'row'} width={'50%'} gap={'4'}>
                {/* Total players and matches */}
                <Flex direction={{initial: 'row', md: 'column'}} maxHeight={'80%'} mt={'4'} flexGrow={'1'} gap={'4'}>
                  <Flex direction={'column'} flexGrow={'1'} minWidth={'200px'}>
                    <Card variant="classic" style={{height: '100%', alignContent: 'end'}}>
                      <Flex direction={'column'} gap={'4'}>
                        <Text size={'9'} align={'center'} weight={'bold'}>{uniquePlayerCount}</Text>
                        <Text size={'4'} align={'center'} style={{color: 'grey'}}>Total players</Text>
                      </Flex>
                    </Card>
                  </Flex>
                  
                  <Flex direction={'column'} flexGrow={'1'} minWidth={'150px'}>
                    <Card variant="classic" style={{height: '100%', alignContent: 'end'}}>
                      <Flex direction={'column'} gap={'4'}>
                        <Text size={'9'} align={'center'} weight={'bold'}>{matches.length}</Text>
                        <Text size={'4'} align={'center'} style={{color: 'grey'}}>Total matches</Text>
                      </Flex>
                    </Card>
                  </Flex>
                </Flex>

                  {/* Top players */}
                <Flex direction={'column'} mt={'4'} flexGrow={'1'} height={'100%'} maxHeight={{initial: "fit-content", md: '80%'}} minWidth={"300px"} width={'100%'} gap={'4'}>
                  <Text size={'4'} align={'center'} weight={'bold'} style={{color: 'black'}}>Top players by wins</Text>
                  <Card variant="classic" style={{flexGrow: 'inherit'}}>
                    <Flex direction={'column'} gap={'4'}>
                      <Table.Root size="1">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Wins</Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {top5PlayersByWins.map((player, idx) => (
                            <Table.Row key={idx}>
                              <Table.RowHeaderCell>{player.name}</Table.RowHeaderCell>
                              <Table.Cell>{player.winCount}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Flex>
                  </Card>
                </Flex>
              </Flex>
            
              {/* All players */}
              {location && (
                <Flex direction={'column'} mt={'4'} pb={'9'} flexGrow={'1'} height={{md: '100%'}} width={'50%'} overflow={{initial: 'visible', md: 'scroll'}}>
                  <Text size={'4'} weight={'bold'} style={{color: 'black'}} mb={'4'}>All players</Text>
                  <Accordion.Root type="multiple" value={openAccordion} onValueChange={setOpenAccordion}>
                    <Flex direction={'column'} gap={'1'}>
                      {allPlayers.map(player => {
                        const playerId = player._id.toString();
                        const playerRewards = rewardsByUser.get(playerId) || [];
                        const clientStats = (player.stats as unknown as Record<string, ClientStats>)?.[location._id.toString()];
                        const lastVisit = clientStats?.lastVisit
                          ? new Date(clientStats?.lastVisit).toLocaleDateString()
                          : '—';
                        // const isOpen = openAccordion === player._id.toString(); // If type = single
                        const isOpen = openAccordion.includes(player._id.toString()); // If type = multiple

                        return (
                          <Card key={player._id.toString()} variant="classic" 
                            style={{
                              backgroundColor: isOpen ? '#c4e1ff' : 'white',
                              transition: 'background-color 0.2s ease',
                            }}
                          >
                            <Accordion.Item value={player._id.toString()}>
                              <Accordion.Header>
                                <Accordion.Trigger style={{width: '100%', cursor: 'pointer',}}>
                                  <Flex direction={'row'} justify={'between'} align={'stretch'} py={'2'} maxWidth={{initial: '100%', md: '500px'}} wrap={'wrap'}>
                                    <Flex direction={'column'} align={'start'}>
                                      <Text size="2" weight="bold">{player.name}</Text>
                                      <Text size="2">{player.email ? player.email : "Guest player"}</Text>
                                    </Flex>
                                    
                                    <Text size="2">Last visit: {lastVisit}</Text>
                                  </Flex>
                                </Accordion.Trigger>
                              </Accordion.Header>
                              <Accordion.Content>

                                {/* Achievements Table */}
                                <Flex direction={'column'} mt={'5'}>
                                  <Text size={'4'} mb={'4'} weight={'bold'}>Acheivements</Text>
                                  <Table.Root size="1" variant="surface">
                                    <Table.Header>
                                      <Table.Row>
                                        <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>Earned on</Table.ColumnHeaderCell>
                                      </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                    {clientStats?.achievements?.map((ach) => {
                                      const achievement = achievementMap.get(ach.name);
                                      return (
                                        <Table.Row key={ach._id.toString()}>
                                          <Table.RowHeaderCell>{achievement?.friendlyName || ach.name}</Table.RowHeaderCell>
                                          <Table.Cell>
                                            {ach.earnedAt
                                              ? new Date(ach.earnedAt).toLocaleDateString()
                                              : '—'}
                                          </Table.Cell>
                                        </Table.Row>
                                      );
                                    })}
                                    </Table.Body>
                                  </Table.Root>
                                </Flex>
                                

                                {/* Rewards Table */}
                                <Flex direction={'column'} my={'5'}>
                                  <Text size={'4'} mb={'4'} weight={'bold'}>Rewards</Text>

                                  {redeemError && (
                                    <Callout.Root color="red" mb="3">
                                      <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                                      <Callout.Text>{redeemError}</Callout.Text>
                                    </Callout.Root>
                                  )}
                                  {playerRewards && playerRewards.length > 0 ? (
                                    <Table.Root size="1" variant="surface">
                                      <Table.Header>
                                        <Table.Row>
                                          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                                          <Table.ColumnHeaderCell>Code</Table.ColumnHeaderCell>
                                          <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                                          <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                        </Table.Row>
                                      </Table.Header>
                                      <Table.Body>
                                        {/* MAP OVER `playerRewards`*/}
                                        {playerRewards.map((rewardCodeEntry) => {
                                          const isCurrentButtonLoading = isRedeeming === rewardCodeEntry.code;
                                          
                                          // The `reward` details are embedded in the rewardCodeEntry
                                          const reward = rewardCodeEntry.reward; 

                                          return (
                                            <Table.Row key={rewardCodeEntry._id.toString()}>
                                              <Table.RowHeaderCell>
                                                <Flex direction={'column'}>
                                                  <Text>{reward.product !== 'custom' ? `${reward?.friendlyName} ${reward?.product}` : reward?.friendlyName }</Text>
                                                  {reward.product !== 'custom' && (
                                                    <Text>{reward.productDescription ? reward.productDescription : "All products"}</Text>
                                                  )}
                                                
                                                </Flex>
                                                </Table.RowHeaderCell>
                                              <Table.Cell style={{alignContent: 'center'}}>{rewardCodeEntry.code ?? '—'}</Table.Cell>
                                              <Table.Cell>
                                                {rewardCodeEntry.redeemed ? (
                                                  <Badge color="green">Redeemed</Badge>
                                                ) : (
                                                  <Button size={'1'}
                                                    onClick={() => {
                                                      if (rewardCodeEntry.code) {
                                                        handleRedeem(rewardCodeEntry.code);
                                                      }
                                                    }}
                                                    disabled={isCurrentButtonLoading}
                                                  >
                                                    {isCurrentButtonLoading ? <Spinner size="1"/> : 'Redeem'}
                                                  </Button>
                                                )}
                                              </Table.Cell>
                                              <Table.Cell>
                                                {formatDate(rewardCodeEntry.redemptionDate)}
                                              </Table.Cell>
                                            </Table.Row>
                                          );
                                        })}
                                      </Table.Body>
                                    </Table.Root>
                                    ) : (
                                    <Card>
                                      <Text as="p" size="2" color="gray" align="center">
                                        This player has not earned any rewards yet.
                                      </Text>
                                    </Card>
                                  )}
                                </Flex>

                                {/* Matches Table */}
                                <Flex direction={'column'} mb={'5'} mt={'9'}>
                                  <Text size={'4'} mb={'-4'} weight={'bold'}>Match History</Text>
                                  <MatchHistory userId={player._id.toString()} userName={player.name} locationId={location._id.toString()}/>
                                </Flex>

                              </Accordion.Content>
                            </Accordion.Item>
                          </Card>
                        );
                      })}
                    </Flex>
                  </Accordion.Root>
                </Flex>
              )}
            </Flex>
          </Flex>
        ) : null}
      </Flex>
    </Flex>
  )
}