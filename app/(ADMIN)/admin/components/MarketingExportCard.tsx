'use client';

// app/(ADMIN)/admin/brand/components/MarketingExportCard.tsx
//
// Shows opted-in player count and lets the brand export a CSV of players
// who have earned a reward AND opted into brand communications.

import { useState, useEffect } from 'react';
import { Badge, Box, Button, Card, Flex, Heading, Spinner, Text } from '@radix-ui/themes';
import { DownloadIcon } from '@radix-ui/react-icons';

interface ExportRow {
  email: string;
}

function downloadCsv(rows: ExportRow[], filename: string) {
  const lines = [
    'Email',
    ...rows.map(r => `"${r.email.replace(/"/g, '""')}"`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MarketingExportCard() {
  const [players, setPlayers] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExport = async () => {
      try {
        const res = await fetch('/api/brand/marketing-export');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load');
        setPlayers(data.players);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };
    fetchExport();
  }, []);

  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadCsv(players, `gg-pickleball-marketing-${date}.csv`);
  };

  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="4">
          <Box>
            <Flex align="center" gap="2" mb="1">
              <Heading size="4">Marketing List</Heading>
              {!loading && !error && (
                <Badge color="green" variant="soft" radius="full" size="1">
                  {players.length} contact{players.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </Flex>
            <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
              Players who have earned a reward from your brand and opted into
              communications from brand partners. Export as CSV to add to your
              marketing campaign.
            </Text>
          </Box>

          {loading ? (
            <Spinner size="2" />
          ) : error ? null : (
            <Button
              size="2"
              variant="soft"
              disabled={players.length === 0}
              onClick={handleExport}
              style={{ flexShrink: 0 }}
            >
              <DownloadIcon />
              Export CSV
            </Button>
          )}
        </Flex>

        {error && (
          <Text size="2" color="red">{error}</Text>
        )}

        {!loading && !error && players.length === 0 && (
          <Text size="2" color="gray">
            No opted-in players yet. This list grows as players earn rewards and
            opt into brand communications during sign-up.
          </Text>
        )}
      </Flex>
    </Card>
  );
}