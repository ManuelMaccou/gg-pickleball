'use client'

import { Box, Button, Flex, Text } from "@radix-ui/themes";
import Image from "next/image";
import lightGGLogo from '../../public/gg_logo_white_transparent.png'
import Link from "next/link";
import { useEffect, useState } from "react";
import { IRegion, ISeason } from "../types/databaseTypes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ApiErrorResponse } from "../types/functionTypes";

export default function Register() {
    const [activeSeason, setActiveSeason] = useState<ISeason | null>(null);
    const [region, setRegion] = useState<IRegion | null>(null);

    const [apiError, setApiError] = useState<string | null>(null);
    const [seasonError, setSeasonError] = useState<boolean>(false);
    const [regionError, setRegionError] = useState<boolean>(false);



    useEffect(() => {
      const fetchSeason = async () => {
        try {
          const response = await fetch('/api/seasons/active');
  
          if (!response.ok) {
            const errorData: ApiErrorResponse = await response.json();
            setApiError(errorData.userMessage);
            setSeasonError(true);
            throw new Error(`API Error: ${errorData.systemMessage}`);
          }
  
          const seasonData: ISeason = await response.json();
          setActiveSeason(seasonData);
        } catch (error) {
          console.error('Error fetching active season:', error);
          setApiError('An unexpected error happened. Please try again.');
        }
      };
  
      fetchSeason();
    }, []);

    useEffect(() => {
      const fetchRegion = async () => {
        try {
          const response = await fetch('/api/regions');
  
          if (!response.ok) {
            const errorData: ApiErrorResponse = await response.json();
            setApiError(errorData.userMessage);
            setRegionError(true);
            throw new Error(`API Error: ${errorData.systemMessage}`);
          }
  
          const regionData: IRegion = await response.json();
          setRegion(regionData);
        } catch (error) {
          console.error('Error fetching region:', error);
          setApiError('An unexpected error happened. Please try again.');
        }
      };
  
      fetchRegion();
    }, []);


  return (
    <Flex align={"center"} height={"100vh"} width={"100vw"} justify={"center"} direction={'column'}>
      <Flex direction={'column'} align={'center'} justify={'center'} gap={'4'} mt={'-9'}>
        <Text size={'7'} weight={'bold'}>Welcome to</Text>
        <Box>
          <Image
            src={lightGGLogo}
            alt="GG Pickleball dark logo"
            priority
            style={{
              width: 'auto',
              maxHeight: '100px',
            }}
          />
        </Box>
        <Box>
          <Flex mt={'9'} gap={'6'} direction={'column'}>
            <Button size={'4'} disabled={!activeSeason || !region} asChild>
              <Link href={`/register/team?seasonId=${activeSeason?._id}&regionId=${region?._id}`}>Register your team</Link>
            </Button>
            <Button size={'4'} disabled={!activeSeason || !region} asChild>
            <Link href={`/register/individual?seasonId=${activeSeason?._id}&regionId=${region?._id}`}>Register as an individual</Link>
            </Button>
          </Flex>
        </Box>
      </Flex>

      {apiError && (
        <Box m={'4'}>
           <Alert variant="destructive" style={{backgroundColor: "white"}}>
            <AlertCircle/>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {apiError}
            </AlertDescription>
          </Alert>
        </Box>
      )}

      {seasonError || regionError && (
        <Box m={'4'}>
           <Alert variant="destructive" style={{backgroundColor: "white"}}>
            <AlertCircle/>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              There was an error loading season data. Please refresh the page.
            </AlertDescription>
          </Alert>
        </Box>
      )}

    </Flex>
  )
}