'use client'

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Callout, Card, Checkbox, Flex, Heading, RadioGroup, SegmentedControl, Spinner, Text, TextField } from '@radix-ui/themes';
import Papa from 'papaparse';
import { IClient } from '@/app/types/databaseTypes';
import { ArrowLeftIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { DuprMatch } from '@/app/types/duprTypes';

interface CsvRow {
  [key: string]: string;
}

interface MatchUploaderProps {
  context: 'local' | 'global';
  isSuperAdmin: boolean;
  location: IClient | null;
  isSubmitting: boolean;
  isMobile: boolean;
  onProcess: (endpoint: string, payload: object) => void;
  error: string | null;
}

type UploadMethod = 'csv' | 'dupr';
type DuprSyncStep = 'chooseMethod' | 'selectDate' | 'fetching' | 'chooseEvent' | 'confirmAll' | 'error';
type DuprMatchType = 'date' | 'event';

type HasTeamsArray = {
  teams: unknown[];
};

type HasPlayers = {
  player1?: { fullName?: unknown };
  player2?: { fullName?: unknown };
};

function isDuprMatch(item: unknown): item is DuprMatch {
  if (typeof item !== 'object' || item === null) {
    return false;
  }

  if (!('eventName' in item) || !('teams' in item)) {
    return false;
  }

  if (!Array.isArray((item as HasTeamsArray).teams)) {
    return false;
  }

  const teams = (item as HasTeamsArray).teams;

  if (teams.length !== 2) {
    return false;
  }

  const team1 = teams[0];
  if (typeof team1 !== 'object' || team1 === null) {
    return false;
  }

  const teamWithPlayers = team1 as HasPlayers;
  
  // Check for the deeply nested properties
  return (
    typeof teamWithPlayers.player1?.fullName === 'string' &&
    typeof teamWithPlayers.player2?.fullName === 'string'
  );
}

export default function MatchUploader({context, isSuperAdmin, location, isSubmitting, isMobile, onProcess, error: parentError }: MatchUploaderProps) {
  
  const [manualDuprId, setManualDuprId] = useState<string>('');

  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('csv');

  const [duprSyncStep, setDuprSyncStep] = useState<DuprSyncStep>('chooseMethod');
  const [duprMatchType, setDuprMatchType] = useState<DuprMatchType>('date');
  const [syncUntilDate, setSyncUntilDate] = useState<string>('');
  const [matchesForConfirmation, setMatchesForConfirmation] = useState<DuprMatch[]>([]);
  const [duprMatches, setDuprMatches] = useState<DuprMatch[]>([]);
  const [duprEvents, setDuprEvents] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Record<string, boolean>>({});
  const [duprError, setDuprError] = useState<string | null>(null);

  const [parsedData, setParsedData] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clubIdToUse = isSuperAdmin && manualDuprId ? manualDuprId : location?.dupr?.id;

  const resetDuprState = () => {
    setDuprSyncStep('chooseMethod');
    setDuprMatches([]);
    setDuprEvents([]);
    setSelectedEvents({});
    setSyncUntilDate('');
    setDuprError(null);
  };

  useEffect(() => {
    // If the parent component sends down an error, display it.
    if (parentError) {
      setDuprError(parentError);
      // For DUPR sync, this will show the error message in the correct place.
      setDuprSyncStep('error');
    }
  }, [parentError]);

  const handleNextStep = () => {
    if (duprMatchType === 'date') {
      setDuprSyncStep('selectDate');
    } else { // 'event'
      // For 'event', we need to fetch all matches first to find the events.
      handleStartDuprSync(); 
    }
  };

  const handleStartDuprSync = async () => {

    if (!clubIdToUse) {
      setDuprError("DUPR Club ID is not configured for this location.");
      setDuprSyncStep('error');
      return;
    }
    
    setDuprError(null);
    setDuprSyncStep('fetching');

    try {
      const response = await fetch('/api/dupr/club/match-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: clubIdToUse,
          syncUntilDate: duprMatchType === 'date' ? syncUntilDate : undefined 
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details || 'Failed to fetch DUPR history.');

      const validMatches: DuprMatch[] = (data.matches || []).filter(isDuprMatch);

      setDuprMatches(validMatches);

      if (duprMatchType === 'event') {
        const uniqueEvents = Array.from(new Set(validMatches.map(m => m.eventName).filter(Boolean)));
        setDuprEvents(uniqueEvents);
        setSelectedEvents(uniqueEvents.reduce((acc, eventName) => ({ ...acc, [eventName]: false }), {}));
        setDuprSyncStep('chooseEvent');
      } else {
        setMatchesForConfirmation(validMatches);
        setDuprSyncStep('confirmAll');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDuprError(err.message);
      } else {
        setDuprError('An unexpected error occurred.');
      }
      setDuprSyncStep('error');
    }
  };

  const handleCheckboxChange = (eventName: string, checked: boolean) => {
    setSelectedEvents(prev => ({ ...prev, [eventName]: checked }));
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedEvents).filter(Boolean).length;
  }, [selectedEvents]);

  const handleSelectAll = () => {
    const allSelected = duprEvents.reduce((acc, eventName) => {
      acc[eventName] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setSelectedEvents(allSelected);
  };

  const handleDeselectAll = () => {
    const allDeselected = duprEvents.reduce((acc, eventName) => {
      acc[eventName] = false;
      return acc;
    }, {} as Record<string, boolean>);
    setSelectedEvents(allDeselected);
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV file. Please check the format and try again.');
          setParsedData(null);
          console.error("CSV Parsing Errors:", results.errors);
        } else {
          setParsedData(results.data);
        }
      },
    });
  };

  const onCsvFormSubmit = () => {
    if (context === 'local' && !location) {
      setError("Cannot process a CSV upload without a valid location context.");
      return;
    }

    onProcess('/api/match/bulk-upload/start', {
      matches: parsedData,
      ...(context === 'local' && location && { location: location._id.toString() }),
    });

    setParsedData(null);
    setFileName(null);
    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  useEffect(() => {
    console.log('context:', context)
  }, [context])

  const handleProcessDuprMatches = async () => {
    if (matchesForConfirmation.length === 0) return;

     if (context === 'local' && !location) {
      setError("Cannot process matches without a valid location context.");
      return;
    }
    
    onProcess('/api/match/dupr-sync/start', {
      duprMatches: matchesForConfirmation,
      duprId: clubIdToUse,
      dataSourceType: 'dupr',
      ...(context === 'local' && location && { locationId: location._id }),
    });
  };

  const handleConfirmSelectedEvents = () => {
  setDuprError(null); 

  const eventsToProcess = Object.keys(selectedEvents).filter(eventName => selectedEvents[eventName]);
  const filteredMatches = duprMatches.filter(match => eventsToProcess.includes(match.eventName));

  console.log('filtered matches:', filteredMatches)

  if (filteredMatches.length === 0) {
    setDuprError("Please select at least one event to proceed.");
    return;
  }

  setMatchesForConfirmation(filteredMatches);

  setDuprSyncStep('confirmAll');
};

  return (
    <Flex direction={'column'} width={{ initial: '100%', md: '50%' }} gap={'4'} height={"calc(100vh - 230px)"}>
      <Heading>Bulk Match Upload</Heading>

      {error && <Callout.Root color="red">{error}</Callout.Root>}

      {/* --- Step 1: Method Selection --- */}
      <SegmentedControl.Root size={'3'} style={{height: isMobile ? '50px' : '75px'}} value={uploadMethod} onValueChange={(value) => setUploadMethod(value as UploadMethod)}>
        <SegmentedControl.Item value="csv">Upload CSV</SegmentedControl.Item>
        <SegmentedControl.Item value="dupr">Sync with DUPR</SegmentedControl.Item>
      </SegmentedControl.Root>

      {/* --- Step 2: Conditional UI --- */}
      {uploadMethod === 'csv' && (
        <Flex direction="column" gap="4">
          <Card>
            <Text as="div" weight="bold" mb="2">1. Download Template</Text>
            <Text as="p" size="2" color="gray" mb="3">
              Download the CSV template, fill it out with your match data, and save the file.
            </Text>
            <Button asChild variant="soft">
              <a href="/api/match/csv-template" download>Download Template</a>
            </Button>
          </Card>
          
          <Card>
            <Text as="div" weight="bold" mb="2">2. Upload File</Text>
            <Text as="p" size="2" color="gray" mb="3">
              Select the completed CSV file from your computer.
            </Text>
            <Button asChild variant='soft' style={{cursor: 'pointer'}}>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
            </Button>
            {fileName && <Text mt="2" color="green">Selected: {fileName}</Text>}
          </Card>

          <Button size="3" onClick={onCsvFormSubmit} disabled={isSubmitting || !parsedData}>
            {isSubmitting ? 'Uploading...' : `Process ${parsedData?.length || 0} Matches`}
          </Button>
          {isSubmitting && (
            <Flex direction={'column'}>
              <Callout.Root size={'2'} color='red'>
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  Do not close this tab while processing matches or you may lose data. 
                </Callout.Text>
              </Callout.Root>
            </Flex>
          )}
        </Flex>
      )}

      {uploadMethod === 'dupr' && (
        <Card>
          <Flex direction="column" gap="4">
            {duprSyncStep === 'chooseMethod' && (
              <>
                <Callout.Root size={'2'}>
                  <Callout.Icon>
                    <InfoCircledIcon />
                  </Callout.Icon>
                  <Callout.Text>
                    Automatically upload your club&apos;s DUPR match data to issue rewards based on past matches. 
                  </Callout.Text>
                </Callout.Root>

                {isSuperAdmin && (
                  <label>
                    <Text as="div" size="2" mb="1" weight="bold">DUPR Club ID:</Text>
                    <TextField.Root
                      type="text"
                      placeholder="Enter DUPR Club ID to sync from"
                      value={manualDuprId}
                      onChange={(e) => setManualDuprId(e.target.value)}
                    />
                  </label>
                )}

                <Text as="div" weight="bold">1. Choose Sync Method</Text>
                <RadioGroup.Root value={duprMatchType} onValueChange={(v) => setDuprMatchType(v as DuprMatchType)}>
                  <Flex gap="4" direction="column">
                    <Text as="label" size="2"><Flex gap="2"><RadioGroup.Item value="date" />Upload matches by date</Flex></Text>
                    <Text as="label" size="2"><Flex gap="2"><RadioGroup.Item value="event" /> Filter matches by event</Flex></Text>
                  </Flex>
                </RadioGroup.Root>
                <Button onClick={handleNextStep}>Next</Button>
              </>
            )}

            {duprSyncStep === 'selectDate' && (
              <>
                <Flex direction={'column'} width={'fit-content'}>
                  <Button variant="soft" size="1" onClick={resetDuprState}><ArrowLeftIcon /> Back</Button>
                </Flex>
                <Flex direction={'column'}>
                  <Text weight="bold">2. Select Sync Date</Text>
                  <Text size="2">
                    How far back would you like to fetch matches from?
                  </Text>
                </Flex>
                <label>
                  <Text as="div" size="2" mb="1">Sync from date:</Text>
                  <TextField.Root
                    type="date"
                    value={syncUntilDate}
                    onChange={(e) => setSyncUntilDate(e.target.value)}
                  />
                </label>
                <Button onClick={handleStartDuprSync} disabled={!syncUntilDate}>Next</Button>
              </>
            )}

            {duprSyncStep === 'fetching' && <Flex align="center" justify="center" p="4"><Spinner /> <Text ml="3">Fetching match history from DUPR...</Text></Flex>}
            
            {duprSyncStep === 'error' && (
              <Flex direction={'column'} gap={'4'}>
                <Flex direction={'column'} width={'fit-content'}>
                  <Button variant='soft' size="1" onClick={resetDuprState}><ArrowLeftIcon /> Back</Button>
                </Flex>
                <Callout.Root color="red">{duprError}</Callout.Root>
              </Flex>
            )}

            {duprSyncStep === 'chooseEvent' && (
              <Flex direction={'column'} gap={'4'}>
                <Flex direction={'column'} width={'fit-content'}>
                  <Button variant='soft' size="1" onClick={resetDuprState}><ArrowLeftIcon /> Back</Button>
                </Flex>
                <Flex direction={'column'}>
                  <Text as="div" weight="bold">2. Select Events to Process</Text>
                  <Text size={'2'}>To avoid issuing duplicate rewards, only select the intended events.</Text>
                </Flex>

                <Flex direction="row" justify="between" align="center" my="2" px="2">
                  <Badge color="blue" size="2">
                    {selectedCount} selected
                  </Badge>
                  <Flex gap="3">
                    <Button variant="ghost" size="1" onClick={handleSelectAll}>Select All</Button>
                    <Button variant="ghost" size="1" onClick={handleDeselectAll}>Deselect All</Button>
                  </Flex>
                </Flex>
                            
                <Flex direction="column" gap="2" p="2" maxHeight={'200px'} overflow={'scroll'}>
                  {duprEvents.map(eventName => (
                    <Text as="label" size="2" key={eventName}>
                      <Flex gap="2"><Checkbox checked={selectedEvents[eventName]} onCheckedChange={(c) => handleCheckboxChange(eventName, c as boolean)} /> {eventName}</Flex>
                    </Text>
                  ))}
                </Flex>
                <Flex direction={'column'}>
                  <Button onClick={handleConfirmSelectedEvents} disabled={isSubmitting}>
                    {isSubmitting ? <Spinner/> : 'Next'}
                  </Button>
                </Flex>
                {isSubmitting && (
                  <Flex direction={'column'}>
                    <Callout.Root size={'2'} color='red'>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        Do not close this tab while processing matches or you may lose data. 
                      </Callout.Text>
                    </Callout.Root>
                  </Flex>
                )}
              </Flex>
            )}

            {duprSyncStep === 'confirmAll' && (
             <Flex direction={'column'} gap={'4'}>
                <Flex direction={'column'} width={'fit-content'}>
                  <Button 
                    variant='soft' 
                    size="1" 
                    onClick={() => setDuprSyncStep(duprMatchType === 'date' ? 'selectDate' : 'chooseEvent')} 
                    style={{width: 'fit-content'}}
                  >
                    <ArrowLeftIcon /> Back
                  </Button>
                </Flex>
                <Flex direction={'column'}>
                  <Text as="div" weight="bold">
                    {duprMatchType === 'date' ? '2. Confirm Matches' : '3. Confirm Selected Matches'}
                  </Text>
                  {matchesForConfirmation.length > 0 ? (
                    <Text size="2" color="gray">Found {matchesForConfirmation.length} matches. Here is a preview:</Text>
                  ) : (
                    <Text size="2" color="gray">
                      {duprMatchType === 'date' ? 'No matches found.' : 'No matches found for the selected events.'}
                    </Text>
                  )} 
                </Flex>
               
                <Flex direction={'column'} p="2" maxHeight={'200px'} overflow={'scroll'}>
                  {matchesForConfirmation.map(match => {
                    const team1 = match.teams.find(t => t.serial === 1);
                    const team2 = match.teams.find(t => t.serial === 2);

                    // Safety check in case the team structure is unexpected
                    if (!team1 || !team2) {
                      return <Text color="red" size="1" key={match.id}>Malformed match data</Text>;
                    }
                    
                    // Extract names from player1 and player2 properties
                    const team1Names = `${team1.player1.fullName} & ${team1.player2.fullName}`;
                    const team2Names = `${team2.player1.fullName} & ${team2.player2.fullName}`;
                    
                    const gameScores: string[] = [];
                    // Use a loop to check for game1, game2, etc.
                    for (let i = 1; i <= 5; i++) {
                      const gameKey = `game${i}` as keyof typeof team1;
                      const score1 = team1[gameKey];
                      const score2 = team2[gameKey];

                      // DUPR uses -1 for games not played. We only show valid games.
                      if (typeof score1 === 'number' && typeof score2 === 'number' && score1 >= 0 && score2 >= 0) {
                        gameScores.push(`${score1}-${score2}`);
                      }
                    }
                    
                    return (
                      <Flex direction={'column'} key={match.id} mb="2">
                        <Text as="div" size="1" weight="bold">{team1Names} vs {team2Names}</Text>
                        <Text as="div" size="1" color="gray">Scores: {gameScores.join(', ')}</Text>
                      </Flex>
                    );
                  })}
                </Flex>
                <Flex direction={'column'}>
                  <Button onClick={handleProcessDuprMatches} disabled={isSubmitting || matchesForConfirmation.length === 0}>
                    {isSubmitting ? <Spinner/> : `Process ${matchesForConfirmation.length} Matches`}
                  </Button>
                </Flex>
                {isSubmitting && (
                  <Flex direction={'column'}>
                    <Callout.Root size={'2'} color='red'>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        Do not close this tab while processing matches or you may lose data. 
                      </Callout.Text>
                    </Callout.Root>
                  </Flex>
                )}
                
              </Flex>
            )}
          </Flex>
        </Card>
      )}
    </Flex>
  );
}