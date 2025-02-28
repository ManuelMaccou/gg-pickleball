'use client'

import { useSearchParams } from 'next/navigation'
import { useUser } from "@auth0/nextjs-auth0"
import Cookies from "js-cookie";
import { Box, Button, Flex, Heading, Text, Theme } from "@radix-ui/themes";
import Image from "next/image";
import { motion } from "framer-motion";
import { Goldman } from 'next/font/google';
import courtcrew_logo from "../public/logos/courtcrew_logo.png"
import trainingmate_logo from "../public/logos/trainingmate_logo.png"
import knockaround_logo from "../public/logos/knockaround_logo.png"
import The_Hive_Logo from "../public/logos/The_Hive_Logo.png"
import everytable_logo from "../public/logos/everytable_logo.png"
import picklepop_logo from "../public/logos/picklepop_logo.png"
import gherkin_logo from "../public/logos/gherkin_logo.png"
import smpc_logo from "../public/logos/smpc_logo.png"
import pbplayer2 from "../public/pbplayer2.jpeg"
import pbplayer3 from "../public/pbplayer3.jpeg"
import pbplayer1 from "../public/pbplayer1.jpeg"
import gg_example from "../public/gg_example.png"
import gg_example2 from "../public/gg_example2.png"
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

const goldman = Goldman({
  weight: ['400', '700'],
  subsets: ['latin'],
});

