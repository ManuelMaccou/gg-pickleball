'use client';

import {
  Container,
  Heading,
  Text,
  Box,
  Flex,
  Link as RadixLink,
  Separator,
} from '@radix-ui/themes';
import Link from 'next/link';

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <Heading size="5" mb="3" mt="2" style={{ color: 'var(--slate-12)' }}>
    {children}
  </Heading>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <Heading as="h3" size="3" mb="2" mt="4" style={{ color: 'var(--slate-12)' }}>
    {children}
  </Heading>
);

const Body = ({ children, mb }: { children: React.ReactNode; mb?: string }) => (
  <Text as="p" size="2" mb={mb ?? '3'} style={{ color: 'var(--slate-11)', lineHeight: 1.75 }}>
    {children}
  </Text>
);

const BulletList = ({ items }: { items: (string | React.ReactNode)[] }) => (
  <Box mb="3" pl="4">
    {items.map((item, i) => (
      <Flex key={i} gap="2" mb="2" align="start">
        <Text size="2" style={{ color: 'var(--slate-9)', flexShrink: 0, marginTop: 2 }}>•</Text>
        <Text as="p" size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.7 }}>{item}</Text>
      </Flex>
    ))}
  </Box>
);

export default function PrivacyPolicyPage() {
  return (
    <Box style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      <Container size="3" py="9" px="5">
        <Flex direction="column" gap="2">

          <Box mb="4">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Text size="2" color="gray" style={{ cursor: 'pointer', display: 'block', marginBottom: 16 }}>
                ← Back to GG Pickleball
              </Text>
            </Link>
            <Heading size="9" mb="2" style={{ letterSpacing: '-0.02em' }}>Privacy Policy</Heading>
            <Text size="3" color="gray">
              Gogh Group — operating GG Pickleball at{' '}
              <RadixLink href="https://ggpickleball.co">ggpickleball.co</RadixLink>
            </Text>
            <Text as="p" size="1" color="gray" mt="2">Last Updated: July 29, 2026</Text>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <Body>
              Gogh Group ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") is committed to maintaining robust privacy protections for its users. This Privacy Policy is designed to help you understand how we collect, use, and safeguard information when you use GG Pickleball, and to help you make informed decisions when using our Service.
            </Body>
            <Body>
              "<strong>Site</strong>" refers to our website at ggpickleball.co and any related web or mobile applications. "<strong>Service</strong>" refers to the services accessed via the Site, through which pickleball <strong>Players</strong> earn rewards based on tournament results, <strong>Tournament Organizers</strong> share match data with us, and <strong>Merchants</strong> issue rewards through their Shopify store. "We," "us," and "our" refer to Gogh Group. "You" refers to you, as a user of the Site or Service.
            </Body>
            <Body mb="0">
              By accessing or using the Service, you accept this Privacy Policy. If you do not agree, please do not use the Service.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>I. Information We Collect</SectionHeading>
            <Body>
              We collect "Non-Personal Information" — data that can't identify you, such as browser type, device type, and general usage patterns — and "Personal Information," which depends on how you use the Service:
            </Body>
            <BulletList items={[
              <><strong>Players:</strong> your name, email address, and DUPR ID — typically provided to us by a tournament organizer once you've played in a partnered event, rather than submitted by you directly. If you connect your DUPR account, we also use a short-lived access token to verify your identity and retrieve your current DUPR rating for display</>,
              <><strong>Tournament Organizers:</strong> your name, title, club or organization, email address, and phone number, submitted when you request to partner with us</>,
              <><strong>Merchants:</strong> your Shopify store domain and access token, along with order and discount-code data used to track reward redemptions</>,
            ]} />

            <SubHeading>Cookies &amp; Technology</SubHeading>
            <Body mb="0">
              We use cookies and similar technology to operate the Service and understand how it's used — for example, to keep you logged in and remember your preferences. You can disable cookies in your browser, though some features may not work properly without them.
            </Body>

            <SubHeading>Children's Privacy</SubHeading>
            <Body>
              Tournament organizers who partner with us may include participants under the age of 13 in the rosters and match data they share with us. We do not create an account, issue rewards, or send communications to anyone we know to be under 13, and we do not retain their name, email, or date of birth. If we do receive any Personal Information from a participant under 13, we will delete it promptly upon discovery.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>II. How We Use and Share Information</SectionHeading>
            <Body>
              We do not sell your Personal Information. We use it to operate the Service — creating and maintaining your account, verifying your identity, calculating rewards, processing discount codes, and communicating with you. We share information with vendors who perform services on our behalf (such as authentication, hosting, and analytics providers), who may only use it as we direct.
            </Body>
            <Body>
              With your explicit, separate permission, we may share your contact information with our brand partners so they can offer you exclusive product updates and deals. We will not share your contact information with a brand partner unless you've specifically agreed to it, and you can withdraw that permission at any time.
            </Body>
            <Body>
              We may also disclose information if required by law, to protect the rights, property, or safety of our users or the public.
            </Body>
            <Body mb="0">
              If we're involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>III. How We Protect Information</SectionHeading>
            <Body mb="0">
              We implement security measures designed to protect your information from unauthorized access. Your account is protected by your account password and we urge you to take steps to keep your personal information safe by not disclosing your password and by logging out of your account after each use. We further protect your information from potential security breaches by implementing certain technological security measures including encryption, firewalls and secure socket layer technology. However, these measures do not guarantee that your information will not be accessed, disclosed, altered or destroyed by breach of such firewalls and secure server software. By using our Service, you acknowledge that you understand and agree to assume these risks.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>IV. Your Rights Regarding Your Information</SectionHeading>
            <Body mb="0">
              You can opt out of marketing emails at any time using the unsubscribe link in any promotional message. You may still receive administrative emails, such as updates to this Privacy Policy. To access, correct, or delete your information, contact us at{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink>.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>V. Links to Other Websites</SectionHeading>
            <Body mb="0">
              The Service may link to or connect with other websites, including DUPR, Shopify, and tournament organizers' own registration pages. We aren't responsible for their privacy practices, and this Privacy Policy applies only to information collected through GG Pickleball.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>VI. Changes to This Privacy Policy</SectionHeading>
            <Body mb="0">
              We may update this Privacy Policy from time to time. We'll note significant changes by updating the date above or notifying you directly; such changes take effect 30 days after notice. Minor clarifications take effect immediately.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="4">
            <SectionHeading>VII. Contact Us</SectionHeading>
            <Body>If you have questions about this Privacy Policy, please contact us:</Body>
            <Box p="4" style={{
              backgroundColor: 'var(--slate-2)',
              borderRadius: 'var(--radius-3)',
              border: '1px solid var(--slate-4)',
            }}>
              <Text as="p" size="2" weight="bold" mb="1" style={{ color: 'var(--slate-12)' }}>Gogh Group</Text>
              <Text as="p" size="2" style={{ color: 'var(--slate-11)' }}>Operating as GG Pickleball</Text>
              <Text as="p" size="2" style={{ color: 'var(--slate-11)' }} mt="2">
                Email: <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink>
              </Text>
              <Text as="p" size="2" style={{ color: 'var(--slate-11)' }}>
                Website: <RadixLink href="https://ggpickleball.co">https://ggpickleball.co</RadixLink>
              </Text>
            </Box>
          </Box>

        </Flex>
      </Container>
    </Box>
  );
}