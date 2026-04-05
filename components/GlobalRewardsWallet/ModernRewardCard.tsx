import { motion } from "motion/react";
import { Badge, Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { LockKeyhole, Gift } from "lucide-react";
import Image from 'next/image';
import { RewardWithContext } from '@/app/types/rewardTypes';
import { IDataSource } from '@/app/types/databaseTypes';

interface ModernRewardCardProps {
  reward: RewardWithContext;
  index: number;
  onClick: () => void;
  dataSource: IDataSource | null;
}

const DEFAULT_CARD_BACKGROUND_IMAGE = '/rewardCardBackgrounds/defaultCardBackground.jpg';

export function ModernRewardCard({ reward, index, onClick, dataSource }: ModernRewardCardProps) {
  
  // --- 1. DETERMINE STATE & COUNTS ---
  const unredeemedCodes = reward.codes?.filter(c => !c.redeemed) || [];
  const unredeemedCount = unredeemedCodes.length;
  const isUnlocked = unredeemedCount > 0;
  
  // --- 2. DETERMINE VISUALS ---
  const bgImage = reward.sponsoringClient?.cardBackgroundImage || DEFAULT_CARD_BACKGROUND_IMAGE;
  const textColor = reward.sponsoringClient?.cardTextColor || '#ffffff';
  const brandName = reward.sponsoringClient?.name || "Partner";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }} // Faster stagger
      onClick={() => {
        if (isUnlocked) {
          onClick();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: 'white',
        borderRadius: '20px', // Softer corners
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
        border: '1px solid var(--slate-4)',
        cursor: isUnlocked ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        // Apply grayscale if locked, just like your old card
        filter: isUnlocked ? 'none' : 'grayscale(100%)',
        opacity: isUnlocked ? 1 : 0.85
      }}
      // Radix hover styles for the "lift" effect
      onMouseEnter={(e) => {
        // FIX: Only apply the hover lift effect if it's unlocked
        if (isUnlocked) {
          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-4px)';
        }
      }}
      onMouseLeave={(e) => {
        if (isUnlocked) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* --- TOP IMAGE / GRAPHIC AREA --- */}
      <Box style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
        
        {/* Background Image */}
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'transform 0.7s ease',
        }} className="card-bg-img" />

        {/* Gradient Overlay for Text Readability */}
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            // Use a dark gradient to ensure white text pops
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)', 
        }} />

        {/* --- DUAL LOGOS (From your old code) --- */}
        <Flex position="absolute" top="0" left="0" right="0" justify="between" p="3" style={{zIndex: '10'}}>
            {reward.sponsoringClient?.logo && (
              <Box style={{ backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px', borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
                <Image
                    src={reward.sponsoringClient.logo}
                    alt={`${brandName} logo`}
                    height={32}
                    width={32}
                    style={{ objectFit: 'contain' }}
                />
              </Box>
            )}
            
            <Box style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
              <Image
                  src={dataSource?.logo ?? '/logos/gg-rewards_white.png'}
                  alt={`${dataSource?.name || 'GG'} logo`}
                  height={32}
                  width={32}
                  style={{ objectFit: 'contain' }}
              />
            </Box>
        </Flex>

        {/* --- REWARD NAME (Overlayed on image) --- */}
        <Flex position="absolute" bottom="0" left="0" right="0" direction="column" p="4" style={{zIndex: '10'}}>
          <Text size="1" weight="bold" style={{ color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            {brandName}
          </Text>
          <Heading size="5" style={{ color: textColor, textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)', lineHeight: 1.1 }}>
            {reward.friendlyName || reward.name}
          </Heading>
        </Flex>
      </Box>
      
      {/* --- BOTTOM CONTENT / ACTION AREA --- */}
      <Flex direction="column" p="4" flexGrow="1" style={{ backgroundColor: 'white' }}>
        
        {/* Product Type (From your old code) */}
        {reward.product !== 'custom' && (
           <Text size="2" color="gray" mb="3" weight="medium" style={{ textTransform: 'capitalize' }}>
             {reward.product}
           </Text>
        )}

        {/* Task Requirement */}
        <Text size="2" style={{ color: 'var(--slate-11)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
          {reward.achievementFriendlyName || "Complete a challenge to unlock."}
        </Text>
        
        {/* Footer / Action Button */}
        <Box mt="auto" pt="4">
          {isUnlocked ? (
            <Button size="3" style={{ width: '100%', backgroundColor: 'var(--lime-9)', color: 'var(--slate-12)', fontWeight: 'bold', borderRadius: '12px' }}>
              <Gift size={18} style={{ marginRight: '8px' }} />
              Claim Reward {unredeemedCount > 1 ? ` (x${unredeemedCount})` : ""}
            </Button>
          ) : (
            <Flex align="center" justify="center" p="2" style={{ backgroundColor: 'var(--slate-2)', borderRadius: '12px', width: '100%', border: '1px dashed var(--slate-5)' }}>
               <LockKeyhole size={14} style={{ color: 'var(--slate-9)', marginRight: '6px' }} />
               <Text size="2" weight="medium" style={{ color: 'var(--slate-9)' }}>
                  Locked
               </Text>
            </Flex>
          )}
        </Box>
      </Flex>
      
      {/* Add subtle zoom on hover to the background image */}
      <style jsx>{`
        div:hover .card-bg-img { transform: scale(1.05); }
      `}</style>
    </motion.div>
  );
}