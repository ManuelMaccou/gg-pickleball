import Image from 'next/image'
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import { Box, Flex } from '@radix-ui/themes'
import { HamburgerMenuIcon } from '@radix-ui/react-icons';

export default function TopBanner() {
  return (
    <Box>
      <Flex justify={"between"} direction={"row"} pt={"9"} pb={"5"} px={'6'}
        style={{
          backgroundColor: "#373737"
        }}
      >
        <Box>
          <Image
            src={lightGGLogo}
            alt="GG Pickleball dark logo"
            priority
            style={{
              width: 'auto',
              maxHeight: '50px',
            }}
          />
        </Box>
        <Box>
          <HamburgerMenuIcon width={"35px"} height={"35px"}
            style={{
              color: "#FFFFFF"
            }}
          />
        </Box>
      </Flex>
    </Box>
      

  );
}