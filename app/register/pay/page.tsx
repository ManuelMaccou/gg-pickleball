import { stripe } from '@/lib/stripe';
import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { Flex, Text } from '@radix-ui/themes';
import Image from 'next/image';
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import connectToDatabase from '@/lib/mongodb';
import User from "@/app/models/User";
import Team from "@/app/models/Team";
import StripeCheckoutForm from '@/app/components/ui/stripeCheckoutForm';

export default async function Pay({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const teamId = (await searchParams).teamId
  if (!teamId) {
    redirect('/register')
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

  const team = await Team.findOne({ teammates: currentUser._id });

  if (!team || (team.registrationStep !== 'CAPTAIN_REGISTERED' && team.registrationStep !== 'TEAMMATE_INVITED' && team.registrationStep !== 'TEAMMATE_REGISTERED' )) {
    redirect('/register');
  }

  const { client_secret: clientSecret } = await stripe.paymentIntents.create({
    amount: 8000,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  });

  if (!clientSecret) {
    console.error('Failed to create payment intent. Missing clientSecret.');
    redirect('/pay/error');
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
        <Text align={'center'} size={'9'} weight={'bold'} mb={'5'}>$80</Text>
      </Flex>
      <div id="checkout">
        <StripeCheckoutForm clientSecret={clientSecret as string} />
      </div>
    </Flex>
  );
}
