'use client'

import { useEffect, useState } from 'react';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png'
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { Callout, Card, Code, Flex, Heading, Progress, Spinner, Strong, Table, Text } from '@radix-ui/themes';
import Image from "next/image";
import { useUserContext } from '@/app/contexts/UserContext';
import { CrossCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import MobileMenu from '../components/MobileMenu';
import { JobResult } from '@/app/types/bulkUploadTypes';
import { useRouter } from 'next/navigation';
import MatchUploader from '../components/MatchUploader';
import { AdminSidebar } from './AdminSidebar';

interface BulkUploadContainerProps {
  context: 'local' | 'global';
}

export default function BulkUploadContainer({ context }: BulkUploadContainerProps) {

  const { user } = useUserContext();
  const router = useRouter();
  const isMobile =useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  
  const userId = user?.id;
  const userName = user?.name;

  const isSuperAdmin = !!user?.superAdmin;
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [totalRowsToProcess, setTotalRowsToProcess] = useState(0);
  const [jobResults, setJobResults] = useState<JobResult[]>([]);
  const [location, setLocation] = useState<IClient | null>(null);
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
      if (!userId) {
        return;
      }

      if (context === 'global') {
        if (!isSuperAdmin) {
          setAdminError("You don't have permission to access this page.");
          setIsLoading(false);
          return;
        }
        
        setAdminPermission('admin'); 
        setLocation(null); 
        setIsLoading(false);
      } else {
        const getAdminUser = async () => {
          setAdminError(null);
          setIsLoading(true); 
          try {
            const response = await fetch(`/api/admin?userId=${userId}`);
            
            if (response.status === 204) {
              setAdminError("You don't have permission to access this page.");
              return;
            }

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || "Failed to fetch admin data");
            }

            if (data.admin.permission) {
              setAdminPermission(data.admin.permission);
            };

            if (data.admin.permission !== "admin") {
              setAdminError("You don't have permission to access this page.");
              return;
            };
      
            setLocation(data.admin.location);
          } catch (error: unknown) {
            setAdminError(error instanceof Error ? error.message : "An unknown error occurred");
          } finally {
            setIsLoading(false);
          }
        };
        getAdminUser();
      }
    }, [userId, isSuperAdmin, context]);

  const startJob = async (endpoint: string, payload: object) => {
    setError(null);
    setJobId(null);
    setJobResults([]);
    setIsSubmitting(true);

    const finalPayload = context === 'global'
    ? { ...payload, isGlobalContext: true }
    : payload;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start job.');
      
      setTotalRowsToProcess(data.totalRows || 0);
      setJobId(data.jobId);

    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("An unexpected error occurred.");
      setIsSubmitting(false); // Stop on initial failure
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
              {!isMobile && <AdminSidebar adminPermission={adminPermission} />}

              <Flex direction={{initial: 'column', md: 'row'}} width={'100%'} overflowY={'auto'} gap={{initial: '8', md: '6'}} my={'4'} mx={'4'}>
                
                {/* UPLOAD MATCHES */}
                <MatchUploader
                  context={context}
                  isSuperAdmin={isSuperAdmin}
                  location={location}
                  isSubmitting={isSubmitting}
                  onProcess={startJob}
                  isMobile={isMobile}
                  error={error}
                />

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
                        <Flex direction="column" pb={'9'} style={{ height: '100%', overflowY: 'auto' }}>
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
                                const statusColor =
                                  res.status === 'success' ? 'green' :
                                  res.status === 'user_error' ? 'orange' :
                                  res.status === 'skipped' ? 'gray':
                                  'red';
                                
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