'use client'

import { useState, useRef, use } from 'react';
import { Button, Card, Flex, Heading, Text, Badge, ScrollArea, Box } from '@radix-ui/themes';
import { CheckCircledIcon, CrossCircledIcon, MinusCircledIcon } from '@radix-ui/react-icons';

interface LogEntry {
  type: 'START' | 'UPDATE' | 'DONE';
  status?: 'success' | 'skipped' | 'error';
  userName?: string;
  details?: string[];
  error?: string;
  message?: string;
}

export default function RetroactiveSweepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState({ success: 0, skipped: 0, error: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const startSweep = async () => {
    setIsRunning(true);
    setLogs([]);
    setSummary({ success: 0, skipped: 0, error: 0 });

    try {
      const response = await fetch('/api/client/retroactive-reward-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, monthsBack: 6 }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Handle NDJSON (New line Delimited JSON)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const entry: LogEntry = JSON.parse(line);
            
            setLogs(prev => [...prev, entry]);
            
            // Update live summary
            if (entry.status) {
                setSummary(prev => ({
                    ...prev,
                    [entry.status!]: prev[entry.status!] + 1
                }));
            }

            // Auto scroll
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          } catch (e) {
            console.error("Error parsing stream line", e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, { type: 'UPDATE', status: 'error', error: 'Network Connection Lost' }]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Flex direction="column" gap="4" p="5" maxWidth="800px" mx="auto">
      <Heading>Retroactive Reward Sweep</Heading>
      
      <Card>
        <Flex justify="between" align="center" mb="4">
            <Text size="2" color="gray">
                This process will scan all users for achievements earned in the last 6 months. 
                If eligible, rewards will be issued immediately.
            </Text>
            <Button onClick={startSweep} disabled={isRunning} color={isRunning ? 'gray' : 'blue'}>
                {isRunning ? 'Processing...' : 'Start Sweep'}
            </Button>
        </Flex>

        <Flex gap="4" mb="4">
            <Badge color="green">Success: {summary.success}</Badge>
            <Badge color="gray">Skipped: {summary.skipped}</Badge>
            <Badge color="red">Errors: {summary.error}</Badge>
        </Flex>

        <Box 
            ref={scrollRef}
            style={{ 
                height: '500px', 
                backgroundColor: '#1e1e1e', 
                borderRadius: '6px', 
                padding: '16px', 
                overflowY: 'auto',
                fontFamily: 'monospace'
            }}
        >
            {logs.map((log, i) => (
                <Flex key={i} gap="2" mb="1" align="start">
                    {log.type === 'START' && <Text color="blue">{log.message}</Text>}
                    {log.type === 'DONE' && <Text color="green" weight="bold">--- PROCESS COMPLETE ---</Text>}
                    
                    {log.status === 'success' && <CheckCircledIcon color="green" style={{minWidth: 16}} />}
                    {log.status === 'skipped' && <MinusCircledIcon color="pink" style={{minWidth: 16}} />}
                    {log.status === 'error' && <CrossCircledIcon color="red" style={{minWidth: 16}} />}

                    {log.userName && (
                        <Text style={{ minWidth: '150px', color: 'white' }}>{log.userName}:</Text>
                    )}
                    
                    <Flex direction="column">
                        {log.details?.map((d, idx) => (
                            <Text key={idx} color={log.status === 'success' ? 'green' : 'pink'} size="1">{d}</Text>
                        ))}
                        {log.error && <Text color="red" size="1">{log.error}</Text>}
                    </Flex>
                </Flex>
            ))}
            {logs.length === 0 && <Text color="pink">Ready to start...</Text>}
        </Box>
      </Card>
    </Flex>
  );
}