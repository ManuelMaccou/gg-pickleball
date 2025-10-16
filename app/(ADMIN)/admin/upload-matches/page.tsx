'use client'

import { useEffect, useState } from 'react';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png'
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { Button, Callout, Card, Code, Flex, Heading, Progress, Spinner, Strong, Table, Text } from '@radix-ui/themes';
import Image from "next/image";
import Link from "next/link";
import Papa from 'papaparse';
import { useUserContext } from '@/app/contexts/UserContext';
import { CrossCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import MobileMenu from '../components/MobileMenu';
import { JobResult } from '@/app/types/bulkUploadTypes';
import { useRouter } from 'next/navigation';

interface CsvRow {
  [key: string]: string; // All values from CSV are initially strings
}

// You would pass the admin's current location to this component as a prop
export default function BulkUploadPage() {

  const { user } = useUserContext();
  const router = useRouter();
  const isMobile =useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  
  const userId = user?.id
  const userName = user?.name
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [totalRowsToProcess, setTotalRowsToProcess] = useState(0);
  const [jobResults, setJobResults] = useState<JobResult[]>([]);
  const [location, setLocation] = useState<IClient | null>(null);
  const [parsedData, setParsedData] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`/api/match/bulk-upload/status?jobId=${jobId}`);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[SSE] Received data:', data); 

      if (data.status === 'processing' && data.results) {
        setJobResults(prev => [...prev, ...data.results]);
      }
      if (data.status === 'complete' || data.status === 'failed') {
        eventSource.close();
        setIsSubmitting(false);
      }
    };
    eventSource.onerror = () => {
      setError("Connection to the server was lost. Please refresh the page and try again.");
      eventSource.close();
      setIsSubmitting(false);
    };
    return () => eventSource.close();
  }, [jobId]);

  // Get admin data
    useEffect(() => {
      console.log('user or auth0 loading')
      if (!userId) return;
       console.log('loaded')
    
      const getAdminUser = async () => {
        setAdminError(null);
        try {
          const response = await fetch(`/api/admin?userId=${userId}`);
  
          if (response.status === 204) {
            setAdminError("You don't have permission to access this page.");
            return;
          }
  
          const data = await response.json();
          console.log('admin data:', data)
    
          if (!response.ok) {
            throw new Error(data.error || "Failed to fetch admin data");
          }
  
          if (data.admin.permission) {
            setAdminPermission(data.admin.permission)
          };

          if (data.admin.permission !== "admin") {
            setAdminError("You don't have permission to access this page.");
            return;
          };
    
          setLocation(data.admin.location);
        } catch (error: unknown) {
          console.error("Error fetching admin data:", error);
        
          if (error instanceof Error) {
            setAdminError(error.message);
          } else {
            setAdminError("Unknown error occurred");
          }
        
        } finally {
          setIsLoading(false);
        }
      };
    
      getAdminUser();
    }, [userId]);

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
          setTotalRowsToProcess(results.data.length);
        }
      },
    });
  };

  const handleSubmit = async () => {
    if (!parsedData || !location) {
      setError("No valid data to upload or location is missing.");
      return;
    }
    setError(null);
    setJobId(null);
    setJobResults([]);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/match/bulk-upload/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: parsedData, location: location._id.toString() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start upload job.');
      }

      setJobId(data.jobId);
      
      setParsedData(null);
      setFileName(null);

      // Reset file input
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please check the console for details.");
        console.error("Caught a non-Error object in handleSubmit:", err);
      }
      setIsSubmitting(false);
    }
  };

  const progress = totalRowsToProcess > 0
    ? (jobResults.length / totalRowsToProcess) * 100
    : 0;

  const userErrors = jobResults.filter(r => r.status === 'user_error');
  const serverErrors = jobResults.filter(r => r.status === 'server_error');
  const isComplete = !isSubmitting && jobResults.length > 0;

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push(`/auth/login?returnTo=/admin/upload-matches`)
    }
  })

    if (isMobile === null) {
      return null;
    }
    
    
    return (
      <Flex direction={'column'} style={{backgroundColor: "#F6F8FA"}} height={'100vh'}>

        {/* Header */}
        <Flex justify={"between"} align={'center'} height={'70px'} direction={"row"} px={{initial: '3', md: '9'}}>
          <Flex direction={'column'} position={'relative'} maxWidth={'80px'}>
            <Image
              src={darkGgLogo}
              alt="GG Pickleball dark logo"
              priority
              height={540}
              width={960}
            />
          </Flex>

          {!auth0IsLoading && (
            <Flex direction={'row'} align={'center'} justify={'center'}>
              <Text size={'3'} weight={'bold'} align={'right'}>
                {userName ? (
                  auth0User 
                    ? `Welcome ${String(userName).includes('@') ? String(userName).split('@')[0] : userName}`
                    : `${String(userName).includes('@') ? String(userName).split('@')[0] : userName} (guest)`
                ) : ''}
              </Text>

              {isMobile && adminPermission === 'admin' && (
                <MobileMenu />
              )}
            </Flex>
          )}
        </Flex>
          
        {/* Location Logo */}
        {location && (
          <Flex direction={'column'} height={'120px'} justify={'center'} style={{backgroundColor: location?.bannerColor, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', zIndex: 2}}>
            <Flex direction={'column'} position={'relative'} height={{initial: '60px', md: '80px'}}>
              <Image
                src={location.admin_logo}
                alt="Location logo"
                priority
                fill
                style={{objectFit: 'contain'}}
              />
            </Flex>
          </Flex>
        )}

        {/* Dashboard and Menu */}
        <Flex direction={'column'} maxWidth={'1500px'} align={{initial:'center', md: 'stretch'}}>
          {adminError ? (
            <Flex direction={'column'} justify={'center'} gap={'4'} display={adminError ? 'flex' : 'none'}>
              <Callout.Root size={'3'} color="red" >
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  {adminError}
                </Callout.Text>
              </Callout.Root>
            </Flex>
          ) : isLoading ? (
            <Flex direction={'column'} justify={'center'} align={'center'} mt={'9'}>
              <Spinner size={'3'} style={{color: 'black'}} />
            </Flex>
          ) : (
              
           <Flex direction={'row'} height={"calc(100vh - 190px)"}>
            
              {/* Left sidebar nav */}
              {!isMobile && adminPermission === 'admin' && (
                <Flex direction={'column'} width={'200px'} py={'4'} px={'2'} style={{backgroundColor: '#F1F1F1', borderRight: '1px solid #d3d3d3'}}>
                  <Flex direction={'column'} gap={'3'} px={'2'}>
                    <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                      <Link href={'/admin'} style={{backgroundColor: 'white', borderRadius: '10px'}}>Dashboard</Link>
                    </Flex>
                    <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                      <Link href={'/admin/achievements'}>Set achievements</Link>
                    </Flex>
                    <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                      <Link href={'/admin/rewards'}>Configure rewards</Link>
                    </Flex>
                    <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                      <Link href={'/admin/upload-matches'}>Upload matches</Link>
                    </Flex>
                  </Flex>
                </Flex>
              )}

              <Flex direction={{initial: 'column', md: 'row'}} width={'100%'} overflowY={'auto'} gap={{initial: '8', md: '6'}} my={'4'} mx={'4'}>
                
                {/* UPLOAD MATCHES */}
                <Flex direction={'column'} width={{initial: '100%', md: '50%'}} gap={'4'}>

                  <Heading>Bulk Match Upload</Heading>

                  {error && <Callout.Root color="red">{error}</Callout.Root>}

                  <Flex direction="column" gap="3" asChild>
                    <Card>
                      <Text as="div" weight="bold" mb="2">1. Download Template</Text>
                      <Text as="p" size="2" color="gray" mb="3">
                        Download the CSV template, fill it out with your match data, and save the file.
                      </Text>
                      <Button asChild variant="soft">
                        <a href="/api/match/csv-template" download>Download Template</a>
                      </Button>
                    </Card>
                  </Flex>
                  
                  <Flex direction="column" gap="3" asChild>
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
                  </Flex>

                  <Button size="3" onClick={handleSubmit} disabled={isSubmitting || !parsedData}>
                    {isSubmitting ? 'Uploading...' : `Process ${parsedData?.length || 0} Matches`}
                  </Button>
                </Flex>

                {/* STATUS */}
                <Flex direction={'column'} width={{initial: '100%', md: '50%'}} gap={'6'}>

                  <Flex direction={'column'} gap={'4'}>
                    {/* Progress Bar and Summary Messages */}
                    <Flex>
                      {isSubmitting && <Progress value={progress} size={'3'} />}
                    </Flex>
                    {/* ERRORS */}
                    {isComplete && userErrors.length > 0 && (
                      <Callout.Root color="orange" size="2">
                        <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
                        <Callout.Text>
                          Some rows failed due to correctable errors. Please fix the rows listed below and re-upload **<Strong>only the failed rows</Strong>** in a new file.
                        </Callout.Text>
                      </Callout.Root>
                    )}

                    {isComplete && serverErrors.length > 0 && (
                      <Callout.Root color="red" size="2">
                        <Callout.Icon><CrossCircledIcon /></Callout.Icon>
                        <Callout.Text>
                          Some rows failed due to a server error. We have been notified. Please make a note of the failed rows below and contact support if the issue persists.
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>

                  {jobResults.length > 0 && (
                    <Flex direction={'column'} width={'100%'} style={{overflow: 'hidden'}}>
                      <Card>
                        <Heading as="h3" size="4" mb="3">Processing Results</Heading>
                        <Flex direction="column" style={{ height: '100%', overflowY: 'auto' }}>
                          <Table.Root variant="surface">
                            <Table.Header style={{ position: 'sticky', top: 0}}>
                              <Table.Row style={{ position: 'sticky', top: 0}}>
                                <Table.ColumnHeaderCell>CSV Row</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Players</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {jobResults.map(res => {
                                const statusColor = res.status === 'success' ? 'green' : res.status === 'user_error' ? 'orange' : 'red';
                                
                                return (
                                  <Table.Row key={res.row}>
                                    <Table.Cell><Code>{res.row}</Code></Table.Cell>
                                    <Table.Cell>
                                      <Text size="2">{res.data?.players.join(', ') || 'N/A'}</Text>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text size="2">{res.data?.score || 'N/A'}</Text>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text color={statusColor} size="2">{res.message}</Text>
                                    </Table.Cell>
                                  </Table.Row>
                                
                                );
                              })}
                            </Table.Body>
                          </Table.Root>
                        </Flex>
                      </Card>
                    </Flex>
                  )}
                </Flex>
              </Flex>
            </Flex>
          )};
          
      </Flex>
    </Flex>
  );
}