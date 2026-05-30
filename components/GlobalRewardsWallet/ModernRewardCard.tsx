import { motion } from "motion/react";
import { Badge, Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { LockKeyhole, Gift, ChevronRight } from "lucide-react";
import Image from 'next/image';
import { useState } from "react";
import { RewardWithContext } from '@/app/types/rewardTypes';
import { IDataSource } from '@/app/types/databaseTypes';
import { formatCurrency } from "@/lib/utils";

interface ModernRewardCardProps {
  reward: RewardWithContext;
  index: number;
  onClick: () => void;
  dataSource: IDataSource | null;
}

const DEFAULT_CARD_BACKGROUND_IMAGE = '/rewardCardBackgrounds/defaultCardBackground.jpg';

export function ModernRewardCard({ reward, index, onClick, dataSource }: ModernRewardCardProps) {
  const [lockedTapped, setLockedTapped] = useState(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const unredeemedCodes = reward.codes?.filter(c => !c.redeemed) || [];
  const unredeemedCount = unredeemedCodes.length;
  const isUnlocked = unredeemedCount > 0;

  // ── Visuals ────────────────────────────────────────────────────────────────
  const bgImage = reward.sponsoringClient?.cardBackgroundImage || DEFAULT_CARD_BACKGROUND_IMAGE;
  const textColor = reward.sponsoringClient?.cardTextColor || '#ffffff';
  const brandName = reward.sponsoringClient?.name || 'Partner';

  // ── Locked card tap handler ────────────────────────────────────────────────
  // First tap on a locked card briefly shows what's needed to unlock.
  // Tapping again (or after the timeout) resets.
  const handleLockedClick = () => {
    setLockedTapped(true);
    setTimeout(() => setLockedTapped(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={isUnlocked ? onClick : handleLockedClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: 'black',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
        border: '1px solid var(--slate-11)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        filter: isUnlocked ? 'none' : 'grayscale(100%)',
        opacity: isUnlocked ? 1 : 0.85,
      }}
      onMouseEnter={(e) => {
        if (isUnlocked) {
          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-4px)';
        } else {
          // Subtle hint for locked cards that they're interactive
          e.currentTarget.style.opacity = '0.95';
        }
      }}
      onMouseLeave={(e) => {
        if (isUnlocked) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)';
          e.currentTarget.style.transform = 'translateY(0)';
        } else {
          e.currentTarget.style.opacity = '0.85';
        }
      }}
    >
      {/* ── Top image area ── */}
      <Box style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'transform 0.7s ease',
        }} className="card-bg-img" />

        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* Brand logo */}
        <Flex position="absolute" top="0" left="0" right="0" justify="between" p="3" style={{ zIndex: 10 }}>
          {reward.sponsoringClient?.logo && (
            <Box style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '4px',
              borderRadius: '8px',
              backdropFilter: 'blur(4px)',
            }}>
              <Image
                src={reward.sponsoringClient.logo}
                alt={`${brandName} logo`}
                height={50}
                width={50}
                style={{ objectFit: 'contain' }}
              />
            </Box>
          )}
        </Flex>

        {/* Reward name */}
        <Flex
          position="absolute"
          bottom="0"
          left="0"
          right="0"
          direction="column"
          p="4"
          style={{ zIndex: 10 }}
        >
          <Text size="1" weight="bold" style={{
            color: 'rgba(255,255,255,0.8)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 2,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            {brandName}
          </Text>
          <Heading size="5" style={{
            color: textColor,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            lineHeight: 1.1,
          }}>
            {reward.friendlyName || reward.name}
          </Heading>
          {reward.minimumSpend && (
            <Text mt="4" size="2" weight="medium" style={{ color: textColor }}>
              With total purchase of {formatCurrency(reward.minimumSpend)} or more.
            </Text>
          )}
        </Flex>
      </Box>

      {/* ── Bottom content ── */}
      <Flex direction="column" p="4" flexGrow="1" style={{ backgroundColor: '#1A1A1A' }}>
        {reward.product !== 'custom' && (
          <Text size="2" mb="3" weight="medium" style={{ textTransform: 'capitalize', color: '#ffffff' }}>
            {reward.product}
          </Text>
        )}

        <Text size="2" style={{
          color: '#ffffff',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.5,
        }}>
          {reward.achievementFriendlyName || 'Complete a challenge to unlock.'}
        </Text>

        {/* Footer / action */}
        <Box mt="auto" pt="4">
          {isUnlocked ? (
            <Button size="3" style={{
              width: '100%',
              backgroundColor: 'var(--lime-9)',
              color: 'var(--slate-12)',
              fontWeight: 'bold',
              borderRadius: '12px',
            }}>
              <Gift size={18} style={{ marginRight: 8 }} />
              Claim Reward{unredeemedCount > 1 ? ` (×${unredeemedCount})` : ''}
            </Button>
          ) : lockedTapped ? (
            // ── Tapped state: show what's needed to unlock ──
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Flex
                align="center"
                gap="2"
                p="3"
                style={{
                  backgroundColor: 'rgba(163,230,53,0.08)',
                  border: '1px dashed rgba(163,230,53,0.3)',
                  borderRadius: '12px',
                  width: '100%',
                }}
              >
                <LockKeyhole size={13} style={{ color: 'rgba(163,230,53,0.7)', flexShrink: 0 }} />
                <Text size="1" weight="medium" style={{ color: 'rgba(163,230,53,0.8)', lineHeight: 1.4 }}>
                  {reward.achievementTask
                    ? reward.achievementTask
                    : `Reach ${reward.achievementFriendlyName || 'this milestone'} to unlock`}
                </Text>
              </Flex>
            </motion.div>
          ) : (
            // ── Default locked state ──
            <Flex
              align="center"
              justify="between"
              p="2"
              px="3"
              style={{
                backgroundColor: 'var(--slate-2)',
                borderRadius: '12px',
                width: '100%',
                border: '1px dashed var(--slate-5)',
              }}
            >
              <Flex align="center" gap="2">
                <LockKeyhole size={14} style={{ color: 'var(--slate-9)' }} />
                <Text size="2" weight="medium" style={{ color: 'var(--slate-9)' }}>
                  Locked
                </Text>
              </Flex>
              <Flex align="center" gap="1">
                <Text size="1" style={{ color: 'var(--slate-7)' }}>How to unlock</Text>
                <ChevronRight size={12} style={{ color: 'var(--slate-7)' }} />
              </Flex>
            </Flex>
          )}
        </Box>
      </Flex>

      <style jsx>{`
        div:hover .card-bg-img { transform: scale(1.05); }
      `}</style>
    </motion.div>
  );
}