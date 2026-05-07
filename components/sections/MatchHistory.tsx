"use client";

import { useEffect, useState, useCallback } from "react";
import { Flex, Table, Text, Button, Dialog, Card, Box } from "@radix-ui/themes";
import { PopulatedMatch } from "@/app/types/frontendTypes";
import React from "react";

type MatchHistoryProps = {
  userId: string;
  userName: string;
  locationId: string;
};

type Cursor = { after: string; lastId: string } | null;

async function fetchMatchData({
  userId,
  locationId,
  cursor,
  signal,
}: {
  userId: string;
  locationId: string;
  cursor: Cursor;
  signal?: AbortSignal;
}): Promise<{ matches: PopulatedMatch[]; hasNextPage: boolean }> {
  const url = new URL(`/api/match/user-and-location`, window.location.origin);
  url.searchParams.set("userId", userId);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("limit", "10");

  if (cursor) {
    url.searchParams.set("after", cursor.after);
    url.searchParams.set("lastId", cursor.lastId);
  }

  const res = await fetch(url.toString(), { signal });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch matches");
  return { matches: data.matches, hasNextPage: data.hasNextPage };
}

// --- NEW: TOP BANNER COMPONENT ---
const InviteFriendsBanner = () => {
  const shareText = "Hey I joined a pickleball rewards platform and thought you might want to check it out. It syncs with your DUPR. https://www.ggpickleball.com/play";

  const handleSms = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${separator}body=${encodeURIComponent(shareText)}`;
  };

  const handleEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent("Claim your GG Pickleball Rewards!")}&body=${encodeURIComponent(shareText)}`;
  };

  return (
    <Card size="2" style={{ backgroundColor: 'var(--blue-2)', border: '1px solid var(--blue-5)', marginBottom: '16px' }}>
      <Flex justify="between" align="center" direction={{ initial: 'column', sm: 'row' }} gap="4">
        <Box>
          <Text as="div" weight="bold" size="3" style={{ color: 'var(--blue-11)' }}>
            Seeing "Unclaimed Account"?
          </Text>
          <Text as="div" size="2" style={{ color: 'var(--blue-11)', opacity: 0.9 }}>
            Invite your partners so they can claim their profile and unlock their rewards.
          </Text>
        </Box>

        <Dialog.Root>
          <Dialog.Trigger>
            <Button variant="soft" color="blue" style={{ cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
              Invite Friends
            </Button>
          </Dialog.Trigger>

          <Dialog.Content maxWidth="400px" style={{ borderRadius: '16px' }}>
            <Dialog.Title>Invite Your Friends</Dialog.Title>
            <Dialog.Description size="2" mb="5" color="gray">
              Send your partner a link so they can claim their account and unlock their rewards!
            </Dialog.Description>

            <Flex direction="column" gap="3">
              <Button size="3" variant="soft" color="blue" onClick={handleSms} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Send Text Message
              </Button>
              
              <Button size="3" variant="soft" color="gray" onClick={handleEmail} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Send Email
              </Button>
            </Flex>

            <Flex justify="end" mt="5">
              <Dialog.Close>
                <Button variant="ghost" color="gray" style={{ cursor: 'pointer' }}>Cancel</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Card>
  );
};

// --- SIMPLIFIED: PLAYER NAME DISPLAY ---
const PlayerNameDisplay = ({ name, isMain }: { name: string, isMain?: boolean }) => {
  if (name === "Unclaimed Account") {
    return (
      <Text size="2" color="gray" mt={isMain ? "0" : "1"} style={{ fontStyle: 'italic' }}>
        Unclaimed Account
      </Text>
    );
  }

  return (
    <Text 
      size={isMain ? "3" : "2"} 
      weight={isMain ? "bold" : "regular"} 
      style={{ color: isMain ? 'var(--slate-12)' : 'var(--slate-11)' }}
      mt={isMain ? "0" : "1"}
    >
      {name}
    </Text>
  );
};

export default function MatchHistory({ userId, userName, locationId }: MatchHistoryProps) {
  const [matches, setMatches] = useState<PopulatedMatch[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (loading || !hasNextPage) return;

    setLoading(true);
    setError(null);

    try {
      const { matches: newMatches, hasNextPage: more } = await fetchMatchData({
        userId,
        locationId,
        cursor,
      });

      setMatches((prevMatches) => [...prevMatches, ...newMatches]);

      if (newMatches.length > 0) {
        const lastMatch = newMatches[newMatches.length - 1];
        setCursor({
          after: new Date(lastMatch.matchDate).toISOString(),
          lastId: lastMatch._id.toString(),
        });
      }

      setHasNextPage(more);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, locationId, cursor, hasNextPage, loading]);

  useEffect(() => {
    if (!locationId) return;

    const controller = new AbortController();

    const loadInitial = async () => {
      setMatches([]);
      setCursor(null);
      setHasNextPage(true);
      setError(null);
      setLoading(true);

      try {
        const { matches: initialMatches, hasNextPage: more } = await fetchMatchData({
          userId,
          locationId,
          cursor: null,
          signal: controller.signal,
        });

        setMatches(initialMatches);

        if (initialMatches.length > 0) {
          const last = initialMatches[initialMatches.length - 1];
          setCursor({
            after: new Date(last.matchDate).toISOString(),
            lastId: last._id.toString(),
          });
        }

        setHasNextPage(more);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err);
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
    return () => controller.abort();
  }, [locationId, userId]);

  return (
    <Flex direction="column" gap="4">
      {/* Invite Banner at the top */}
      {matches.length > 0 && <InviteFriendsBanner />}

      {matches.length > 0 ? (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell />
              <Table.ColumnHeaderCell />
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {(() => {
              let lastRenderedDate: string | null = null;

              return matches.map((match) => {
                const matchDate = new Date(match.matchDate);
                const matchDateString = matchDate.toLocaleDateString();

                const showDate = matchDateString !== lastRenderedDate;
                if (showDate) lastRenderedDate = matchDateString;

                const isTeam1 = match.team1.players.some((p) => p._id.toString() === userId);
                const userTeam = isTeam1 ? match.team1 : match.team2;
                const opponentTeam = isTeam1 ? match.team2 : match.team1;
                const didWin = match.winners.some((w) => w._id.toString() === userId);

                // --- 1. RESOLVE USER NAME ---
                const userPlayer = userTeam.players.find((p) => p._id.toString() === userId);
                const userPlayerName = userPlayer?.name ?? userName;

                // --- 2. RESOLVE PARTNER NAME ---
                const partnerObj = userTeam.players.find((p) => p._id.toString() !== userId);
                let partnerName = partnerObj?.name;

                if (!partnerName && userTeam.playerNames && userTeam.playerNames.length > 0) {
                    partnerName = userTeam.playerNames.find(
                        name => name.trim().toLowerCase() !== userPlayerName.toLowerCase()
                    );
                    if (!partnerName && userTeam.playerNames.length > 1) {
                         partnerName = userTeam.playerNames[1];
                    }
                }
                if (!partnerName) partnerName = "[Partner]";

                // --- 3. RESOLVE OPPONENTS ---
                let opp1 = opponentTeam.players[0]?.name;
                let opp2 = opponentTeam.players[1]?.name;

                if (!opp1 && opponentTeam.playerNames?.[0]) opp1 = opponentTeam.playerNames[0];
                if (!opp2 && opponentTeam.playerNames?.[1]) opp2 = opponentTeam.playerNames[1];

                return (
                  <React.Fragment key={match._id.toString()}>
                    {showDate && (
                      <Table.Row style={{backgroundColor: '#f1faff'}}>
                        <Table.Cell colSpan={4}>
                          <Text weight={'bold'} color="gray">{matchDateString}</Text>
                        </Table.Cell>
                      </Table.Row>
                    )}

                    <Table.Row>
                      <Table.Cell>
                        <Flex direction="row" align="center" gap="6">
                          <Flex direction="column">
                            {/* FIX: Using simplified component */}
                            <PlayerNameDisplay name={userPlayerName} isMain={true} />
                            <PlayerNameDisplay name={partnerName} />
                          </Flex>
                          <Text size="5" weight="bold">{userTeam.score}</Text>
                        </Flex>
                      </Table.Cell>

                      <Table.Cell>
                        <Flex direction="row" align="center" gap="6">
                          <Flex direction="column">
                            {/* FIX: Using simplified component */}
                            <PlayerNameDisplay name={opp1 || "Unknown"} />
                            <PlayerNameDisplay name={opp2 || "Unknown"} />
                          </Flex>
                          <Text size="5" weight="bold">{opponentTeam.score}</Text>
                        </Flex>
                      </Table.Cell>

                      <Table.Cell>
                        <Flex direction="column" justify="center" height="100%">
                           <Text color={didWin ? "green" : "red"} weight="bold">
                              {didWin ? "W" : "L"}
                           </Text>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  </React.Fragment>
                );
              });
            })()}

          </Table.Body>
        </Table.Root>
      ) : (
        <Flex direction="column" align="center" justify="center">
          <Text align="center" mt="7">
            No matches recorded yet.
          </Text>
        </Flex>
      )}

      {error && <Text color="red">{error}</Text>}

      {hasNextPage && (
        <Button variant="ghost" mt="5" onClick={() => fetchMatches()} disabled={loading}>
          {loading ? "Loading..." : "Load More"}
        </Button>
      )}
    </Flex>
  );
}