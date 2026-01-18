// components/GlobalRewardsWallet/RewardCard.tsx

import Image from 'next/image';
import { Card, Text, Flex, Box, Badge } from '@radix-ui/themes';
import { RewardWithContext } from '@/app/types/rewardTypes';
import { useMemo } from 'react';

import '../GlobalRewardsWallet/wallet.css';
import { IDataSource } from '@/app/types/databaseTypes';

type Props = {
  reward: RewardWithContext;
  index: number;
  isActiveCard: boolean;
  isUnlocked: boolean;
  onClick: () => void;
  backgroundImage?: string;
  textColor?: string;
  zIndex: number;
  dataSource: IDataSource | null;
};

const DEFAULT_CARD_BACKGROUND_IMAGE = '/rewardCardBackgrounds/defaultCardBackground.jpg';

export const RewardCard = ({
  reward,
  index,
  isActiveCard,
  isUnlocked,
  onClick,
  backgroundImage,
  textColor = '#ffffff',
  zIndex,
  dataSource,
}: Props) => {

  const unredeemedCount = reward.codes?.filter(c => !c.redeemed).length ?? 0;

  const dynamicCardStyle = useMemo(() => {
    // 1. Determine the final image URL: use the one from props or fall back to the default.
    const finalImageUrl = backgroundImage || DEFAULT_CARD_BACKGROUND_IMAGE;

    // 2. Create a standard overlay to ensure text is always readable.
    // This darkens any background image slightly, making light text pop.
    const overlay = 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))';

    const style: React.CSSProperties = {
      // 3. Combine the overlay and the image.
      backgroundImage: `${overlay}, url(${finalImageUrl})`,
      
      // Set text color from props
      color: textColor,

      // Keep the text shadow for extra readability
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
    };

    return style;
}, [backgroundImage, textColor]);

  return (
    <Box 
      className={`wallet-card-wrapper ${isActiveCard ? 'is-card-active' : ''}`}
      style={{ 
        '--index': index,
        zIndex: zIndex
      } as React.CSSProperties}
      onClick={onClick}
    >
      <Card
        className="wallet-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          aspectRatio: '1.58 / 1', // Enforce the ratio here too
          filter: isUnlocked ? 'none' : 'grayscale(100%) brightness(0.7)',
        }}
      >
        <Box 
          style={{
            width: '100%',
            height: '100%',
            ...dynamicCardStyle,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <Flex direction="column" justify="between" height="100%" p="3">
            <Flex align="center" justify={'between'} gap={'3'}>
              <Image
                src={reward.sponsoringClient.logo}
                alt={`${reward.sponsoringClient.name} logo`}
                height={70}
                width={70}
              />
              <Image
                src={dataSource?.logo ?? '/logos/gg-rewards_white.png'}
                alt={`${dataSource?.name} logo`}
                height={70}
                width={70}
              />
  
            </Flex>
          <Flex direction="column" align="center" justify="center" flexGrow="1">
            <Text size="6" weight="bold" align="center">{reward.friendlyName}</Text>
            {reward.product !== 'custom' && (
              <Text size="4" color="gray" align="center">{reward.product}</Text>
            )}
          </Flex>

          <Flex justify="end">
            {isUnlocked && (
              <Badge variant='solid' size={'2'}>
                Activated{unredeemedCount > 1 ? ` x${unredeemedCount}` : ""}
              </Badge>
            )}
          </Flex>
        </Flex>

        </Box>
        
      </Card>
    </Box>
  );
};