function HomePage() {
  const searchParams = useSearchParams()
  const { user, isLoading } = useUser()

  const [referrer, setReferrer] = useState<string | null>(null);
  

  useEffect(() => {
    const referrerParam = searchParams.get("referrer");

    if (referrerParam) {
      setReferrer(referrerParam);
      Cookies.set("referrer", referrerParam, { expires: 30 }); // 30 days
    } else {
      const storedReferrer = Cookies.get("referrer");
      if (storedReferrer) {
        setReferrer(storedReferrer);
      }
    }
  }, [searchParams]);
  
  const moreInfoRef = useRef<HTMLDivElement>(null);

  const scrollToPartners = () => {
    moreInfoRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const pickleballImages = [pbplayer1, pbplayer2, pbplayer3]
  const facilityPartnerLogos = [
    {
      image: smpc_logo,
      url: 'https://santamonicapickleballcenter.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=facility-partners&utm_content=smpc-logo',
    },
    {
      image: picklepop_logo,
      url: 'https://www.picklepop.co/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=facility-partners&utm_content=picklepop-logo',
    },
  ];

  const communityPartnerLogos = [
    {
      image: courtcrew_logo,
      url: 'https://thecourtandcrew.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=courtcrew-logo',
    },
    {
      image: gherkin_logo,
      url: 'https://www.gherkinusa.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=gherkin-logo',
    },
    {
      image: trainingmate_logo,
      url: 'https://trainingmate.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=trainingmate-logo',
    },
    {
      image: The_Hive_Logo,
      url: 'https://www.hivehealthyeats.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=the-hive-logo',
    },
    {
      image: knockaround_logo,
      url: 'https://knockaround.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=knockaround-logo',
    },
    {
      image: everytable_logo,
      url: 'https://www.everytable.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=everytable-logo',
    },
  ];
  

  return (
    <Theme appearance="light" accentColor="yellow">
      <Flex direction={'column'} width={'100vw'}>
        
        {/* HERO SECTION */}
        <Flex direction={{ initial: 'column', md: 'row' }} width={'100vw'} minHeight={{initial: '60vh', md: '75vh'}}>
          <Flex
            direction={{initial: "row", md:"column"}} 
            width={{initial: '100vw', md: '40vw'}}
            gap={{initial: "1", md: '2'}}
          >
            {pickleballImages.map((image, index) => {
              const marginLeftOffsets = ["md:ml-40", "md:ml-12", "md:ml-40"];
              const marginRightOffsets = ["md:-mr-40", "md:-mr-12", "md:-mr-40"];
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={index}
                  initial={{ x: isEven ? -200 : 200, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    duration: 0.8,
                    ease: "easeOut",
                    delay: index * 0.3, // Staggered effect
                  }}
                  className={`relative w-full h-full ${
                    index > 1 ? 'hidden md:block' : '' // Hide image 3 on mobile
                  }`}
                >
                  <Box
                    className={`relative flex-1 w-full ${marginLeftOffsets[index]} ${marginRightOffsets[index]}`}
                  >
                    <Image
                      src={image}
                      alt={`Pickleball player ${index + 1}`}
                      className="object-cover object-top h-[20vh] md:h-[25vh] w-[100%] md:w-[90%]"
                      priority={index === 2}
                    />
                  </Box>
                </motion.div>
              );
            })}
          </Flex>
          
          {/* Heading & CTA */}
          <Flex direction={'column'} justify={'center'} align={'center'} className="flex-1 px-4 py-12">
            <Heading as="h1" size={{initial:'8', md: '9'}} mb={'7'} align={'center'} className={`${goldman.className} w-[70%]`}>Santa Monica Pickleball League</Heading>
            <Text size={'5'} weight={'bold'} mb={'5'} align={'center'}>Santa Monica is your court.</Text>
            <Flex direction={'row'} gap={'5'} wrap={'wrap'} justify={'center'}>
              <Button onClick={scrollToPartners} size={'4'}>
                <Text weight={'bold'}>Learn more</Text>
              </Button>
              <Button size="4" disabled={isLoading} asChild>
                <a href={user ? "/register" : `/auth/login?screen_hint=signup&returnTo=/register${referrer ? `?referrer=${referrer}` : ""}`}>
                  <Text size="4" weight="bold">Register</Text>
                </a>
              </Button>
            </Flex>
          </Flex>
        </Flex>

        {/* FACILITY PARTNERS */}
        <Flex direction={'column'} align={'center'} mt={{initial: '0', md: '9'}} className="w-full bg-white px-4" >
          <Heading as="h3" align={'center'} className={goldman.className}>Facility Partners</Heading>

          <Flex direction={'row'} width={'100vw'} wrap={'wrap'} justify={'center'} align={'center'} gapX={'9'} gapY={'5'} mt={'4'}>
          {facilityPartnerLogos.map((partner, index) => {
            return (
              <Flex
                key={index}
                className={`relative`}
                justify={'center'}
                maxWidth={'150px'}
                asChild
              >
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={partner.image}
                    alt={`Partner logo ${index + 1}`}
                    style={{
                      objectFit: "contain",
                      objectPosition: "center",
                      maxHeight: '70px',
                      maxWidth: 'auto'
                    }}
                  />
                </a>
              </Flex>
            );
          })}
          </Flex>
        </Flex>

        {/* COMMUNITY PARTNERS */}
        <Flex direction={'column'} align={'center'} my={'9'} className="w-full bg-white px-4" >
          <Heading as="h3" align={'center'} className={goldman.className}>Community Partners</Heading>

          <Flex direction={'row'} width={{initial:'100vw', md:'70vw'}} wrap={'wrap'} justify={'center'} align={'center'} gapX={'9'} gapY={'5'} mt={'4'}>
          {communityPartnerLogos.map((partner, index) => {
            return (
              <Flex
                key={index}
                className={`relative`}
                justify={'center'}
                maxWidth={'150px'}
                asChild
              >
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={partner.image}
                    alt={`Partner logo ${index + 1}`}
                    style={{
                      objectFit: "contain",
                      objectPosition: "center",
                      maxHeight: '70px',
                      maxWidth: 'auto'
                    }}
                  />
                </a>
              </Flex>
            );
          })}
          </Flex>
        </Flex>
        
        <Flex direction={'column'} width={'100vw'} align={'center'} justify={'center'} py={'9'}>
          <Flex direction={{initial: 'column', md:'row'}} maxWidth={'800px'} align={'center'} gapX={'9'} gapY={'5'} ref={moreInfoRef}>
            <Box>
              <Heading as="h2" size={'8'} className={goldman.className}>Community.</Heading>
              <Heading as="h2" size={'8'} className={goldman.className}>Pickleball.</Heading>
              <Heading as="h2" size={'8'} className={goldman.className}>Cash.</Heading>
            </Box>
            <Box px={{initial: "4", md: '0'}}>
              <Text size={'6'}>
                GG Pickleball is a unique and flexible monthly league that brings
                players together across multiple facilities and courts.
                Play matches against similarly skilled players when your schedule allows.
              </Text>
            </Box>
          </Flex>
        </Flex>

        {/* PRICING & TEXT BLOCKS */}
        <Flex direction={'column'} width={'100vw'} align={'center'} justify={'center'} py={'9'} style={{backgroundColor: "#F8F9FD"}}>
          <Flex direction={{ initial: 'column', md: 'row' }} maxWidth={'800px'} align={'center'} gap={'9'}>
            <Flex direction={'column'}>
              <Text size={'6'}>Only</Text>
              <Flex direction={'row'} gap={'3'} mb={'5'} minWidth={'300px'}>
                <Text size={'9'} weight={'bold'}>$80</Text>
                <Flex direction={'column'}>
                  <Text>per team</Text>
                  <Text>per monthly season</Text>
                  <Text>+ court fees</Text>
                </Flex>  
              </Flex> 
              <Text size={'6'} weight={'bold'} mb={'4'}>First season starts March 15th</Text>
              <Button size="4" disabled={isLoading} asChild>
                <a href={user ? "/register" : "/auth/login?screen_hint=signup&returnTo=/register"}>
                  <Text size="4" weight="bold">Register</Text>
                </a>
              </Button>
            </Flex>
            <Flex direction={'column'} gap={'4'} px={{initial: "4", md: '0'}}> 
              <Text size={'5'} className={goldman.className}>Cash and prizes for top teams.</Text>
              <Text size={'5'} className={goldman.className}>Discounted court fees.</Text>
              <Text size={'5'} className={goldman.className}>Discounts at local businesses for everyone.</Text>
              <Text size={'5'} className={goldman.className}>League platform to match with similarly skilled opponents.</Text>
            </Flex>
          </Flex>
        </Flex>

        {/* INFO SECTIONS */}
        <Flex direction="column" align="center" py="9" className="w-full bg-[#111110] text-white px-4">
          <Flex direction="column" align={'center'} className="w-full max-w-[1000px] gap-12">
            {/* Section 1 */}
            <Flex
              direction={{ initial: 'column', md: 'row' }}
              gap="9"
              align="center"
              className="w-full"
            >
              <Box className="flex justify-center md:justify-start">
                <Image
                  src={gg_example}
                  alt="GG Pickleball screenshot"
                  className="max-w-[200px] h-auto"
                />
              </Box>
              <Flex direction="column" className="max-w-full md:max-w-[600px]" gap="7">
                <Flex direction="column" gap="3">
                  <Text size="7" weight="bold" className={`${goldman.className} text-white`}>
                    Register
                  </Text>
                  <Text size="6" className="text-white leading-relaxed">
                    Register by entering your availability, preferred court, and DUPR rating. If you
                    don&apos;t have a DUPR account, you can simply put beginner, intermediate, or
                    advanced.
                  </Text>
                </Flex>
                <Flex direction="column" gap="3">
                  <Text size="7" weight="bold" className={`${goldman.className} text-white`}>
                    High quality matches
                  </Text>
                  <Text size="6" className="text-white leading-relaxed">
                    We match you with opponents by skill, availability, and preferred court. You can
                    accept the challenge, skip to the next team, or manually search teams. Once the
                    match-up is confirmed, it&apos;s game on!
                  </Text>
                </Flex>
              </Flex>
            </Flex>

            {/* Section 2 */}
            <Flex
              direction={{ initial: 'column', md: 'row-reverse' }}
              gap="9"
              align="center"
              className="w-full"
            >
              <Box className="flex justify-center md:justify-start">
                <Image
                  src={gg_example2}
                  alt="GG Pickleball screenshot"
                  className="max-w-[200px] h-auto"
                />
              </Box>
              <Flex direction="column" className="max-w-full md:max-w-[600px]" gap="7">
                <Flex direction="column" gap="3">
                  <Text size="7" weight="bold" className={`${goldman.className} text-white`}>
                    Play at Pickle Pop or Santa Monica Pickleball Center
                  </Text>
                  <Text size="6" className="text-white leading-relaxed">
                    Book courts at Santa Monica&apos;s top facilities and expand your pickleball
                    community. Meet new people, play quality matches, and elevate your LA pickleball
                    experience.
                  </Text>
                </Flex>
                <Flex direction="column" gap="3">
                  <Text size="7" weight="bold" className={`${goldman.className} text-white`}>
                    Win
                  </Text>
                  <Text size="6" className="text-white leading-relaxed">
                    At the end of each month, the top teams win cash and prizes from our community
                    partners. All participants will also receive discounts at local businesses.
                  </Text>
                </Flex>
              </Flex>
            </Flex>
          </Flex>

          {/* Rules Button */}
          <Flex direction={'row'} gap={'5'} wrap={'wrap'} justify={'center'} mt={'7'} mb={'9'}>
            <Button
              asChild
              variant="outline"
              size="4"
              style={{
                color: '#FFF302',
                borderColor: '#FFF302',
                borderStyle: 'solid',
                borderWidth: '1px'
              }}
              className="text-[#FFF302] border-[#FFF302] w-[200px]"
            >
              <Link href={"/rules"}>See rules</Link>
            </Button>
            <Button size="4" disabled={isLoading} asChild>
              <a href={user ? "/register" : "/auth/login?screen_hint=signup&returnTo=/register"}>
                <Text size="4" weight="bold">Register</Text>
              </a>
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Theme>
  )
};

export default function Home() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  )
};
