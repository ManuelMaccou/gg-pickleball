import { Flex, Text, IconButton, VisuallyHidden, Strong, Button, Link } from '@radix-ui/themes';
import { RewardWithContext } from '@/app/types/rewardTypes';
import Image from 'next/image';
import '../GlobalRewardsWallet/wallet.css';
import { Cross2Icon } from '@radix-ui/react-icons';
import { CSSProperties } from 'react'; // <--- Import CSSProperties

type Props = {
  reward: RewardWithContext;
  onClose: () => void;
  style?: CSSProperties; // <--- Add optional style prop
};

export const RewardDetailView = ({ reward, onClose, style }: Props) => {
  const isUnlocked = (reward.codes?.filter(c => !c.redeemed).length ?? 0) > 0;
  const location = reward.sponsoringClient;

  const rewardCode = reward.codes?.find(c => !c.redeemed)?.code;

  console.log('reward:', reward)
  console.log('shop domain:', reward?.sponsoringClient?.shopify?.shopDomain)

  return (
    <Flex 
      direction="column" 
      gap="4" 
      p="5" 
      className="reward-detail-view"
      style={style} // <--- Apply the style prop here
    >
      <IconButton className="reward-detail-close-btn" variant="ghost" color="gray" onClick={onClose}>
        <Cross2Icon width="24" height="24" />
      </IconButton>
      
      {isUnlocked ? (
        <Flex direction={'column'} gap="3">
            <VisuallyHidden>
                <Text size={'6'}>Your reward details</Text>
            </VisuallyHidden>

            <Flex direction={'column'} align={'center'}>
                <Flex direction={'column'} align={'center'} position={'relative'} height={'100px'} width={'150px'}>
                    <Image
                        src={location.logo}
                        alt={location.name ?? 'Location logo'}
                        fill
                        priority
                        style={{objectFit: 'contain'}}
                    />
                </Flex>

                {reward.product !== 'custom' && (
                    <Text align={'center'} size={'6'} weight={'bold'} style={{textTransform: "uppercase"}}>
                        {reward.product}
                    </Text>
                )}
            </Flex>

            <Text size={reward.product === 'custom' ? '7' : '9'} weight={'bold'} align={'center'}>{reward.friendlyName}</Text>

            {reward.productDescription && (
                <Text align={'center'}>{reward.productDescription}</Text>
            )}
            
            {reward.minimumSpend && reward.product === 'pro shop' ? (
                <Text align={'center'}>Minimum spend to qualify: ${reward.minimumSpend}</Text>
            ) : reward.maxDiscount && reward.product === 'pro shop' ? (
                <Text align={'center'}>Max discount amount: ${reward.maxDiscount}</Text>
            ) : null}

            <Flex direction={'column'} mt={'4'} gap={'4'}>
                <Text size={'4'}><Strong>To redeem: </Strong>
                  Visit the webiste below to start shopping. The discount code is automatically applied.
                </Text>
                <Link 
                  href={`https://${reward?.sponsoringClient?.shopify?.shopDomain}/discount/${rewardCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="3" style={{ width: '100%' }}>
                    Start shopping
                  </Button>
                </Link>

                <Text size={'5'} align={'right'} weight="bold" style={{ border: '2px dashed var(--gray-8)', padding: 'var(--space-3)', borderRadius: 'var(--radius-3)', backgroundColor: 'var(--gray-3)' }}>
                    <Strong>Code: </Strong>{rewardCode ?? 'Unavailable'}
                </Text>
            </Flex>
        </Flex>
      ) : (
        <>
          <Text size="5" weight="bold">How to Unlock</Text>
          <Text>To activate this reward, you need to earn the **{reward.achievementFriendlyName}** achievement.</Text>
          <Text color="gray" mt="2">Task: {reward.achievementTask}</Text>
        </>
      )}
    </Flex>
  );
};