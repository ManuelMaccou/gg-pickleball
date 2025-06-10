'use client'

import { useUser as useAuth0User } from "@auth0/nextjs-auth0"
import { Badge, Box, Button, Dialog, Flex, RadioCards, Separator, Spinner, Text, TextField } from "@radix-ui/themes";
import Image from "next/image";
import lightGgLogo from '../../../../public/logos/gg_logo_white_transparent.png'
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { 
  claimAchievementUpdateTask,
  disconnectSocket,
  getSocket,
  initiateSocketConnection,
  notifyUpdatesFinished,
  subscribeToMatchSaved,
  subscribeToMatchSaveSuccessful,
  subscribeToPermissionGranted,
  subscribeToPlayerJoined,
  subscribeToScoreValidation
} from '../../../../socket';
import { debounce } from 'lodash';
import SuccessDialog from "@/app/components/SuccessDialog";
import { useRouter } from "next/navigation";
import QrCodeDialog from "@/app/components/QrCodeDialog";
import { useUserContext } from "@/app/contexts/UserContext";
import { IClient, IReward, SerializedAchievement } from "@/app/types/databaseTypes";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { updateUserAndAchievements } from "@/utils/achievementFunctions/updateUserAndAchievements";

type Player = {
  userName: string;
  userId: string;
  socketId: string;
};

interface UserEarnedData {
  userId: string;
  achievements: SerializedAchievement[];
  rewards: {
    rewardId: string;
    name: string;
    friendlyName: string;
    product: "open play" | "reservation" | "shop gear";
    discount: number;
  }[];
}

