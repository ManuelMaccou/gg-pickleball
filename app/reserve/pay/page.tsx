import { stripe } from '@/lib/stripe';
import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { Box, Card, Flex, Strong, Text } from '@radix-ui/themes';
import Image from 'next/image';
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import connectToDatabase from '@/lib/mongodb';
import { ObjectId } from "mongodb";

import User from "@/app/models/User";
import StripeReservationForm from '@/app/components/ui/stripeReservationForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { IMatch, IUser } from '@/app/types/databaseTypes';
import DesktopSidebar from '@/app/components/Sections/DesktopSidebar';
import TopBanner from '@/app/components/Sections/TopBanner';

interface ILocation {
  _id: ObjectId;
  name: string;
  address?: string;
}

export default async function Pay({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {

  await connectToDatabase();

  let errorMessage: string | null = null;

  const matchId = (await searchParams).matchId
  if (!matchId) {
    errorMessage = "There was an error loading match details. Please go back and try again.";
  }

  let matchPlayers: IUser[] = [];
  let match: IMatch | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const response = await fetch(`${baseUrl}/api/matches?matchId=${matchId}`);

    if (!response.ok) {
      errorMessage = "There was an error loading match details. Please go back and try again.";
    } else {
      const data = await response.json();
      matchPlayers = data.users;
      match = data.match;
    }
  } catch (error) {
    console.error("Error fetching chat users:", error);
  }


  const session = await auth0.getSession();
  if (!session || !session.user) {
    errorMessage = "You must be logged in to view this page.";
  }

  let currentUser: IUser | null = null;
  if (session?.user) currentUser = await User.findOne({ auth0Id: session.user.sub });

  if (!currentUser) {
    errorMessage = "You must be logged in to view this page.";
  }

  console.log('current user:', currentUser?._id)
  console.log('match players:', matchPlayers)

  const isUserAuthorized = matchPlayers.some(
    (u) => new ObjectId(u._id).equals(currentUser?._id)
  );
  

  if (!isUserAuthorized) {
    errorMessage = 'You are not authorized to view this page'
  }

  if (errorMessage) {
    return (
      <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}}>
        <Flex display={{ initial: 'none', md: 'flex' }}>
          <DesktopSidebar />
        </Flex>

        <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
          <TopBanner />
        </Flex>
        <Box m="4">
          <Alert variant="destructive" style={{ backgroundColor: "white" }}>
            <AlertCircle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </Box>
      </Flex>
    );
  }

  const smpcDiscountedTimes: Record<string, string[]> = {
    Monday: [
      "12-2pm", "12:30-2:30pm", "1-3pm", "1:30-3:30pm", "2-4pm",
      "7:30-9:30pm", "8-10pm"
    ],
    Tuesday: [
      "12-2pm", "12:30-2:30pm", "1-3pm", "1:30-3:30pm", "2-4pm",
      "7:30-9:30pm", "8-10pm"
    ],
    Wednesday: [
      "12-2pm", "12:30-2:30pm", "1-3pm", "1:30-3:30pm", "2-4pm",
      "7:30-9:30pm", "8-10pm"
    ],
    Thursday: [
      "12-2pm", "12:30-2:30pm", "1-3pm", "1:30-3:30pm", "2-4pm",
      "7:30-9:30pm", "8-10pm"
    ],
    Friday: [
      "12-2pm", "12:30-2:30pm", "1-3pm", "1:30-3:30pm", "2-4pm",
      "7:30-9:30pm", "8-10pm"
    ],
    Saturday: [
      "6-8pm", "6:30-8:30pm", "7-9pm", "7:30-9:30pm", "8-10pm", "8:30-10:30pm",
      "9-11pm"
    ],
    Sunday: [
      "6-8pm", "6:30-8:30pm", "7-9pm", "7:30-9:30pm", "8-10pm", "8:30-10:30pm",
      "9-11pm"
    ]
  };

  function isDiscounted(dayTime: string): boolean {
    const [day, time] = dayTime.split(" ");
    if (!day || !time) return false;
    return smpcDiscountedTimes[day]?.includes(time) ?? false;
  }

  let finalAmountToPay: number = 0;
  let basePay: number = 0;
  let discount: number = 0;

  if (match && typeof match.location === "object" && "name" in match.location) {
    if (match.location.name === "Pickle Pop") {
      basePay = 29;
      discount = 5;
      finalAmountToPay = 2500;
    } else if (match.location.name === "Santa Monica Pickleball Center") {
      const formattedTime = `${match.day} ${match.time}`

      if (isDiscounted(formattedTime)) {
        basePay = 30;
        discount = 5;
        finalAmountToPay = 2600
      } else {
        basePay = 30;
        finalAmountToPay = 3100
      }
     
    }
  }
  


  const { client_secret: clientSecret } = await stripe.paymentIntents.create({
    amount: finalAmountToPay,
    currency: 'usd',
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
  });

  if (!clientSecret) {
    console.error('Failed to create payment intent. Missing clientSecret.');
    redirect('/pay/error');
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown Date";
  
    const [year, month, day] = dateString.split("-");
  
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })
      .format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
  };

  const formattedMatchDate = formatDate(match?.date)

  return (
    <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}}>
      <Flex display={{ initial: 'none', md: 'flex' }}>
        <DesktopSidebar />
      </Flex>

      <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
        <TopBanner />
      </Flex>

      <Flex direction={{initial: 'column', md: 'column'}} justify={'center'} width={{initial: "100%", md: "60%"}} style={{marginRight: 'auto', marginLeft: 'auto'}}>

      <Card >
     

    
        <Flex justify={'center'} my={'9'} display={{initial: 'flex', md: 'none'}}>
          <Image
            src={lightGGLogo}
            alt="GG Pickleball dark logo"
            priority
            style={{
              width: 'auto',
              maxHeight: '125px',
            }}
          />
        </Flex>
        <Flex direction={'column'} justify={'center'} px={'5'} style={{backgroundColor: '#262349'}} py={'6'}>
          <Text size={'7'} align={"center"} weight={'bold'} mb={'1'}>Reserve court</Text>
          {match?.location && typeof match.location === "object" && "name" in match.location && (
            <Text align={'center'} size={'6'} mb={'1'}>{(match.location as ILocation).name}</Text>
          )}
          <Text align={'center'} size={'6'} mb={'5'}>{formattedMatchDate} from {match?.time}</Text>
                  
          <Text align={{initial: 'center', md: 'left'}} size={'9'} weight={'bold'} mb={'5'}>{finalAmountToPay === 0 ? "Error calculating amount" : `$${finalAmountToPay / 100}.00`}</Text>
          <Flex direction={'column'}>
            <Text align={{initial: 'center', md: 'left'}} size={'4'}><Strong>Reservation fee:</Strong>{" "}${basePay}.00</Text>
            {discount !== 0 && (
              <Text color='green' align={{initial: 'center', md: 'left'}} size={'4'}><Strong>GG Discount:</Strong>{" "}-${discount}.00</Text>
            )}
            <Text align={{initial: 'center', md: 'left'}} size={'4'}><Strong>Technology fee:</Strong> $1.00</Text>
          </Flex>
        </Flex>

        <Flex direction={'column'} justify={'center'}>
        <div id="checkout">
          <StripeReservationForm clientSecret={clientSecret as string} userId={currentUser?._id?.toString() ?? ''}/>
        </div>
        </Flex>

     
      </Card>
      </Flex>

      
    </Flex>
  );
}
