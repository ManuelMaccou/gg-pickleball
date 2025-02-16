import { stripe } from '@/lib/stripe';
import StripeCheckoutForm from '@/app/components/ui/stripeCheckoutForm';
import { redirect } from 'next/navigation';
import { Flex, Text } from '@radix-ui/themes';
import Image from 'next/image';
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'

export default async function Pay() {
  const { client_secret: clientSecret } = await stripe.paymentIntents.create({
    amount: 8000,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true,
    },
    capture_method: 'manual',
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
