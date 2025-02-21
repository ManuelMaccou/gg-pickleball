import { stripe } from '../../../../lib/stripe';
import Image from 'next/image';
import { Flex, Text, Box } from '@radix-ui/themes';
import lightGGLogo from '../../../../public/gg_logo_white_transparent.png';
import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Team from '@/app/models/Team';

const SuccessIcon =
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M15.4695 0.232963C15.8241 0.561287 15.8454 1.1149 15.5171 1.46949L6.14206 11.5945C5.97228 11.7778 5.73221 11.8799 5.48237 11.8748C5.23253 11.8698 4.99677 11.7582 4.83452 11.5681L0.459523 6.44311C0.145767 6.07557 0.18937 5.52327 0.556912 5.20951C0.924454 4.89575 1.47676 4.93936 1.79051 5.3069L5.52658 9.68343L14.233 0.280522C14.5613 -0.0740672 15.1149 -0.0953599 15.4695 0.232963Z" fill="white"/>
  </svg>;

const ErrorIcon =
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M1.25628 1.25628C1.59799 0.914573 2.15201 0.914573 2.49372 1.25628L8 6.76256L13.5063 1.25628C13.848 0.914573 14.402 0.914573 14.7437 1.25628C15.0854 1.59799 15.0854 2.15201 14.7437 2.49372L9.23744 8L14.7437 13.5063C15.0854 13.848 15.0854 14.402 14.7437 14.7437C14.402 15.0854 13.848 15.0854 13.5063 14.7437L8 9.23744L2.49372 14.7437C2.15201 15.0854 1.59799 15.0854 1.25628 14.7437C0.914573 14.402 0.914573 13.848 1.25628 13.5063L6.76256 8L1.25628 2.49372C0.914573 2.15201 0.914573 1.59799 1.25628 1.25628Z" fill="white"/>
  </svg>;

const InfoIcon =
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M10 1.5H4C2.61929 1.5 1.5 2.61929 1.5 4V10C1.5 11.3807 2.61929 12.5 4 12.5H10C11.3807 12.5 12.5 11.3807 12.5 10V4C12.5 2.61929 11.3807 1.5 10 1.5ZM4 0C1.79086 0 0 1.79086 0 4V10C0 12.2091 1.79086 14 4 14H10C12.2091 14 14 12.2091 14 10V4C14 1.79086 12.2091 0 10 0H4Z" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M5.25 7C5.25 6.58579 5.58579 6.25 6 6.25H7.25C7.66421 6.25 8 6.58579 8 7V10.5C8 10.9142 7.66421 11.25 7.25 11.25C6.83579 11.25 6.5 10.9142 6.5 10.5V7.75H6C5.58579 7.75 5.25 7.41421 5.25 7Z" fill="white"/>
    <path d="M5.75 4C5.75 3.31075 6.31075 2.75 7 2.75C7.68925 2.75 8.25 3.31075 8.25 4C8.25 4.68925 7.68925 5.25 7 5.25C6.31075 5.25 5.75 4.68925 5.75 4Z" fill="white"/>
  </svg>;

const STATUS_CONTENT_MAP = {
  succeeded: {
    text: 'Payment succeeded',
    subText:
      'Thank you for joining the GG Pickleball League. When the league begins, you will have full access to the dashboard to see your first match. Until then, start practicing!',
    iconColor: '#30B130',
    icon: SuccessIcon,
  },
  processing: {
    text: 'Your payment is processing.',
    subText: 'This may take a few moments. Feel free to check back later.',
    iconColor: '#6D6E78',
    icon: InfoIcon,
  },
  requires_payment_method: {
    text: 'Your payment was not successful, please try again.',
    subText: 'Your payment was not successful. Please try again or use a different payment method.',
    iconColor: '#DF1B41',
    icon: ErrorIcon,
  },
  requires_capture: {
    text: 'Payment succeeded',
    subText:
      'Thank you for joining the GG Pickleball League. When the league begins, you will have full access to the dashboard to see your first match. Until then, start practicing!',
    iconColor: '#30B130',
    icon: SuccessIcon,
  },
  default: {
    text: 'Something went wrong, please try again.',
    subText:
      'There was an issue processing your payment. Please try again later or contact support at play@ggpickleball.co.',
    iconColor: '#DF1B41',
    icon: ErrorIcon,
  },
} as const;

type Status = keyof typeof STATUS_CONTENT_MAP | string;

interface StatusPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatusPage({ searchParams }: StatusPageProps) {
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

  if (!team || (team.registrationStep !== 'TEAMMATE_INVITED' && team.registrationStep !== 'TEAMMATE_REGISTERED')) {
    redirect('/register');
  }
  
  const { payment_intent: paymentIntentId, teamId } = await searchParams;

  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return (
      <StatusLayout>
        <StatusMessage
          icon={ErrorIcon}
          iconColor="#DF1B41"
          title="Missing Payment Intent"
          subText="We couldn't retrieve your payment information. Please try again or contact support at play@ggpickleball.co."
          teamId={teamId}
        />
      </StatusLayout>
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const status: Status = paymentIntent.status;
    const statusContent =
      STATUS_CONTENT_MAP[status as keyof typeof STATUS_CONTENT_MAP] || STATUS_CONTENT_MAP.default;

      if ((status === 'succeeded' || status === 'requires_capture') && teamId) {
        try {
          const updatedTeam = await Team.findOneAndUpdate(
            { _id: teamId },
            { $set: { status: 'PAID' } },
            { new: true }
          );
    
          if (!updatedTeam) {
            console.error(`Failed to update team ${teamId}. Team not found.`);
          } else {
            console.log(`Team ${teamId} status updated to PAID.`);
          }
        } catch (err) {
          console.error('Failed to update team status:', err);
        }
      }
      

    return (
      <StatusLayout>
        <StatusMessage
          icon={statusContent.icon}
          iconColor={statusContent.iconColor}
          title={statusContent.text}
          subText={statusContent.subText}
          teamId={teamId}
          isFailed={status !== 'succeeded'}
        />
      </StatusLayout>
    );
  } catch (error) {
    console.error('Failed to retrieve payment intent:', error);

    return (
      <StatusLayout>
        <StatusMessage
          icon={ErrorIcon}
          iconColor="#DF1B41"
          title="Payment Retrieval Failed"
          subText="There was an issue retrieving your payment. Please try again later or contact support at play@ggpickleball.co."
          teamId={teamId}
        />
      </StatusLayout>
    );
  }
}

function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction={"column"} align={"center"} justify={"center"} mt={'-9'} className="min-h-screen px-4">
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
  teamId?: string | string[];
  isFailed?: boolean;
}

function StatusMessage({
  icon,
  iconColor,
  title,
  subText,
  teamId,
  isFailed = false,
}: StatusMessageProps) {
  return (
    <Flex direction="column" align="center" justify="center" mb="5">
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

      <Text size="8" weight="bold" mt="4" align={'center'}>
        {title}
      </Text>

      <Text size="4" color="gray" mt="2" align="center" className="max-w-md">
        {subText}
      </Text>

      {isFailed && (
        <Flex direction="column" align="center" mt="5">
          <a href={`/register/pay${teamId ? `?teamId=${teamId}` : ''}`}>
            <Text color="blue">Try Again</Text>
          </a>
        </Flex>
      )}
    </Flex>
  );
}
