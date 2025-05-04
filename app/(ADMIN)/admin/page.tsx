'use client'

import { useEffect, useMemo, useState } from "react";
import { useUserContext } from "@/app/contexts/UserContext";
import { Badge, Card, Flex, Spinner, Table, Text } from "@radix-ui/themes";
import * as Accordion from '@radix-ui/react-accordion';
import Image from "next/image";
import darkGgLogo from '../../../public/logos/gg_logo_black_transparent.png'
import { IAchievement, IAdmin, IClient, IReward, IUser } from "@/app/types/databaseTypes";
import { Types } from "mongoose";

interface ClientStats {
  checkins?: Date[];
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  matches?: Types.ObjectId[];
  achievements?: Record<string, { count?: number; earnedAt: Date[] }>;
  rewards?: Record<string, { code?: string; redeemed: boolean; redemptionDate?: Date }>;
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

export default function Ggupr() {
  const { user } = useUserContext();
  const userId = user?.id

  const [admin, setAdmin] = useState<IAdmin | null>(null);
  const [location, setLocation] = useState<IClient | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);
  const [isGettingMatches, setIsGettingMatches] = useState<boolean>(true);
  const [isGettingAchievementsAndRewards, setIsGettingAchievementsAndRewards] = useState<boolean>(true);
  const [matches, setMatches] = useState<IPopulatedMatch[] | []>([]);
  const [allClientAchievements, setAllClientAchievements] = useState<IAchievement[]>([]);
  const [rewardsPerAchievement, setRewardsPerAchievement] = useState<Record<string, IReward>>({});
  const [allPlayers, setAllPlayers] = useState<IUser[]>([]);
  const [uniquePlayerCount, setUniquePlayerCount] = useState<number>(0);
  const [top5PlayersByWins, setTop5PlayersByWins] = useState<TopPlayer[]>([]);
  const [isAnalyzingPlayers, setIsAnalyzingPlayers] = useState<boolean>(true);
  //const [openAccordion, setOpenAccordion] = useState<string | null>(null); // If type = single
  const [openAccordion, setOpenAccordion] = useState<string[]>([]); // If type = multiple
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);


  // Get admin data
  useEffect(() => {
    if (!userId) return;
  
    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);
        const data = await response.json();
  
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("You don't have permissions to view this page");
          } else {
            throw new Error(data.error || "Failed to fetch admin data");
          }
        }
  
        setAdmin(data.admin);
        setLocation(data.admin.location);
      } catch (error: unknown) {
        console.error("Error fetching admin data:", error);
      
        if (error instanceof Error) {
          setAdminError(error.message);
        } else {
          setAdminError("Unknown error occurred");
        }
      
        setAdmin(null);
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

        if (data.matches.length === 0) {
          setMatchError('No matches were found.')
        } else {
          setMatches(data.matches);
        }
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
        setRewardsPerAchievement(data.rewardsPerAchievement || {});
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

  const rewardMap = useMemo(() => {
    const map = new Map<string, IReward>();
    Object.values(rewardsPerAchievement).forEach(reward => {
      map.set(reward._id.toString(), reward);
    });
    return map;
  }, [rewardsPerAchievement]);

  useEffect(() => {
    console.log('achievement map:', achievementMap);
  }, [achievementMap])
  
  // Get total player count and top 5 players for this location
  useEffect(() => {
    if (matches.length === 0) return;
  
    const playerSet = new Set<IUser>();
    const winCounts = new Map<string, { name: string; count: number }>();
  
    matches.forEach(match => {
      [...match.team1.players, ...match.team2.players].forEach(player => {
        playerSet.add(player);
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
      Array.from(playerSet).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    );
    setUniquePlayerCount(playerSet.size);
    setTop5PlayersByWins(top5);
    setIsAnalyzingPlayers(false);
  }, [matches]);
  
  
  // Final loading status
  useEffect(() => {
    if (!isGettingAdmin && !isGettingMatches && !isAnalyzingPlayers && !isGettingAchievementsAndRewards) {
      setIsLoading(false)
    }
  }, [isGettingAdmin, isGettingMatches, isAnalyzingPlayers, isGettingAchievementsAndRewards])
  

  return (
    <Flex direction={'column'} minHeight={'100vh'} pt={'4'}>

      {/* GG Pickleball Logo */}
      <Flex direction={'column'} py={'5'}>
        <Flex direction={'column'} position={'relative'} px={'4'} align={'start'}>
          <Image
            src={darkGgLogo}
            alt="GG Picklebal Logo"
            height={540}
            width={960}
            style={{objectFit: 'contain', height: '40px', width: 'auto'}}
          />
        </Flex>
      </Flex>

      {/* Location Logo */}
      {location && (
        <Flex direction={'column'} style={{backgroundColor: admin?.bannerColor}}>
          <Flex direction={'column'} position={'relative'} height={{initial: '60px', md: '80px'}} my={'5'}>
            <Image
              src={location.logo}
              alt="Location logo"
              priority
              fill
              style={{objectFit: 'contain'}}
            />
          </Flex>
        </Flex>
      )}

      {/* Dashboard */}
      <Flex direction={'column'} p={{initial:'3', md: '5'}} height={'600px'} width={'100vw'} maxWidth={'1500px'} style={{alignSelf: 'center'}}>
        {matchError ?? adminError ? (
          <Flex direction={'column'} justify={'center'} align={'center'} gap={'4'}>
            <Badge size={'3'} color="red" style={{display: matchError ? "block" : 'none'}}>{matchError}</Badge>
            <Badge size={'3'} color="red" style={{display: adminError ? "block" : 'none'}}>{adminError}</Badge>
          </Flex>
        ) : isLoading ? (
          <Flex direction={'column'} justify={'center'} align={'center'} mt={'9'}>
            <Spinner size={'3'} style={{color: 'black'}} />
          </Flex>
        ) : matches ? (
          <Flex direction={'row'} height={'100%'} gap={'4'} wrap={'wrap'}>

            {/* Total players and matches */}
            <Flex direction={{initial: 'row', md: 'column'}} flexGrow={'1'} maxHeight={{initial: "200px", md: '80%'}} maxWidth={{initial: '100%', md: '20%'}} gap={'4'}>
              <Flex direction={'column'} flexGrow={'1'} minWidth={'150px'}>
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
            <Flex direction={'column'} flexGrow={'1'} height={'100%'} maxHeight={{initial: "fit-content", md: '80%'}} minWidth={"150px"} maxWidth={{initial: '100%', md: '20%'}} gap={'4'}>
              <Card variant="classic" style={{flexGrow: 'inherit'}}>
                <Flex direction={'column'} gap={'4'}>
                  <Text size={'4'} align={'center'} style={{color: 'grey'}}>Top players by wins</Text>
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

            {/* All players */}
            {location && (
              <Flex direction={'column'} pb={'9'} flexGrow={'1'} height={{md: '100%'}} maxWidth={{md: '100%'}} overflow={{initial: 'visible', md: 'scroll'}}>
               <Text size={'4'} style={{color: 'grey'}} mb={'4'}>All players</Text>
                <Accordion.Root type="multiple" value={openAccordion} onValueChange={setOpenAccordion}>
                  <Flex direction={'column'} gap={'1'}>
                    {allPlayers.map(player => {
                      const clientStats = (player.stats as unknown as Record<string, ClientStats>)?.[location._id.toString()];
                      const checkins = clientStats?.checkins ?? [];
                      const lastCheckin = checkins.length
                        ? new Date(checkins[checkins.length - 1]).toLocaleDateString()
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
                              <Accordion.Trigger style={{width: '100%'}}>
                                <Flex direction={'row'} justify={'between'} align={'stretch'} py={'2'} maxWidth={{initial: '100%', md: '500px'}} wrap={'wrap'}>
                                  <Text size="2" weight="bold">{player.name}</Text>
                                  <Text size="2">Last check-in: {lastCheckin}</Text>
                                </Flex>
                              </Accordion.Trigger>
                            </Accordion.Header>
                            <Accordion.Content>
                              {/* Achievements Table */}
                              <Flex direction={'column'} mt={'5'}>
                                <Text size="2" weight={'medium'} mb={'3'}>Achievements</Text>
                                <Table.Root size="1" variant="surface">
                                  <Table.Header>
                                    <Table.Row>
                                      <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>Last Earned</Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>Times Earned</Table.ColumnHeaderCell>
                                    </Table.Row>
                                  </Table.Header>
                                  <Table.Body>
                                    {Object.entries(clientStats?.achievements ?? {}).map(([achName, achData]) => {
                                      const achievement = achievementMap.get(achName);
                                      return (
                                        <Table.Row key={achName}>
                                          <Table.RowHeaderCell>{achievement?.friendlyName || achName}</Table.RowHeaderCell>
                                          <Table.Cell>
                                            {achData.earnedAt?.[0]
                                              ? new Date(achData.earnedAt[0]).toLocaleDateString()
                                              : '—'}
                                          </Table.Cell>
                                          <Table.Cell>{achData.count ?? achData.earnedAt?.length ?? 1}</Table.Cell>
                                        </Table.Row>
                                      );
                                    })}
                                  </Table.Body>
                                </Table.Root>
                              </Flex>
                             

                              {/* Rewards Table */}
                              <Flex direction={'column'} my={'5'}>
                                <Text size="2" weight={'medium'} mb={'3'}>Rewards</Text>
                                <Table.Root size="1" variant="surface">
                                  <Table.Header>
                                    <Table.Row>
                                      <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>Code</Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>Redeemed?</Table.ColumnHeaderCell>
                                    </Table.Row>
                                  </Table.Header>
                                  <Table.Body>
                                    {Object.entries(clientStats?.rewards ?? {}).map(([rewardId, rewardData]) => {
                                      const reward = rewardMap.get(rewardId);
                                      return (
                                        <Table.Row key={rewardId}>
                                          <Table.RowHeaderCell>{`${reward?.discount} ${reward?.product}`}</Table.RowHeaderCell>
                                          <Table.Cell>{rewardData.code ?? '—'}</Table.Cell>
                                          <Table.Cell>{rewardData.redeemed ? 'Yes' : 'No'}</Table.Cell>
                                        </Table.Row>
                                      );
                                    })}
                                  </Table.Body>
                                </Table.Root>
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
        ) : null}
      </Flex>
    </Flex>
  )
}