function GguprMatchPage() {

  const isMobile =useIsMobile();
  
  const { user: auth0User, isLoading: authIsLoading } = useAuth0User();
  const { user, setUser } = useUserContext()
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams()

  const [isCheckingUser, setIsCheckingUser] = useState<boolean>(true);

  const [tempName, setTempName] = useState<string>('');
  const [submittingName, setSubmittingName] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teammate, setTeammate] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState<boolean>(true);
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [yourScore, setYourScore] = useState<number | null>(null);
  const [opponentsScore, setOpponentsScore] = useState<number | null>(null);
  const [waitingForScores, setWaitingForScores] = useState(true);
  const [scoreMatch, setScoreMatch] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<IClient | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [userEarnedData, setUserEarnedData] = useState<UserEarnedData | null>(null);
  const [isSavingMatch, setIsSavingMatch] = useState<boolean>(false);
  const [matchSaved, setMatchSaved] = useState<boolean>(false);

  const params = useParams<{ matchId: string }>()
  const matchId = params.matchId;
  const locationParam = searchParams.get('location')  

  // set selected location
  useEffect(() => {
    const fetchClientById = async () => {
      const response = await fetch(`/api/client?id=${locationParam}`)
      if (response.ok) {
        const { client }: { client: IClient } = await response.json()
        setSelectedLocation(client);
      } else {
        setLocationError("There was an error loading the court location. We've logged the error. Please try again later.");
      }
    }

    if (locationParam) {
      fetchClientById();
    }
  }, [locationParam])

  // set last location cookie
  useEffect(() => {
    if (!locationParam) return
    document.cookie = `lastLocation=${locationParam}; path=/; max-age=${60 * 60 * 24 * 30}`;

  }, [locationParam])

  const handleNameSubmit = async () => {
    setSubmittingName(true);
    if (!tempName.trim()) return;

    try {
      const gguprResponse = await fetch('/api/user/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: tempName })
      });

      const gguprData = await gguprResponse.json();

      if (gguprResponse.ok) {
        
        setUser({
          id: gguprData.user._id,
          name: tempName,
          isGuest: true,
        })
      
        setError(null);

        const userId = gguprData.user._id;

        const newPlayer = { userName: tempName, userId, socketId: '' };
        setPlayers(prevPlayers => {
          const playerExists = prevPlayers.some(player => player.userName === tempName);
          if (playerExists) {
            return prevPlayers;
          }
          return [...prevPlayers, newPlayer];
        });

        // Initiate socket connection here
        if (matchId) {
          initiateSocketConnection(matchId, tempName, players);
        }
      } else {
        setError(gguprData.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      setError('An unexpected error occurred');
    } finally {
      setSubmittingName(false);
      router.refresh()
    }
  };
  
  const handleSubmitScores = useCallback(() => {
    const socket = getSocket();

    if (socket && socket.connected && matchId && user?.name) {

      socket.emit("submit-score", { 
        matchId, 
        userName: user.name, 
        team1, 
        team2, 
        yourScore, 
        opponentsScore,
        location: selectedLocation?._id.toString() || ""
      });
    }
  }, [matchId, user?.name, team1, team2, yourScore, opponentsScore, selectedLocation]); 

  const debouncedSubmitScores = useMemo(() => debounce(handleSubmitScores, 2000), [handleSubmitScores]);

  // Related to submitting the scores
  useEffect(() => {
    if (
      yourScore != null &&
      opponentsScore != null &&
      team1.length === 2 &&
      team2.length === 2
    ) {
      debouncedSubmitScores();
    }
    return () => debouncedSubmitScores.cancel();
  }, [yourScore, opponentsScore, team1, team2, debouncedSubmitScores, matchId, user?.name]);

  // Set players as they join
  useEffect(() => {
    if (!authIsLoading && user) {
      const newPlayer = { userName: user.name, userId: user.id, socketId: '' }
  
      setPlayers(prevPlayers => {
        const playerExists = prevPlayers.some(player => player.userName === user.name)
        if (playerExists) return prevPlayers
        return [...prevPlayers, newPlayer]
      })
    }
  
    setIsCheckingUser(false)
  }, [authIsLoading, user])

  // Initiating socket connection
  useEffect(() => {  
    if (user?.name && matchId && players.length > 0) {
      initiateSocketConnection(matchId, user.name, players);
    }
  }, [players, user?.name, matchId]);

  // Tracked joined players, score updates, and score validation
  useEffect(() => {
    if (user?.name && matchId && players.length > 0) {
  
      // Subscribe to player joined events
      subscribeToPlayerJoined((newPlayers: Player[]) => {
        setPlayers(newPlayers);
        setIsWaiting(newPlayers.length < 4);
      });
  
      // Subscribe to score validation results - Fires when validation completes
      subscribeToScoreValidation((data) => {
        setWaitingForScores(false);
        if (data.success) {
          setIsSavingMatch(true)
          setScoreError(null);
          setScoreMatch("Scores successfully validated.");
          setIsWaiting(false); 

          // --- TRIGGER THE SERVER-SIDE SAVE ---
          // requestSaveMatch(matchId);
          
        } else {
          setScoreError(data.message ?? "An unknown error occurred.");
          setScoreMatch(null);
          setIsWaiting(false); 
        }
      });
    }
  }, [user?.name, matchId, players]);
  
  // Saving the match and broadcasting success/error message
  useEffect(() => {
    if (user?.name && matchId && players.length > 0) {

      // --- NEW LOGIC: Step 1 ---
      // ALL clients listen for this and start the race to claim the task.
      subscribeToMatchSaveSuccessful((data) => {
        console.log("Core match saved. Racing to claim the update task...");
        // Immediately ask the server for permission to be the one to run the update.
        claimAchievementUpdateTask(matchId, data);
      });

      // Listener 1: The server's core save was successful, now we do our part.
      // --- NEW LOGIC: Step 2 ---
      // ONLY ONE client will receive this private "permission granted" message.
      subscribeToPermissionGranted(async (data) => {
        try {
          console.log("✅ Permission granted! I will now update the achievements.");
          setScoreMatch("Finalizing achievements...");

          // --- CALL YOUR LOCAL COMPLEX FUNCTION ---
          // This is now only run by the one "chosen" client.
          const achievementsResult = await updateUserAndAchievements(
            data.team1Ids,
            data.team2Ids,
            data.winners,
            data.location,
            data.newMatchId,
            data.team1Score,
            data.team2Score
          );

          // Tell the server we are done and what the result was.
          notifyUpdatesFinished(matchId, { earnedAchievements: achievementsResult.earnedAchievements });

        } catch (error) {
          console.error("Client-side error updating achievements:", error);
          // Tell the server we are done, but that we failed.
          notifyUpdatesFinished(matchId, { error: error as Error });
        }
      });
  
      // Listener 2: The final result of the entire process (success or failure)
      subscribeToMatchSaved((data) => {
        setIsSavingMatch(false);

        if (data.success) {

          const currentUserAchievements = data.earnedAchievements.find(e => e.userId === user?.id);
          if (currentUserAchievements && selectedLocation) {
            const rewards = currentUserAchievements.achievements
            .map(a => selectedLocation.rewardsPerAchievement?.[a.name])
            .filter((r): r is IReward => !!r)
            .map((reward) => ({
              rewardId: reward._id.toString(),
              name: reward.name,
              friendlyName: reward.friendlyName,
              product: reward.product,
              discount: reward.discount,
            }));
          
            setUserEarnedData({
              userId: currentUserAchievements.userId,
              achievements: currentUserAchievements.achievements,
              rewards
            });
          }
            
          setSaveSuccessMessage(data.message);
          setSaveErrorMessage(null);
          setMatchSaved(true);
          setShowDialog(true);

        } else {
          setSaveErrorMessage(data.message ?? "An unknown error occurred."); 
          setSaveSuccessMessage(null);
        }
      });
    } 
  }, [user?.name, user?.id, matchId, players, authIsLoading, auth0User, selectedLocation]);

  // Leave rooms when they leave the page
  useEffect(() => {
    // Cleanup logic when the component unmounts or the pathname changes
    return () => {
      if (!pathname.startsWith('/matchId')) { // Adjust based on your route structure
        disconnectSocket();
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (showDialog) {
      // Blur all active elements outside the dialog
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [showDialog]);

  if (isMobile === null) {
    return null;
  }

  if (!isMobile) {
    return (
      <Flex direction={'column'} minHeight={'100dvh'} p={'4'} justify={'center'} gap={'7'}>
        <Flex direction={'column'} position={'relative'} align={'center'} mt={'-9'} p={'7'}>
          <Image
            src={lightGgLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
            style={{
              width: 'auto',
              maxHeight: '170px',
            }}
          />
        </Flex>

        <Flex direction={'column'} justify={'center'} align={'center'}>
          <Text size={'6'} align={'center'}>This app is optimized for mobile devices only.</Text>
        </Flex>
      </Flex>
    )
  }

  if (locationError) {
    return (
    <Flex direction={'column'} minHeight={'100dvh'} p={'4'} justify={'center'} align={'center'} gap={'7'}>
      <Flex position={'relative'} justify={'center'} align={'center'} height={'100px'}>
        {selectedLocation && (
          <Image
            src={selectedLocation.logo}
            alt="Location logo"
            priority
            fill
            style={{objectFit: 'contain'}}
          />
        )}
      </Flex>

      {locationError && (
        <Badge color="red" size={'3'}>
          <Text align={'center'} wrap={'wrap'}>{locationError}</Text>
        </Badge>
      )}
      <Button mt={'5'} onClick={() => router.push('/play')}>Go back</Button>
    </Flex>
    )
  }

  if (!user) {
    return (
      <Flex direction={'column'} minHeight={'100dvh'} p={'4'} justify={'center'} gap={'7'}>
        <Flex position={'relative'} justify={'center'} align={'center'} height={'100px'}>
          {selectedLocation && (
            <Image
              src={selectedLocation.logo}
              alt="Location logo"
              priority
              fill
              style={{objectFit: 'contain'}}
            />
          )}
        </Flex>

        {!isCheckingUser && !user && !authIsLoading ? (
          <Flex direction={'column'} gap={'4'} mt={'4'}>
            <TextField.Root 
              size={'3'}
              type="text" 
              value={tempName} 
              onChange={(e) => setTempName(e.target.value)} 
              placeholder="Enter your player name"
            />

            <Button size={'3'} mb={'4'} disabled={submittingName || !tempName} loading={submittingName} onClick={handleNameSubmit}>
              Continue (quick)
            </Button>
            {error && (
                 <Badge size={'3'} color='red'>
                 
                  {error}
            
                  
                 </Badge>
              )}
            <Text align={'center'}>----- or -----</Text>
            <Button size={'3'} variant='outline' onClick={() => router.push(`/auth/login?screen_hint=signup&returnTo=${pathname}`)}>Create account / Log in</Button>
            
          </Flex>

        ) : (
            <Flex direction={'column'} justify={'center'} align={'center'}>
              <Spinner />
            </Flex>
        )}
      </Flex>
    )
  }

  return (
    <Flex direction={'column'} minHeight={'100vh'} p={'4'} style={{paddingBottom: '150px'}}>
      <Flex justify={"between"} align={'center'} direction={"row"} pt={"2"} pb={"5"} px={'2'}>
        <Flex direction={'column'} position={'relative'} maxWidth={'80px'}>
            <Image
            src={lightGgLogo}
            alt="ggupr dark logo"
              priority
            height={540}
            width={960}
            />
        </Flex>

        {!authIsLoading && (
          <Flex direction={'column'} justify={'center'} gap={'4'}>
            <Text size={'3'} weight={'bold'} align={'right'}>
              {user.name ? (
                auth0User 
                  ? (String(user.name).includes('@') ? String(user.name).split('@')[0] : user.name)
                  : `${String(user.name).includes('@') ? String(user.name).split('@')[0] : user.name} (guest)`
              ) : ''}
            </Text>
          </Flex>
        )}
      </Flex>
      
        <SuccessDialog 
          showDialog={showDialog}
          setShowDialog={setShowDialog}
          userEarnedData={userEarnedData}
        />
      
      <Flex direction={'row'} mt={'5'} justify={'between'}>
        {matchId && (
          <Flex direction={'column'}>
            <QrCodeDialog matchId={matchId} selectedLocation={selectedLocation?._id.toString() || ""} />
          </Flex>
        )}
        {!matchSaved && (
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="soft" color="red">Cancel match</Button>
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>Cancel match</Dialog.Title>
              <Dialog.Description>Are you sure? You will lose data for this match.</Dialog.Description>
              <Dialog.Close>
                <Flex direction={'row'} align={'stretch'} justify={'between'} mt={'5'}>
                  <Button size={'3'} variant="outline">Go back</Button>
                  <Button size={'3'} onClick={() => router.push("/play")}>Yes</Button>
                </Flex>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Root>
        )}
       
      </Flex>

      {isWaiting && (
        <Flex direction={'column'} mt={'4'}>
          <Badge color="blue" size={'3'} mb={'5'}>Waiting for players to join...</Badge>
        </Flex>
      )}

{/**
 {players.length < 4 ? (
          <Button
          size="3"
          variant="solid"
          onClick={simulatePlayersJoining}
        >
          Simulate All Players Joined
        </Button>
      ) : (
        <Button
          size="3"
          color="green"
          variant="solid"
          onClick={simulateScoreSubmissions}
          disabled={players.length < 4}
        >
          Simulate Scores
        </Button>
      )}
 */}
      

      <Flex direction={'column'} mt={isWaiting ? '0' : '4'}>
        {players.length >=2 && (
           <Text weight={'bold'} size={'3'} mb={'5'}>Select your partner</Text>
        )}
       
        <Box maxWidth="600px">
          <RadioCards.Root
            value={teammate || ""}
            onValueChange={(value) => {
              setTeammate(value);

              // Ensure currentPlayer is not null before proceeding
              if (!user.name || !value) {
                console.error("UserName or selected teammate is null");
                return;
              }

              const selectedTeammate = value;
              const currentPlayer = user.name;

              const newTeam1: string[] = [currentPlayer, selectedTeammate];
              const newTeam2: string[] = players
                .filter(player => !newTeam1.includes(player.userName))
                .map(player => player.userName);

              setTeam1(newTeam1);
              setTeam2(newTeam2);

              // Access the socket instance here
              const socket = getSocket();
              
              if (socket && socket.connected && matchId) {
                socket.emit("set-teams", { matchId, team1: newTeam1, team2: newTeam2 });
              } else {
                console.error("Socket is not connected or does not exist.");
              }
            }}
            columns={{ initial: "1", sm: "2" }}
          >
            {players
            .filter(player => player.userName !== user.name)
            .map((player) => (
              <RadioCards.Item key={player.socketId} value={player.userName}>
                <Flex direction="column" width="100%">
                  <Text size={'5'} weight="bold">
                    {player.userName.includes('@') ? player.userName.split('@')[0] : player.userName}
                  </Text>
                </Flex>
              </RadioCards.Item>
            ))}
        </RadioCards.Root>


        </Box>
      </Flex>

      {teammate && (
        <>
          <Flex direction={'column'}>
            <Separator size={'4'} my={'5'} />
          </Flex>

          {waitingForScores && (
            <Badge color="blue" size={'3'} mb={'5'}>
              Waiting for scores...
            </Badge>
          )}

          {scoreMatch && (
            <Badge color="green" size={'3'}>
              {scoreMatch}
            </Badge>
          )}

          {isSavingMatch && !saveSuccessMessage && (
            <Flex direction={'row'} align={'center'} gap={'2'} mt={'3'}>
              <Spinner style={{color: 'white'}} />
              <Text size={'3'}>saving match...</Text>
            </Flex>
          )}

          {scoreError && (
            <Badge color="red" size={'3'}>
              {scoreError}
            </Badge>
          )}

          {saveErrorMessage && (
            <Flex direction={'column'} mt={'4'}>
              <Badge color="red" size={'3'} mb={'5'}>{saveErrorMessage}</Badge>
            </Flex>
          )}

          {saveSuccessMessage && (
            <Flex direction={'column'} mt={'4'}>
              <Badge color="green" size={'3'} mb={'5'}>{saveSuccessMessage}</Badge>
            </Flex>
          )}

          {team1.length === 2 && team2.length === 2 && (
            <Flex direction={'column'} gap={'4'} mt={'5'}>
              <Flex direction={'column'} gap={'2'}>
                <Text weight={'bold'} size={'3'}>Your Team&apos;s Score</Text>
                <TextField.Root 
                  size={'3'}
                  type="number"
                  value={yourScore !== null ? yourScore.toString() : ''}
                  onChange={(e) => setYourScore(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  placeholder="Enter your team's score"
                  disabled={matchSaved || isSavingMatch}
                />
              </Flex>
              <Flex direction={'column'} gap={'2'}>
                <Text weight={'bold'} size={'3'}>Opponent&apos;s Score</Text>
                <TextField.Root 
                  size={'3'}
                  type="number"
                  value={opponentsScore !== null ? opponentsScore.toString() : ''}
                  onChange={(e) => setOpponentsScore(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  placeholder="Enter opponent's score"
                  disabled={matchSaved || isSavingMatch}
                />
               
              </Flex>
            </Flex>
          )}
        </>
      )}

      {matchSaved && (
        <Flex direction={'column'} mt={'6'}>
          <Button size={'3'} onClick={() => router.push('/play')}>Log new match</Button>
        </Flex>
      )}
      
    </Flex>
  )
}

export default function GguprMatch() {
  return (
    <Suspense>
      <GguprMatchPage />
    </Suspense>
  )
}