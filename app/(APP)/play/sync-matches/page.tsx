'use client'

import {
  Box, Button, Flex, Spinner, Text, Table, Badge,
  ScrollArea, Heading, IconButton,
} from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  CheckCircledIcon, ArrowLeftIcon, ReloadIcon,
} from "@radix-ui/react-icons";
import { Trophy } from "lucide-react";

interface PotentialMatch {
  matchId: number;
  matchDate: string;
  eventName: string;
  format: string;
  isSynced: boolean;
}

// ── Shared style tokens (matches /play dark theme) ────────────────────────────
const DARK_BG    = '#0a0a0a';
const CARD_BG    = '#111111';
const BORDER     = 'rgba(255,255,255,0.08)';
const LIME       = '#a3e635';
const LIME_DIM   = 'rgba(163,230,53,0.15)';
const LIME_BORDER = 'rgba(163,230,53,0.25)';
const TEXT_MUTED = 'rgba(255,255,255,0.4)';
const TEXT_DIM   = 'rgba(255,255,255,0.6)';

export default function SyncPage() {
  const router = useRouter();

  const [step, setStep] = useState<'loading' | 'error' | 'preview' | 'syncing' | 'complete'>('loading');
  const [matches, setMatches] = useState<PotentialMatch[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [finalCount, setFinalCount] = useState(0);
  const [streamError, setStreamError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Fetch preview ──────────────────────────────────────────────────────────
  const fetchPreview = async () => {
    setStep('loading');
    setLogs([]);
    try {
      const res = await fetch('/api/dupr/player/match-history/preview');
      if (!res.ok) throw new Error(`Preview fetch failed (${res.status})`);
      const data = await res.json();
      setMatches(data.matches || []);
      setStep('preview');
    } catch (err) {
      console.error('[SyncPage] Preview fetch error:', err);
      setStep('error');
    }
  };

  useEffect(() => { fetchPreview(); }, []);

  const unsyncedMatches = matches.filter(m => !m.isSynced);

  // ── Start sync ─────────────────────────────────────────────────────────────
  const handleStartSync = async () => {
    if (unsyncedMatches.length === 0) return;

    setStep('syncing');
    setLogs([]);
    setStreamError(false);
    const matchIds = unsyncedMatches.map(m => m.matchId);

    try {
      const response = await fetch('/api/dupr/player/match-history/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds }),
      });

      if (!response.ok || !response.body) throw new Error('Connection failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '');
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'PROGRESS') {
              setProgress({ current: data.current, total: data.total });
              setLogs(prev => [...prev, `[${data.current}/${data.total}] ${data.status}`]);
            } else if (data.type === 'LOG') {
              setLogs(prev => [...prev, `> ${data.message}`]);
            } else if (data.type === 'COMPLETE') {
              setFinalCount(data.processed);
              setStep('complete');
            } else if (data.type === 'ERROR') {
              setLogs(prev => [...prev, `ERROR: ${data.message}`]);
              setStreamError(true);
            }
          } catch (e) {
            console.error('[SyncPage] Parse error:', e);
          }
        }

        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }

      // If stream ended without a COMPLETE event, treat as a connection drop
      if (step !== 'complete') {
        setStreamError(true);
      }
    } catch (e) {
      console.error('[SyncPage] Stream error:', e);
      setLogs(prev => [...prev, 'Connection lost. Your progress up to this point has been saved.']);
      setStreamError(true);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box style={{ backgroundColor: DARK_BG, minHeight: '100vh', padding: '32px 20px', paddingBottom: '80px' }}>
      <Flex direction="column" gap="5" style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <Flex align="center" gap="3">
          <IconButton
            variant="ghost"
            color="gray"
            radius="full"
            onClick={() => router.push('/play')}
            style={{ cursor: 'pointer', color: TEXT_DIM }}
          >
            <ArrowLeftIcon width={18} height={18} />
          </IconButton>
          <Heading
            size="6"
            weight="bold"
            style={{ color: '#fff', letterSpacing: '-0.02em' }}
          >
            Sync Match History
          </Heading>
        </Flex>

        {/* ── STEP: LOADING ── */}
        {step === 'loading' && (
          <Box style={{
            background: CARD_BG,
            border: `0.5px solid ${BORDER}`,
            borderRadius: 20,
            padding: 48,
          }}>
            <Flex direction="column" align="center" gap="4">
              <Spinner size="3" style={{ color: LIME }} />
              <Text size="3" style={{ color: TEXT_DIM }}>
                Scanning your match history from the last 6 months…
              </Text>
            </Flex>
          </Box>
        )}

        {/* ── STEP: ERROR ── */}
        {step === 'error' && (
          <Box style={{
            background: CARD_BG,
            border: `0.5px solid ${BORDER}`,
            borderRadius: 20,
            padding: 48,
          }}>
            <Flex direction="column" align="center" gap="5">
              <Flex align="center" justify="center" style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)',
                border: '0.5px solid rgba(239,68,68,0.25)',
              }}>
                <Text size="6">⚠</Text>
              </Flex>
              <Flex direction="column" align="center" gap="2">
                <Heading size="5" style={{ color: '#fff' }}>
                  Couldn't load your matches
                </Heading>
                <Text size="2" align="center" style={{ color: TEXT_DIM, maxWidth: 360 }}>
                  We had trouble connecting to DUPR. This is usually temporary — try again in a moment.
                </Text>
              </Flex>
              <Flex gap="3">
                <Button
                  size="3"
                  radius="full"
                  onClick={fetchPreview}
                  style={{
                    backgroundColor: LIME,
                    color: DARK_BG,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  <ReloadIcon style={{ marginRight: 6 }} />
                  Try Again
                </Button>
                <Button
                  size="3"
                  radius="full"
                  variant="ghost"
                  color="gray"
                  onClick={() => router.push('/play')}
                  style={{ cursor: 'pointer', color: TEXT_DIM }}
                >
                  Back to Rewards
                </Button>
              </Flex>
            </Flex>
          </Box>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && (
          <Flex direction="column" gap="4">

            {/* Summary bar */}
            <Flex
              justify="between"
              align="center"
              px="4"
              py="3"
              style={{
                background: CARD_BG,
                border: `0.5px solid ${BORDER}`,
                borderRadius: 14,
              }}
            >
              <Text size="2" style={{ color: TEXT_DIM }}>
                Found{' '}
                <Text weight="bold" style={{ color: '#fff' }}>
                  {matches.length}
                </Text>{' '}
                total matches
              </Text>
              {unsyncedMatches.length > 0 ? (
                <Badge
                  radius="full"
                  style={{
                    backgroundColor: LIME_DIM,
                    color: LIME,
                    border: `0.5px solid ${LIME_BORDER}`,
                    fontWeight: 600,
                  }}
                >
                  {unsyncedMatches.length} new
                </Badge>
              ) : (
                <Badge
                  radius="full"
                  style={{
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    color: '#4ade80',
                    border: '0.5px solid rgba(34,197,94,0.2)',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircledIcon style={{ marginRight: 4 }} />
                  All caught up
                </Badge>
              )}
            </Flex>

            {/* Match table */}
            <Box style={{
              background: CARD_BG,
              border: `0.5px solid ${BORDER}`,
              borderRadius: 20,
              overflow: 'hidden',
            }}>
              <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 380 }}>
                <Table.Root variant="ghost">
                  <Table.Header>
                    <Table.Row style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                      {['Status', 'Date', 'Event'].map(h => (
                        <Table.ColumnHeaderCell
                          key={h}
                          style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                        >
                          {h}
                        </Table.ColumnHeaderCell>
                      ))}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {matches.map(m => (
                      <Table.Row
                        key={m.matchId}
                        style={{ borderBottom: `0.5px solid ${BORDER}` }}
                      >
                        <Table.Cell>
                          {m.isSynced ? (
                            <Badge
                              radius="full"
                              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: TEXT_MUTED, fontSize: 11 }}
                            >
                              Synced
                            </Badge>
                          ) : (
                            <Badge
                              radius="full"
                              style={{ backgroundColor: LIME_DIM, color: LIME, border: `0.5px solid ${LIME_BORDER}`, fontSize: 11, fontWeight: 600 }}
                            >
                              New
                            </Badge>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" style={{ color: TEXT_DIM }}>
                            {(() => {
                              const d = new Date(m.matchDate);
                              return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
                                .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            })()}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ color: '#fff' }}>
                            {m.eventName}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </ScrollArea>
            </Box>

            {/* CTA area */}
            {unsyncedMatches.length > 0 ? (
              <Button
                size="4"
                radius="full"
                onClick={handleStartSync}
                style={{
                  backgroundColor: LIME,
                  color: DARK_BG,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  height: 52,
                }}
              >
                Sync {unsyncedMatches.length} New {unsyncedMatches.length === 1 ? 'Match' : 'Matches'}
              </Button>
            ) : (
              // All caught up — give them a clear next step
              <Box style={{
                background: 'rgba(34,197,94,0.06)',
                border: '0.5px solid rgba(34,197,94,0.15)',
                borderRadius: 16,
                padding: '24px',
                textAlign: 'center',
              }}>
                <Flex direction="column" align="center" gap="4">
                  <Flex align="center" justify="center" style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'rgba(34,197,94,0.1)',
                    border: '0.5px solid rgba(34,197,94,0.2)',
                  }}>
                    <Trophy size={22} style={{ color: '#4ade80' }} />
                  </Flex>
                  <Flex direction="column" align="center" gap="1">
                    <Heading size="4" style={{ color: '#fff' }}>You're all caught up</Heading>
                    <Text size="2" style={{ color: TEXT_DIM }}>
                      All your recent matches are already synced. Head back to see your rewards.
                    </Text>
                  </Flex>
                  <Button
                    size="3"
                    radius="full"
                    onClick={() => router.push('/play')}
                    style={{
                      backgroundColor: LIME,
                      color: DARK_BG,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    View Rewards
                  </Button>
                </Flex>
              </Box>
            )}
          </Flex>
        )}

        {/* ── STEP: SYNCING / COMPLETE ── */}
        {(step === 'syncing' || step === 'complete') && (
          <Flex direction="column" gap="4">

            {/* Completion banner */}
            {step === 'complete' && !streamError && (
              <Box style={{
                background: 'rgba(34,197,94,0.08)',
                border: '0.5px solid rgba(34,197,94,0.2)',
                borderRadius: 16,
                padding: '20px 24px',
              }}>
                <Flex justify="between" align="center" gap="4" wrap="wrap">
                  <Flex align="center" gap="3">
                    <CheckCircledIcon width={24} height={24} color="#4ade80" />
                    <Box>
                      <Text weight="bold" size="3" style={{ color: '#4ade80', display: 'block' }}>
                        Sync complete
                      </Text>
                      <Text size="2" style={{ color: 'rgba(74,222,128,0.7)' }}>
                        {finalCount} {finalCount === 1 ? 'game' : 'games'} added to your profile
                      </Text>
                    </Box>
                  </Flex>
                  <Button
                    size="3"
                    radius="full"
                    onClick={() => router.push('/play')}
                    style={{
                      backgroundColor: LIME,
                      color: DARK_BG,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    View Rewards
                  </Button>
                </Flex>
              </Box>
            )}

            {/* Stream error banner */}
            {streamError && (
              <Box style={{
                background: 'rgba(163,230,53,0.05)',
                border: '0.5px solid rgba(163,230,53,0.15)',
                borderRadius: 16,
                padding: '20px 24px',
              }}>
                <Flex justify="between" align="center" gap="4" wrap="wrap">
                  <Box>
                    <Text weight="bold" size="3" style={{ color: LIME, display: 'block' }}>
                      We've identified the issue and are fixing it
                    </Text>
                    <Text size="2" style={{ color: TEXT_DIM }}>
                      Your rewards are not lost and will be updated momentarily.
                    </Text>
                  </Box>
                  <Button
                    size="2"
                    radius="full"
                    onClick={() => router.push('/play')}
                    style={{
                      backgroundColor: LIME,
                      color: DARK_BG,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    View Rewards
                  </Button>
                </Flex>
              </Box>
            )}

            {/* Terminal log */}
            <Box
              ref={scrollRef}
              style={{
                height: 360,
                overflowY: 'auto',
                padding: '20px',
                background: '#0d0d0d',
                border: `0.5px solid ${BORDER}`,
                borderRadius: 16,
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {logs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 4,
                    color: log.startsWith('ERROR')
                      ? '#f87171'
                      : log.startsWith('>')
                      ? 'rgba(163,230,53,0.5)'
                      : LIME,
                  }}
                >
                  {log}
                </div>
              ))}
              {step === 'syncing' && (
                <div style={{ color: LIME, marginTop: 8, animation: 'blink 1s linear infinite' }}>_</div>
              )}
            </Box>

            {/* Progress bar during sync */}
            {step === 'syncing' && progress.total > 0 && (
              <Box>
                <Flex justify="between" mb="1">
                  <Text size="1" style={{ color: TEXT_MUTED }}>Progress</Text>
                  <Text size="1" style={{ color: TEXT_MUTED }}>
                    {progress.current} / {progress.total}
                  </Text>
                </Flex>
                <Box style={{
                  height: 4,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 9999,
                  overflow: 'hidden',
                }}>
                  <Box style={{
                    height: '100%',
                    width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    backgroundColor: LIME,
                    borderRadius: 9999,
                    transition: 'width 0.3s ease',
                  }} />
                </Box>
              </Box>
            )}
          </Flex>
        )}

        <style>{`
          @keyframes blink { 50% { opacity: 0; } }
        `}</style>

      </Flex>
    </Box>
  );
}