import { Flex, Text, IconButton, VisuallyHidden, Strong, Button, Link, Box } from '@radix-ui/themes';
import { RewardWithContext } from '@/app/types/rewardTypes';
import Image from 'next/image';
import '../GlobalRewardsWallet/wallet.css';
import { Cross2Icon } from '@radix-ui/react-icons';
import { CSSProperties } from 'react';
import { formatCurrency } from '@/lib/utils';

type Props = {
  reward: RewardWithContext;
  onClose: () => void;
  style?: CSSProperties;
};

export const RewardDetailView = ({ reward, onClose, style }: Props) => {
  // ── Logic unchanged ──
  const isUnlocked = (reward.codes?.filter(c => !c.redeemed).length ?? 0) > 0;
  const location = reward.sponsoringClient;
  const rewardCode = reward.codes?.find(c => !c.redeemed)?.code;

  return (
    <Flex
      direction="column"
      gap="4"
      p="5"
      className="reward-detail-view"
      style={{
        backgroundColor: '#111',
        ...style,
      }}
    >
      {/* Close button — className preserved for wallet.css */}
      <IconButton
        className="reward-detail-close-btn"
        variant="ghost"
        color="gray"
        onClick={onClose}
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        <Cross2Icon width="24" height="24" />
      </IconButton>

      {isUnlocked ? (
        <Flex direction="column" gap="3">
          <VisuallyHidden>
            <Text size="6">Your reward details</Text>
          </VisuallyHidden>

          {/* Brand logo */}
          <Flex direction="column" align="center" gap="2">
            <Flex
              direction="column"
              align="center"
              position="relative"
              style={{ height: '80px', width: '130px' }}
            >
              <Image
                src={location.logo}
                alt={location.name ?? 'Location logo'}
                fill
                priority
                style={{ objectFit: 'contain' }}
              />
            </Flex>

            {reward.product !== 'custom' && (
              <Text
                align="center"
                size="1"
                weight="bold"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#84cc16',
                }}
              >
                {reward.product}
              </Text>
            )}
          </Flex>

          {/* Reward name */}
          <Text
            size="7"
            weight="bold"
            align="center"
            style={{
              textTransform: 'uppercase',
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {reward.friendlyName}
          </Text>

          {/* Product description — condition unchanged */}
          {reward.productDescription && (
            <Text align="center" size="2" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {reward.productDescription}
            </Text>
          )}

          {/* Spend/discount conditions — logic unchanged */}
          {reward.minimumSpend && reward.product === 'online store' ? (
            <Text align="center" size="2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              With total purchase of {formatCurrency(reward.minimumSpend)} or more.
            </Text>
          ) : reward.maxDiscount && reward.product === 'online store' ? (
            <Text align="center" size="2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Max discount amount: ${reward.maxDiscount}
            </Text>
          ) : null}

          {/* Redemption section */}
          <Flex direction="column" mt="4" gap="3">
            <Text size="2" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              <Strong style={{ color: 'rgba(255,255,255,0.85)' }}>To redeem: </Strong>
              Visit the website below to start shopping. The discount code is automatically applied.
            </Text>

            {/* CTA — href unchanged */}
            <Link
              href={`https://${reward?.sponsoringClient?.shopify?.shopDomain}/discount/${rewardCode}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block' }}
            >
              <Button
                size="3"
                radius="full"
                style={{
                  width: '100%',
                  backgroundColor: '#a3e635',
                  color: '#0a0a0a',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(163,230,53,0.2)',
                }}
              >
                Start shopping
              </Button>
            </Link>

            {/* Discount code display */}
            <Box
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1.5px dashed rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text size="2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Discount code
              </Text>
              <Text
                size="3"
                weight="bold"
                style={{
                  color: '#a3e635',
                  fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                }}
              >
                {rewardCode ?? 'Unavailable'}
              </Text>
            </Box>
          </Flex>
        </Flex>
      ) : (
        /* Locked state — logic unchanged */
        <Flex direction="column" gap="3" pt="2">
          <Text size="5" weight="bold" style={{ color: '#fff' }}>
            How to Unlock
          </Text>
          <Text size="3" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
            To activate this reward, you need to earn the{' '}
            <Strong style={{ color: '#fff' }}>{reward.achievementFriendlyName}</Strong> achievement.
          </Text>
          <Text size="2" style={{ color: 'rgba(255,255,255,0.35)' }} mt="1">
            Task: {reward.achievementTask}
          </Text>
        </Flex>
      )}
    </Flex>
  );
};