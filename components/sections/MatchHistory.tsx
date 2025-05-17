"use client";

import { useEffect, useState, useCallback } from "react";
import { Flex, Table, Text, Button } from "@radix-ui/themes";
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

      const existing = new Set(matches.map((m) => m._id.toString()));
      const deduped = newMatches.filter((m) => !existing.has(m._id.toString()));

      setMatches((prev) => [...prev, ...deduped]);

      if (deduped.length > 0) {
        const last = deduped[deduped.length - 1];
        setCursor({
          after: new Date(last.createdAt).toISOString(),
          lastId: last._id.toString(),
        });
      }

      setHasNextPage(more);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, locationId, cursor, hasNextPage, loading, matches]);

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
            after: new Date(last.createdAt).toISOString(),
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
                const matchDate = new Date(match.createdAt);
                const matchDateString = matchDate.toLocaleDateString();

                const showDate = matchDateString !== lastRenderedDate;
                if (showDate) lastRenderedDate = matchDateString;

                const isTeam1 = match.team1.players.some((p) => p._id.toString() === userId);
                const userTeam = isTeam1 ? match.team1 : match.team2;
                const opponentTeam = isTeam1 ? match.team2 : match.team1;
                const didWin = match.winners.some((w) => w._id.toString() === userId);

                const partner = userTeam.players.find((p) => p._id.toString() !== userId);
                const partnerName = partner?.name ?? "[Partner]";
                const oppNames = opponentTeam.players.map((p) => p.name);

                return (
                  <React.Fragment key={match.matchId}>
                    {showDate && (
                      <Table.Row>
                        <Table.Cell colSpan={4}>
                          <Text color="gray">{matchDateString}</Text>
                        </Table.Cell>
                      </Table.Row>
                    )}

                    <Table.Row>
                      <Table.Cell>
                        <Flex direction="row" align="center" gap="6">
                          <Flex direction="column">
                            <Text>{userName}</Text>
                            <Text>{partnerName}</Text>
                          </Flex>
                          <Text>{userTeam.score}</Text>
                        </Flex>
                      </Table.Cell>

                      <Table.Cell>
                        <Flex direction="row" align="center" gap="6">
                          <Flex direction="column">
                            <Text>{oppNames[0]}</Text>
                            <Text>{oppNames[1]}</Text>
                          </Flex>
                          <Text>{opponentTeam.score}</Text>
                        </Flex>
                      </Table.Cell>

                      <Table.Cell>
                        <Flex direction="column" justify="center" height="100%">
                          <Text>{didWin ? "Won" : "Lost"}</Text>
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
            Ready for your first match?
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
