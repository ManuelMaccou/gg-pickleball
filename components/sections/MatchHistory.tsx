"use client";

import { useEffect, useState, useCallback } from "react";
import { Flex, Table, Text, Button, Dialog, Card, Box, Badge } from "@radix-ui/themes";
import { PopulatedMatch } from "@/app/types/frontendTypes";
import React from "react";

type MatchHistoryProps = {
  userId: string;
  userName: string;
  locationId: string;
};

type Cursor = { after: string; lastId: string } | null;

// ── fetchMatchData — unchanged ──
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

// ── InviteFriendsBanner — all logic unchanged, visual update only ──
const InviteFriendsBanner = () => {
  const shareText = "Hey I joined a pickleball rewards platform and thought you might want to check it out. It syncs with your DUPR. https://www.ggpickleball.com/play";

  // SMS handler — iOS detection logic unchanged
  const handleSms = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${separator}body=${encodeURIComponent(shareText)}`;
  };

  // Email handler — unchanged
  const handleEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent("Claim your GG Pickleball Rewards!")}&body=${encodeURIComponent(shareText)}`;
  };

  return (
    <Box
      mb="4"
      style={{
        background: 'rgba(163,230,53,0.06)',
        border: '0.5px solid rgba(163,230,53,0.2)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <Flex justify="between" align="center" direction={{ initial: 'column', sm: 'row' }} gap="4">
        <Box>
          <Text as="div" weight="bold" size="2" style={{ color: '#a3e635', marginBottom: 3 }}>
            Seeing &ldquo;Unclaimed Account&rdquo;?
          </Text>
          <Text as="div" size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Invite your partners so they can claim their profile and unlock their rewards.
          </Text>
        </Box>

        {/* Dialog — all internals unchanged */}
        <Dialog.Root>
          <Dialog.Trigger>
            <Button
              variant="solid"
              radius="full"
              style={{
                backgroundColor: '#a3e635',
                color: '#0a0a0a',
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
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
    </Box>
  );
};

// ── PlayerNameDisplay — logic unchanged, text colors updated for dark bg ──
const PlayerNameDisplay = ({ name, isMain }: { name: string; isMain?: boolean }) => {
  if (name === "Unclaimed Account") {
    return (
      <Text size="2" mt={isMain ? "0" : "1"} style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>
        Unclaimed Account
      </Text>
    );
  }

  return (
    <Text
      size={isMain ? "3" : "2"}
      weight={isMain ? "bold" : "regular"}
      mt={isMain ? "0" : "1"}
      style={{ color: isMain ? '#fff' : 'rgba(255,255,255,0.55)' }}
    >
      {name}
    </Text>
  );
};

// ── MatchHistory — all state, effects, cursor, and name resolution unchanged ──
export default function MatchHistory({ userId, userName, locationId }: MatchHistoryProps) {
  const [matches, setMatches] = useState<PopulatedMatch[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── fetchMatches (pagination) — unchanged ──
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

  // ── Initial load with AbortController — unchanged ──
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
    <Flex direction="column">
      {/* Invite banner — only shown when matches exist, same condition as original */}
      {matches.length > 0 && <InviteFriendsBanner />}

      {matches.length > 0 ? (
        <Table.Root>
          <Table.Header>
            {/* Empty header row preserved — same as original */}
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

                // ── Team/win resolution — unchanged ──
                const isTeam1 = match.team1.players.some((p) => p._id.toString() === userId);
                const userTeam = isTeam1 ? match.team1 : match.team2;
                const opponentTeam = isTeam1 ? match.team2 : match.team1;
                const didWin = match.winners.some((w) => w._id.toString() === userId);

                // ── Name resolution — unchanged ──
                const userPlayer = userTeam.players.find((p) => p._id.toString() === userId);
                const userPlayerName = userPlayer?.name ?? userName;

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

                let opp1 = opponentTeam.players[0]?.name;
                let opp2 = opponentTeam.players[1]?.name;
                if (!opp1 && opponentTeam.playerNames?.[0]) opp1 = opponentTeam.playerNames[0];
                if (!opp2 && opponentTeam.playerNames?.[1]) opp2 = opponentTeam.playerNames[1];

                return (
                  <React.Fragment key={match._id.toString()}>
                    {/* Date separator row */}
                    {showDate && (
                      <Table.Row>
                        <Table.Cell colSpan={4} style={{ padding: '10px 12px 6px' }}>
                          <Text
                            size="1"
                            weight="bold"
                            style={{
                              color: 'rgba(255,255,255,0.35)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                            }}
                          >
                            {matchDateString}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )}

                    {/* Match row */}
                    <Table.Row
                      style={{
                        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* User team */}
                      <Table.Cell style={{ padding: '12px' }}>
                        <Flex justify={'between'} direction="row" align="center" >
                          <Flex direction="column">
                            <PlayerNameDisplay name={userPlayerName} isMain={true} />
                            <PlayerNameDisplay name={partnerName} />
                          </Flex>
                          <Flex direction={'row'} align={'center'} justify={'center'} mr={{initial: '0', md: '9'}}>
                            <Text
                              size="6"
                              weight="bold"
                              style={{ color: '#fff', minWidth: 24, textAlign: 'center' }}
                            >
                              {userTeam.score}
                            </Text>

                          </Flex>
                         
                        </Flex>
                      </Table.Cell>

                      {/* Opponent team */}
                      <Table.Cell style={{ padding: '12px' }}>
                        <Flex justify={'between'} direction="row" align="center" gap="5">
                          <Flex direction="column">
                            <PlayerNameDisplay name={opp1 || "Unknown"} />
                            <PlayerNameDisplay name={opp2 || "Unknown"} />
                          </Flex>
                          <Flex direction={'row'} align={'center'} justify={'center'} mr={'9'}>
                            <Text
                              size="6"
                              weight="bold"
                              style={{ color: 'rgba(255,255,255,0.5)', minWidth: 24, textAlign: 'center' }}
                            >
                              {opponentTeam.score}
                          </Text>
                          </Flex>
                          
                        </Flex>
                      </Table.Cell>

                      {/* Win / Loss badge */}
                      <Table.Cell style={{ padding: '12px', verticalAlign: 'middle' }}>
                        <Flex align="center" justify="center" style={{ height: '100%' }}>
                          <Box style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32, height: 32,
                            borderRadius: '50%',
                            fontWeight: 700,
                            fontSize: 13,
                            background: didWin
                              ? 'rgba(132,204,22,0.15)'
                              : 'rgba(239,68,68,0.12)',
                            color: didWin ? '#84cc16' : '#f87171',
                            border: `0.5px solid ${didWin ? 'rgba(132,204,22,0.25)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                            {didWin ? 'W' : 'L'}
                          </Box>
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
          <Text size="3" weight="bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
            No matches recorded yet
          </Text>
          <Text size="2" align="center" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 320 }}>
            Play in a DUPR rated match then resync to view your match history.
          </Text>
        </Flex>
      )}

      {/* Error — same condition as original */}
      {error && (
        <Text color="red" size="2" mt="2">{error}</Text>
      )}

      {/* Load more — same condition and handler as original */}
      {hasNextPage && (
        <Button
          variant="ghost"
          mt="5"
          onClick={() => fetchMatches()}
          disabled={loading}
          style={{ color: 'rgba(255,255,255,0.5)', cursor: loading ? 'default' : 'pointer' }}
        >
          {loading ? "Loading..." : "Load More"}
        </Button>
      )}
    </Flex>
  );
}