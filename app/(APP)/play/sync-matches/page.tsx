'use client'

import { Box, Button, Card, Flex, Heading, Text, Table, Badge, ScrollArea, Spinner, IconButton } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { CheckCircledIcon, CrossCircledIcon, ArrowLeftIcon } from "@radix-ui/react-icons";

interface PotentialMatch {
  matchId: number;
  matchDate: string;
  eventName: string;
  format: string;
  isSynced: boolean;
}

export default function SyncPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<'loading' | 'preview' | 'syncing' | 'complete'>('loading');
  const [matches, setMatches] = useState<PotentialMatch[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [finalCount, setFinalCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Preview
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch('/api/dupr/player/match-history/preview');
        if (!res.ok) throw new Error("Failed to fetch matches");
        const data = await res.json();
        console.log('match data:', data)
        setMatches(data.matches || []);
        setStep('preview');
      } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, "Error fetching match history."]);
      }
    };
    fetchPreview();
  }, []);

  const unsyncedMatches = matches.filter(m => !m.isSynced);

  // 2. Start Sync Process
  const handleStartSync = async () => {
    if (unsyncedMatches.length === 0) return;

    setStep('syncing');
    setLogs([]);
    const matchIds = unsyncedMatches.map(m => m.matchId);

    try {
      const response = await fetch('/api/dupr/player/match-history/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds })
      });

      if (!response.ok || !response.body) throw new Error("Connection failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '');
            try {
              const data = JSON.parse(jsonStr);

              if (data.type === 'PROGRESS') {
                setProgress({ current: data.current, total: data.total });
                setLogs(prev => [...prev, `[${data.current}/${data.total}] ${data.status}`]);
              } 
              else if (data.type === 'LOG') {
                setLogs(prev => [...prev, `> ${data.message}`]);
              }
              else if (data.type === 'COMPLETE') {
                setFinalCount(data.processed);
                setStep('complete');
              }
              else if (data.type === 'ERROR') {
                setLogs(prev => [...prev, `ERROR: ${data.message}`]);
              }
            } catch (e) { console.error("Parse error", e); }
          }
        }
        
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, "Critical connection error."]);
    }
  };

  return (
    <Box style={{ backgroundColor: 'var(--slate-2)', minHeight: '100vh', padding: '40px 20px' }}>
      <Flex direction="column" gap="4" style={{ maxWidth: 800, margin: '0 auto' }}>
        
        {/* Navigation / Header */}
        <Flex align="center" gap="3" mb="2">
          <IconButton 
            variant="soft" 
            color="gray" 
            radius="full" 
            onClick={() => router.push('/play')}
            style={{ cursor: 'pointer' }}
          >
            <ArrowLeftIcon />
          </IconButton>
          <Heading size="6" weight="bold" style={{ color: 'var(--slate-12)', letterSpacing: '-0.01em' }}>
            Sync DUPR History
          </Heading>
        </Flex>

        {/* Main Content Card */}
        <Card 
          size="4" 
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '24px', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
            border: 'none',
            padding: '32px'
          }}
        >

          {/* STEP 1: LOADING */}
          {step === 'loading' && (
            <Flex direction="column" align="center" justify="center" gap="4" style={{ minHeight: '300px' }}>
                <Spinner size="3" />
                <Text size="3" color="gray" weight="medium">Scanning your match history from the last 6 months...</Text>
            </Flex>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && (
            <Flex direction="column" gap="5">
                <Flex justify="between" align="center" p="3" style={{ backgroundColor: 'var(--slate-2)', borderRadius: '12px' }}>
                    <Text size="3" weight="medium" color="gray">Found <strong style={{ color: 'var(--slate-12)' }}>{matches.length}</strong> total matches.</Text>
                    {unsyncedMatches.length > 0 ? (
                      <Badge color="lime" variant="soft" size="2" radius="full">
                        {unsyncedMatches.length} New Matches Available
                      </Badge>
                    ) : (
                      <Badge color="green" variant="soft" size="2" radius="full">
                        <CheckCircledIcon /> All Caught Up
                      </Badge>
                    )}
                </Flex>
                
                <ScrollArea type="auto" scrollbars="vertical" style={{ height: 400, border: '1px solid var(--slate-4)', borderRadius: '12px' }}>
                    <Table.Root variant="ghost">
                        <Table.Header>
                            <Table.Row style={{ backgroundColor: 'var(--slate-2)' }}>
                                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Event Name</Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {matches.map(m => (
                                <Table.Row key={m.matchId} style={{ transition: 'background-color 0.2s' }} className="hover-row">
                                    <Table.Cell>
                                        {m.isSynced ? (
                                            <Badge color="gray" variant="soft" radius="full">Synced</Badge>
                                        ) : (
                                            <Badge color="lime" variant="solid" radius="full">New</Badge>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                     <Text size="2" color="gray" weight="medium">
                                      {(() => {
                                        const d = new Date(m.matchDate);
                                        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
                                          .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                      })()}
                                    </Text>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>
                                        {m.eventName}
                                      </Text>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table.Root>
                </ScrollArea>

                <Button 
                    size="4" 
                    radius="full"
                    onClick={handleStartSync} 
                    disabled={unsyncedMatches.length === 0}
                    style={{ 
                      backgroundColor: unsyncedMatches.length === 0 ? 'var(--slate-5)' : 'var(--slate-12)', 
                      color: unsyncedMatches.length === 0 ? 'var(--slate-9)' : 'white',
                      fontWeight: 'bold',
                      cursor: unsyncedMatches.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                >
                    {unsyncedMatches.length === 0 
                        ? "All Matches Up to Date" 
                        : `Sync ${unsyncedMatches.length} New Matches`}
                </Button>
            </Flex>
          )}

          {/* STEP 3 & 4: SYNCING / COMPLETE */}
          {(step === 'syncing' || step === 'complete') && (
            <Flex direction="column" gap="4">
                {step === 'complete' && (
                    <Box p="4" style={{ backgroundColor: 'var(--green-2)', borderRadius: '12px', border: '1px solid var(--green-5)' }}>
                        <Flex gap="4" align="center">
                            <Box style={{ backgroundColor: 'white', padding: '8px', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                              <CheckCircledIcon width="24" height="24" color="var(--green-9)" />
                            </Box>
                            <Box flexGrow="1">
                                <Text as="div" weight="bold" size="4" style={{ color: 'var(--green-11)' }}>Sync Complete!</Text>
                                <Text as="div" size="2" style={{ color: 'var(--green-10)' }}>Successfully processed {finalCount} games into your profile.</Text>
                            </Box>
                            <Button variant="solid" color="green" radius="full" onClick={() => router.push('/play')}>
                              View Rewards
                            </Button>
                        </Flex>
                    </Box>
                )}

                <Box 
                  ref={scrollRef} 
                  style={{ 
                    height: 400, 
                    overflowY: 'auto', 
                    padding: '20px',
                    backgroundColor: '#0f172a', // Deep slate for terminal feel
                    color: '#10b981', // Emerald green text
                    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
                    fontSize: '13px',
                    borderRadius: '12px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                    {logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '6px', lineHeight: '1.5' }}>{log}</div>
                    ))}
                    {step === 'syncing' && <div className="blink" style={{ marginTop: '10px' }}>_</div>}
                </Box>
                
                <style jsx>{`
                    .blink { animation: blinker 1s linear infinite; }
                    @keyframes blinker { 50% { opacity: 0; } }
                    :global(.hover-row:hover) { background-color: var(--slate-2) !important; }
                `}</style>
            </Flex>
          )}

        </Card>
      </Flex>
    </Box>
  );
}