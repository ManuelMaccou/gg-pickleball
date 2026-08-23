// Modern reward card

import { motion } from "motion/react";
import { Badge, Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { LockKeyhole, Gift, ChevronRight } from "lucide-react";
import Image from 'next/image';
import { useState } from "react";
import { RewardWithContext } from '@/app/types/rewardTypes';
import { formatCurrency } from "@/lib/utils";
import { formatItemList, itemsLabel } from '@/lib/rewards/discountTargetSelection';

interface ModernRewardCardProps {
  reward: RewardWithContext;
  index: number;
  onClick: () => void;
}

const DEFAULT_CARD_BACKGROUND_IMAGE = '/rewardCardBackgrounds/defaultCardBackground.jpg';

// Total card height — now that the image fills the whole card rather than
// just a 200px top strip, the card needs an explicit height for that
// image to actually fill via position:absolute/inset:0. Roughly matches
// what the old 200px-image + auto-height-content layout already added up
// to. Adjust freely to taste.
const CARD_HEIGHT = 340;

export function ModernRewardCard({ reward, index, onClick }: ModernRewardCardProps) {
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

  const specificsText = (() => {
    if (reward.discountKind === 'bxgy' && reward.bxgy) {
      const buys = [
        ...(reward.bxgy.buys?.products ?? []),
        ...(reward.bxgy.buys?.collections ?? []),
      ].map((i: any) => i.title);
      const gets = [
        ...(reward.bxgy.gets?.products ?? []),
        ...(reward.bxgy.gets?.collections ?? []),
      ].map((i: any) => i.title);

      const buysLabel = itemsLabel(reward.bxgy.buys ?? {});
      const getsLabel = itemsLabel(reward.bxgy.gets ?? {});

      // 'or' connector, not the default 'and' — buys/gets are eligibility
      // pools ("any qualifying item from this set"), not a bundle you get
      // all of at once. Matches the admin preview and the detail view —
      // shared itemsLabel/formatItemList so these three can't drift apart
      // the way this wording did before.
      return (
        `Buy ${buysLabel}: ${formatItemList(buys, 2, 'or') || '?'} \n` +
        `Get ${getsLabel}: ${formatItemList(gets, 2, 'or') || '?'}`
      );
    }

    const targeting = reward.shopifyTargeting;
    if (!targeting || targeting.all) return null;

    const titles = [
      ...(targeting.products ?? []),
      ...(targeting.collections ?? []),
    ].map((i: any) => i.title);

    if (titles.length <= 1) return null;
    return formatItemList(titles, 2);
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={isUnlocked ? onClick : handleLockedClick}
      style={{
        position: 'relative',
        height: CARD_HEIGHT,
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
      {/* ── Full-card background image ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: reward.sponsoringClient?.cardBackgroundPosition || 'center',
        transition: 'transform 0.7s ease',
      }} className="card-bg-img" />

      {/* Darkening gradient across the WHOLE card now, not just the old
          200px strip — near-clear through the middle so the image is
          actually visible (the point of this change), stronger at the
          very top (logo contrast) and bottom (behind the CTA panel). */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.10) 25%, ' +
          'rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.88) 100%)',
      }} />

      {/* ── Overlay content: one column spanning the full card, so the
          reward-name block and the CTA panel below it move together as a
          unit — pinned to the bottom, with the logo pinned to the top and
          all leftover space (the pure-image area) forming as the gap
          between them. Fixes the reward-name block sitting up near the
          logo instead of just above the panel, which is what happened
          when these were two independently `top:0` / `bottom:0` blocks
          with no relationship to each other. ── */}
      <Flex direction="column" justify="between" style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        {/* Top: logo only */}
        <Flex justify="between" p="3">
          {reward.sponsoringClient?.logo && (
            <Box>
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

        {/* Bottom group: reward-name block stacked directly above the CTA
            panel, both anchored to the bottom together */}
        <Flex direction="column">
          <Flex direction="column" px="4" pb="3">
            <Text size="1" weight="bold" style={{
              color: textColor,
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

            {specificsText && (
              <Text mt="1" size="1" weight="medium" style={{
                color: 'rgba(255,255,255,0.8)',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                whiteSpace: 'pre-line',
              }}>
                {specificsText}
              </Text>
            )}

            {reward.minimumSpend && (
              <Text mt="4" size="2" weight="medium" style={{ color: textColor }}>
                With total purchase of {formatCurrency(reward.minimumSpend)} or more.
              </Text>
            )}
          </Flex>

          <Flex
            direction="column"
            gap="3"
            p="4"
            style={{
              backgroundColor: 'rgba(10,10,10,0.55)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
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
                    backgroundColor: 'rgba(163,230,53,0.12)',
                    border: '1px dashed rgba(163,230,53,0.35)',
                    borderRadius: '12px',
                    width: '100%',
                  }}
                >
                  <LockKeyhole size={13} style={{ color: 'rgba(163,230,53,0.8)', flexShrink: 0 }} />
                  <Text size="1" weight="medium" style={{ color: 'rgba(163,230,53,0.9)', lineHeight: 1.4 }}>
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
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  width: '100%',
                  border: '1px dashed rgba(255,255,255,0.2)',
                }}
              >
                <Flex align="center" gap="2">
                  <LockKeyhole size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <Text size="2" weight="medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Locked
                  </Text>
                </Flex>
                <Flex align="center" gap="1">
                  <Text size="1" style={{ color: 'rgba(255,255,255,0.45)' }}>How to unlock</Text>
                  <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.45)' }} />
                </Flex>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Flex>

      <style jsx>{`
        div:hover .card-bg-img { transform: scale(1.05); }
      `}</style>
    </motion.div>
  );
}