'use client'

import { useUser } from "@auth0/nextjs-auth0"
import Image from 'next/image';
import { Flex, Text, Box } from '@radix-ui/themes';
import lightGGLogo from '../../../../public/gg_logo_white_transparent.png';
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ITeam, IUser } from "@/app/types/databaseTypes";

const SuccessIcon =
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M15.4695 0.232963C15.8241 0.561287 15.8454 1.1149 15.5171 1.46949L6.14206 11.5945C5.97228 11.7778 5.73221 11.8799 5.48237 11.8748C5.23253 11.8698 4.99677 11.7582 4.83452 11.5681L0.459523 6.44311C0.145767 6.07557 0.18937 5.52327 0.556912 5.20951C0.924454 4.89575 1.47676 4.93936 1.79051 5.3069L5.52658 9.68343L14.233 0.280522C14.5613 -0.0740672 15.1149 -0.0953599 15.4695 0.232963Z" fill="white"/>
  </svg>;

export default function RegistrationSuccessPage() {
  const customMessage = 'Registration Successful!';
  const subText =
    'Thank you for registering for the first ever GG Pickleball league. You will only pay if we are able to match you with another similarly skilled player. Keep an eye on your email. Be sure to add play@ggpickleball.co to your contact list to avoid updates going to your spam folder.';
  
  const { user } = useUser()
  const router = useRouter();
  const searchParams = useSearchParams();

  const [seasonId, setSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && searchParams) {
    const regionIdParam = searchParams.get('regionId');
    const seasonIdParam = searchParams.get('seasonId');
    const teammate1Param = searchParams.get('teammate1');
    const teamIdParam = searchParams.get('teamId');

    if (!(teammate1Param && regionIdParam && seasonIdParam && teamIdParam)) {
      router.push('/register')
    }

    setSeasonId(seasonIdParam);
  }
}, [searchParams, router]);

 useEffect(() => {
    if (!user || !seasonId) return;

    const checkProgress = async() => {
      try {
        console.log('Starting access check for user:', user.sub);

        const getCurrentUser = await fetch(`/api/users/auth0Id/?auth0Id=${user.sub}`);
        if (!getCurrentUser.ok) {
          throw new Error(`Failed to fetch user: ${getCurrentUser.statusText}`);
        }

        const { user: currentUser }: { user: IUser } = await getCurrentUser.json();
        if (!currentUser) {
          console.log('current user not found individual success')
          router.push('/register')
          return;
        }

        const getCurrentTeam = await fetch(
          `/api/teams/findByUserAndSeason?userId=${currentUser._id}&seasonId=${seasonId}`
        );

        if (!getCurrentTeam.ok) {
          throw new Error(`Failed to fetch team: ${getCurrentTeam.statusText}`);
        }

        const { team }: { team: ITeam } = await getCurrentTeam.json();
        console.log('Fetched team:', team);

        if (!team || team.registrationStep !== "CAPTAIN_REGISTERED") {
          console.log('Invalid team state, redirecting to /register');
          router.push('/register');
        } else {
          console.log('Access granted!');
        }
      } catch (error) {
        console.error('Access check failed:', error);
        router.push('/register');
      }
    };
    
    checkProgress();

  }, [router, seasonId, user])



  if (!user) return null

  return (
    <StatusLayout>
      <StatusMessage
        icon={SuccessIcon}
        iconColor="#30B130"
        title={customMessage}
        subText={subText}
      />
    </StatusLayout>
  );
}

function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction="column" align="center" justify="center" className="min-h-screen px-4">
      <Flex justify="center" my="9">
        <Image
          src={lightGGLogo}
          alt="GG Pickleball dark logo"
          priority
          style={{ width: 'auto', maxHeight: '125px' }}
        />
      </Flex>
      {children}
    </Flex>
  );
}

interface StatusMessageProps {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subText: string;
}

function StatusMessage({ icon, iconColor, title, subText }: StatusMessageProps) {
  return (
    <Flex direction={"column"} align={"center"} justify={"center"} mt={"-9"} mb={"5"}>
      <Box
        style={{
          backgroundColor: iconColor,
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '48px',
          height: '48px',
        }}
      >
        {icon}
      </Box>

      <Text size="8" weight="bold" mt="4" align="center">
        {title}
      </Text>

      <Text size="4" color="gray" mt="2" align="center" className="max-w-md">
        {subText}
      </Text>
    </Flex>
  );
}
