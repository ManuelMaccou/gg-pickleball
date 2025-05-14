"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Flex, Table, Text } from "@radix-ui/themes";
import { PopulatedMatch } from "@/app/types/frontendTypes";

type MatchHistoryProps = {
  userId: string;
  userName: string;
  locationId: string;
};

export default function MatchHistory({ userId, userName, locationId }: MatchHistoryProps) {
  const [matches, setMatches] = useState<PopulatedMatch[]>([]);
  const [cursor, setCursor] = useState<{ after: string; lastId: string } | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);

  const observerRef = useRef<HTMLDivElement | null>(null);

  // Fetch triggered when page changes
  const fetchMatches = useCallback(
    async (overrideCursor: { after: string; lastId: string } | null = cursor) => {
      if (loading || !hasNextPage) return;
  
      setLoading(true);
      try {
        const url = new URL(`/api/match/user-and-location`, window.location.origin);
        url.searchParams.set("userId", userId);
        url.searchParams.set("locationId", locationId);
        url.searchParams.set("limit", "10");
  
        // ✅ use overrideCursor, not state cursor
        if (overrideCursor) {
          url.searchParams.set("after", overrideCursor.after);
          url.searchParams.set("lastId", overrideCursor.lastId);
        }
  
        const res = await fetch(url.toString());
        const data = await res.json();
  
        setMatches((prev) => {
          const existing = new Set(prev.map((m) => m.matchId));
          const deduped = data.matches.filter((m: PopulatedMatch) => !existing.has(m.matchId));
          return [...prev, ...deduped];
        });
  
        if (data.matches.length > 0) {
          const last = data.matches[data.matches.length - 1];
          setCursor({ after: last.createdAt, lastId: last._id });
        }
  
        setHasNextPage(data.hasNextPage);
      } catch (error) {
        console.error("Failed to fetch matches:", error);
      } finally {
        setLoading(false);
      }
    },
    [cursor, hasNextPage, loading, userId, locationId]
  );
  

  // Fetch first set of matches
  useEffect(() => {
    if (!locationId) return;
  
    setMatches([]);
    setCursor(null);
    setHasNextPage(true);
  
    // ✅ explicitly pass null so we start from the beginning
    fetchMatches(null);
  }, [locationId, fetchMatches]);

  // Lazy load
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !loading) {
          fetchMatches(); // cursor-based fetch
        }
      },
      { threshold: 1 }
    );
  
    const current = observerRef.current;
    if (current) observer.observe(current);
  
    return () => {
      if (current) observer.unobserve(current);
    };
  }, [hasNextPage, loading, fetchMatches]);
  

  return (
    <Flex direction="column" gap="4">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell />
            <Table.ColumnHeaderCell />
            <Table.ColumnHeaderCell />
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {matches.map((match) => {
            const matchDate = new Date(match.createdAt);
            const isTeam1 = match.team1.players.some((p) => p._id.toString() === userId);
            const userTeam = isTeam1 ? match.team1 : match.team2;
            const opponentTeam = isTeam1 ? match.team2 : match.team1;
            const didWin = match.winners.some((w) => w._id.toString() === userId);
            
            const partner = userTeam.players.find((p) => p._id.toString() !== userId);
            const partnerName = partner?.name ?? "[Partner]";
            const oppNames = opponentTeam.players.map((p) => p.name);

            return (
              <>
                <Table.Row key={`${match.matchId}-date`}>
                  <Table.Cell colSpan={4}>
                    <Text color="gray">
                      {matchDate.toLocaleDateString()}
                    </Text>
                  </Table.Cell>
                </Table.Row>

                <Table.Row key={match.matchId}>
                  <Table.Cell>
                    <Flex direction="row" align="center" gap={'6'}>
                      <Flex direction="column">
                        <Text>{userName}</Text>
                        <Text>{partnerName}</Text>
                      </Flex>
                      <Text>{userTeam.score}</Text>
                    </Flex>
                  </Table.Cell>

                  <Table.Cell>
                    <Flex direction="row" align="center" gap={'6'}>
                      <Flex direction="column">
                        <Text>{oppNames[0]}</Text>
                        <Text>{oppNames[1]}</Text>
                      </Flex>
                      <Text>{opponentTeam.score}</Text>
                    </Flex>
                  </Table.Cell>

                  <Table.Cell>
                    <Flex direction={'column'} justify={'center'} height={'100%'}>
                      <Text>
                        {didWin ? "Won" : "Lost"}
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              </>
            );
          })}
        </Table.Body>

      </Table.Root>

      <div ref={observerRef} />

      {loading && <div>Loading more matches...</div>}
    </Flex>
  );
}
