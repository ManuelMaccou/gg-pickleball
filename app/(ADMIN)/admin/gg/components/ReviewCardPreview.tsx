import { Box, Flex, Text } from "@radix-ui/themes";
import { StarFilledIcon } from "@radix-ui/react-icons";

interface RewardCardPreviewProps {
  backgroundImage?: string;
  textColor?: string;
  clientName: string;
}

export const RewardCardPreview = ({ backgroundImage, textColor = '#ffffff', clientName }: RewardCardPreviewProps) => {
  return (
    <Box
      style={{
        width: '100%',
        maxWidth: '300px',
        aspectRatio: '1.58 / 1',
        borderRadius: '16px',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#333',
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        color: textColor,
        transition: 'all 0.3s ease'
      }}
    >
      <Flex direction="column" justify="between" height="100%" p="4">
        {/* Top Row */}
        <Flex justify="between" align="start">
          <Text size="5" weight="bold" style={{ lineHeight: 1.1 }}>
            $20 Off
          </Text>
        </Flex>

        {/* Bottom Row */}
        <Flex direction="column">
          <Text size="2" style={{ opacity: 0.9 }}>Pro Shop Item</Text>
          <Text size="1" style={{ opacity: 0.7 }}>Earned via: 5 Wins</Text>
        </Flex>
      </Flex>
    </Box>
  );
};