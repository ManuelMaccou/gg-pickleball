'use client';

import { Card, Flex, Heading, Text, Link as RadixLink, Separator, Grid, Box } from '@radix-ui/themes';
import NextLink from 'next/link';

export const MethodologyCard = () => {
  return (
    <Box style={{ width: '100%', maxWidth: '90%', margin: '0 auto', padding: '16px' }}>
      <Card size="3" variant="surface" style={{ marginTop: '24px', backgroundColor: 'var(--gray-1)' }}>
        <Flex direction="column" gap="5" p={'5'}>
          <Box>
            <Heading size="4" weight="bold" mb="2">Transparency & Methodology</Heading>
            <Text as="p" size="2" color="gray">
              We don't use "magic numbers." This calculator compares your potential performance on GG Pickleball against a standard Instagram/Facebook ad campaign using third-party industry benchmarks.
            </Text>
          </Box>
          
          <Separator size="4" />
          
          <Grid columns={{ initial: '1', md: '2' }} gap="6">
            {/* Column 1: Industry Benchmarks */}
            <Flex direction="column" gap="3">
              <Heading size="3" color="gray">Traditional Ad Benchmarks</Heading>
              
              <Box>
                <Text size="2" weight="bold">Ad CPA (Cost Per Acquisition): $40.00: </Text>
                <Text size="2" color="gray">
                  Calculated using an average <Text weight="bold">CPC of $0.80</Text> (Zapier) and a <Text weight="bold">Conversion Rate of 2.0%</Text> (Quimbly). 
                  <br />
                  <em>Formula: $0.80 CPC ÷ 2% Conv. Rate = $40.00 Cost Per Sale.</em>
                </Text>
                <Flex gap="2" mt="1">
                  <RadixLink asChild size="1"><NextLink href="https://zapier.com/blog/instagram-ads-cost/" target="_blank">Source 1</NextLink></RadixLink>
                  <RadixLink asChild size="1"><NextLink href="https://quimbydigital.com/instagram-advertising-costs-in-2025/" target="_blank">Source 2</NextLink></RadixLink>
                </Flex>
              </Box>

              <Box>
                <Text size="2" weight="bold">Repeat Customer Rate: 30% </Text>
                <Text size="2" color="gray">
                  We assume 30% of customers return for a second purchase, creating a Lifetime Value (LTV) multiplier of 1.3x. 
                </Text>
                <RadixLink asChild size="1" mt="1"><NextLink href="https://www.smartbugmedia.com/blog/repeat-customer-rate-for-e-commerce" target="_blank"> Source: SmartBug</NextLink></RadixLink>
              </Box>
            </Flex>

            {/* Column 2: GG Assumptions */}
            <Flex direction="column" gap="3">
              <Heading size="3" color="lime">GG Pickleball Assumptions</Heading>
              
              <Box>
                <Text size="2" weight="bold">Lead Conversion Rate: 10% </Text>
                <Text size="2" color="gray">
                  Unlike "cold traffic" from social media, GG leads are verified, active pickleball competitors. We estimate a conservative 10% conversion rate from qualified lead to paying customer.
                </Text>
              </Box>

              <Box>
                <Text size="2" weight="bold">Dynamic Cost Per Lead: </Text>
                <Text size="2" color="gray">
                  Your cost adjusts based on your product price (AOV) to ensure profitability.
                  <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'disc' }}>
                    <li>Under $15: <strong>$0.20</strong> CPL</li>
                    <li>$16 - $50: <strong>$0.75</strong> CPL</li>
                    <li>$51 - $100: <strong>$1.50+</strong> CPL</li>
                    <li>$100+: <strong>$2.25+</strong> CPL</li>
                  </ul>
                </Text>
              </Box>

              <Box>
                <Text size="2" weight="bold">Net Profit Calculation: </Text>
                <Text size="2" color="gray">
                  We assume a standard hard-goods gross margin of <strong>35%</strong>.
                  <br />
                  <em>Formula: (Revenue × 0.35) - Total Ad Spend.</em>
                </Text>
              </Box>
            </Flex>
          </Grid>
        </Flex>
      </Card>

    </Box>
    
  );
};