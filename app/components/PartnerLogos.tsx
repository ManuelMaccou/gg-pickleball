import { Grid, Box } from '@radix-ui/themes';
import Image from 'next/image';

const partners = [
  { name: 'goodr', image: '/partnerLogos/goodr.png' },
  { name: 'Court & Crew', image: '/partnerLogos/courtcrew.png' },
  { name: 'CRBN', image: '/partnerLogos/crbn-dark.png' },
  { name: 'Apres Pickle', image: '/partnerLogos/aprespickle.png' },
];

export const PartnerLogos = () => {
  return (
    <Grid
      columns={{ initial: '2', sm: '4' }} // 2 columns on mobile, 4 on larger screens
      gap={{ initial: '6', sm: '8' }}
      align="center"
      width="100%"
    >
      {partners.map((partner) => (
        <Box
          key={partner.name}
          // The parent must be relative and have a height for `fill` to work
          style={{ position: 'relative', height: '50px' }}
        >
          <Image
            src={partner.image}
            alt={`${partner.name} logo`}
            fill
            // 'contain' ensures the logo is never cropped or stretched
            style={{ objectFit: 'contain' }}
            // You can adjust sizes for different breakpoints for performance
            sizes="(max-width: 640px) 40vw, 20vw"
          />
        </Box>
      ))}
    </Grid>
  );
};