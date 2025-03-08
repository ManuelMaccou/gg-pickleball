import { stripe } from '@/lib/stripe';
import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { Box, Flex, Text } from '@radix-ui/themes';
import Image from 'next/image';
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import connectToDatabase from '@/lib/mongodb';
import User from "@/app/models/User";
import Team from "@/app/models/Team";
import StripeCheckoutForm from '@/app/components/ui/stripeCheckoutForm';
import { ITeam } from '@/app/types/databaseTypes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default async function Pay({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {

  let errorMessage: string | null = null;

  const teamId = (await searchParams).teamId
  if (!teamId) {
   errorMessage = "Invalid URL"
  }

  const session = await auth0.getSession();
  if (!session || !session.user) {
    redirect('/auth/login?returnTo=/register/pay');
  }

  await connectToDatabase();

  const currentUser = await User.findOne({ auth0Id: session.user.sub });

  if (!currentUser) {
    redirect('/register');
  }

  const team: ITeam | null = await Team.findOne({ teammates: currentUser._id });

  if (!team || (team.registrationStep !== 'CAPTAIN_REGISTERED' && team.registrationStep !== 'TEAMMATE_INVITED' && team.registrationStep !== 'TEAMMATE_REGISTERED' )) {
    redirect('/register');
  }

  let finalAmount: number = 8000;

  if (team.individual === true) {
    if (currentUser.referrer === 'trainingmate' || currentUser.referrer === 'courtandcrew') {
      finalAmount = 3000
    } else {
      finalAmount = 4000
    }
  } else  if (currentUser.referrer === 'trainingmate' || currentUser.referrer === 'courtandcrew') {
    finalAmount = 7000
  } else {
    finalAmount = 8000
  }

  const { client_secret: clientSecret } = await stripe.paymentIntents.create({
    amount: finalAmount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  });

  if (!clientSecret) {
    console.error('Failed to create payment intent. Missing clientSecret.');
    redirect('/pay/error');
  }

  if (errorMessage) {
    return (
      <Flex direction="column" justify={'center'} height={'100vh'}>
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

  return (
    <Flex direction={'column'}>
      <Flex justify={'center'} my={'9'}>
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
      <Flex direction={'column'} justify={'center'}>
        <Text align={'center'} size={'7'} weight={'bold'} mb={'5'}>The inaugural season</Text>
        <Text align={'center'} size={'9'} weight={'bold'} mb={'5'}>${finalAmount/100}</Text>
      </Flex>
      <div id="checkout">
        <StripeCheckoutForm clientSecret={clientSecret as string} userId={currentUser._id?.toString()} />
      </div>
    </Flex>
  );
}
