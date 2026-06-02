'use client';

import {
  Container,
  Heading,
  Text,
  Box,
  Flex,
  Link as RadixLink,
  Separator,
  Table,
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
            <Text as="p" size="1" color="gray" mt="2">Last Updated: May 8, 2026</Text>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <Body>
              Gogh Group ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") operates the GG Pickleball platform, including the website at{' '}
              <RadixLink href="https://ggpickleball.co">https://ggpickleball.co</RadixLink> and any related mobile or web applications (collectively, the "<strong>Service</strong>"). This Privacy Policy explains how we collect, use, disclose, and protect information about you when you use the Service.
            </Body>
            <Body>
              GG Pickleball serves two types of users: <strong>Players</strong> — pickleball players who connect their DUPR account to earn rewards — and <strong>Merchants</strong> — Shopify store owners who install our app to issue rewards to players. Some sections apply to one group or the other; we note where that is the case.
            </Body>
            <Body mb="0">
              By accessing or using the Service, you acknowledge that you have read and understood this Privacy Policy. If you do not agree, please do not use the Service.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>I. Information We Collect</SectionHeading>

            <SubHeading>A. Players</SubHeading>
            <Body>When you create an account or use the Service as a player, we collect:</Body>
            <BulletList items={[
              'Email address and display name — provided when you register or log in',
              'DUPR OAuth tokens (access token and refresh token) — provided when you connect your DUPR account, stored to sync your match history on your behalf',
              'Match history and ratings — pulled from the DUPR API after you authorize the connection, including doubles and singles ratings, win/loss records, match timestamps, and achievement progress',
              'Guest session identifier — if you browse without a full account',
              'Browser type, device type, IP address, and pages visited — collected automatically via server logs and analytics',
            ]} />

            <SubHeading>B. Players Who Are Also Club Admins</SubHeading>
            <Body>If you connect a DUPR club to the Service in an administrative capacity, we additionally collect:</Body>
            <BulletList items={[
              'Your DUPR club memberships and Organizer/Director role information',
              'Match results you upload on behalf of club members',
              'Event details you create and publish through the platform',
            ]} />

            <SubHeading>C. Merchants</SubHeading>
            <Body>When a Shopify merchant installs the GG Pickleball app, we collect:</Body>
            <BulletList items={[
              "Shopify store domain and access token — obtained through Shopify's OAuth installation flow",
              'Order data accessed via the Shopify API — order ID, discount code applied, order total, and refund status — used solely to track reward redemptions and calculate commissions',
            ]} />
            <Body mb="0">
              We do not receive or store Shopify customer names, addresses, payment information, or any customer personal data beyond what is listed above.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>II. How We Use Your Information</SectionHeading>

            <SubHeading>Players</SubHeading>
            <BulletList items={[
              'Authenticate your identity and maintain your account session',
              'Sync your match history and calculate your reward eligibility',
              'Display your match history, statistics, and available rewards',
              'Send transactional communications related to your account',
            ]} />

            <SubHeading>Merchants</SubHeading>
            <BulletList items={[
              'Generate, issue, and track Shopify discount codes on your behalf',
              'Record which codes have been redeemed and flag returns or chargebacks for commission calculation',
              'Provide a dashboard showing player engagement, rewards issued, and redemption history',
            ]} />

            <SubHeading>All Users</SubHeading>
            <BulletList items={[
              'Analyze aggregate usage patterns to improve the Service',
              'Diagnose and fix bugs and performance issues',
              'Comply with applicable law, enforce our Terms of Service, and prevent fraud or abuse',
            ]} />
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>III. How We Share Your Information</SectionHeading>
            <Body>We do not sell your personal information. We share information only as described below.</Body>

            <SubHeading>A. Service Providers</SubHeading>
            <Body>
              We share information with third-party service providers who perform functions on our behalf and are contractually obligated to use your information only for those functions:
            </Body>
            <Box mb="4">
              <Table.Root variant="surface" size="1">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Provider</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Purpose</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Data Shared</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell><strong>Auth0</strong></Table.Cell>
                    <Table.Cell>Authentication &amp; identity management</Table.Cell>
                    <Table.Cell>Email, name, login events</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell><strong>DUPR</strong></Table.Cell>
                    <Table.Cell>Match history sync &amp; rating data</Table.Cell>
                    <Table.Cell>OAuth tokens, match data, ratings</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell><strong>Shopify</strong></Table.Cell>
                    <Table.Cell>Discount code creation &amp; order tracking</Table.Cell>
                    <Table.Cell>Merchant store token, order &amp; code data</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell><strong>Google Analytics</strong></Table.Cell>
                    <Table.Cell>Usage analytics</Table.Cell>
                    <Table.Cell>Anonymized usage data, IP address</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell><strong>Sentry</strong></Table.Cell>
                    <Table.Cell>Error monitoring &amp; crash reporting</Table.Cell>
                    <Table.Cell>Error context, device/browser info, user ID</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell><strong>Cloud infrastructure providers</strong></Table.Cell>
                    <Table.Cell>Hosting &amp; data storage</Table.Cell>
                    <Table.Cell>All application data (stored on your behalf)</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Root>
            </Box>

            <SubHeading>B. Merchants</SubHeading>
            <Body>
              We may share a player's email address with the merchant brand that issued them a reward, but only where the player has provided separate explicit consent to share their contact information with brand partners. Accepting this Privacy Policy alone does not constitute consent to email sharing. Merchants who receive player contact information are independently responsible for how they handle that data.
            </Body>

            <SubHeading>C. Legal Requirements</SubHeading>
            <Body>
              We may disclose information if required by law, subpoena, or other legal process, or if we believe in good faith that disclosure is necessary to protect the rights, property, or safety of our users, the public, or the Company.
            </Body>

            <SubHeading>D. Business Transfers</SubHeading>
            <Body mb="0">
              If the Company is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you if such a transfer occurs and your information becomes subject to a different privacy policy.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>IV. DUPR Integration</SectionHeading>
            <Body>
              When you connect your DUPR account as a player, we store OAuth access tokens and refresh tokens to sync your match history on your behalf. Access tokens have a 30-day TTL; refresh tokens have a 90-day TTL. If a refresh token expires, you must reconnect your DUPR account. You can disconnect your DUPR account at any time from your account settings, which will remove stored tokens.
            </Body>
            <Body mb="0">
              For club admins, we use your DUPR credentials to verify your Organizer or Director role and to submit match results to DUPR on behalf of your club members. We access only the DUPR API scopes required for these functions.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>V. Shopify-Specific Disclosures (Merchants)</SectionHeading>
            <Body>
              Our Shopify application accesses merchant store data through the Shopify API in accordance with Shopify's Partner Program Agreement and API Terms of Service:
            </Body>
            <BulletList items={[
              <><strong>Data accessed:</strong> Shopify access tokens, discount codes (create/read/update/delete), and order data (order ID, discount code applied, order total, refund status)</>,
              <><strong>Purpose:</strong> To generate unique discount codes for players, mark codes as redeemed when an order is placed, and identify returns or chargebacks for commission tracking</>,
              <><strong>Deletion:</strong> When a merchant uninstalls the app, we delete their Shopify access token within 48 hours. Other merchant data is retained for up to 12 months for commission and audit purposes, then deleted</>,
              <><strong>No resale:</strong> We do not sell or share Shopify merchant or customer data with any third party for their own marketing or commercial purposes</>,
            ]} />
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>VI. Data Retention</SectionHeading>
            <BulletList items={[
              <><strong>Player account data:</strong> Retained while your account is active. Deleted or anonymized within 30 days of an account deletion request</>,
              <><strong>DUPR OAuth tokens:</strong> Retained until you disconnect your DUPR account or your account is deleted. Refresh tokens expire after 90 days and are purged automatically</>,
              <><strong>Match history and statistics:</strong> Retained while your account is active. Upon deletion, match data is anonymized rather than deleted, as it may be needed for aggregate reporting</>,
              <><strong>Merchant Shopify tokens:</strong> Deleted within 48 hours of app uninstall. Other merchant data retained for up to 12 months for commission and audit purposes, then deleted</>,
              <><strong>Reward codes and redemption records:</strong> Retained for up to 18 months for financial reconciliation purposes</>,
              <><strong>Analytics and error data:</strong> Retained per Google Analytics and Sentry's default retention policies</>,
            ]} />
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>VII. Cookies and Tracking Technologies</SectionHeading>
            <Body>
              We use cookies to operate and improve the Service. You can instruct your browser to refuse cookies, but some features may not function properly without them.
            </Body>
            <BulletList items={[
              <><strong>lastLocation</strong> — persistent (30 days) — stores your most recently selected brand or data source so your preference is remembered across sessions</>,
              <><strong>Session cookies</strong> — set by our authentication provider to maintain your session; expire when you close your browser or log out</>,
            ]} />
            <Body mb="0">
              Third-party cookies may also be set by Google Analytics and other services described in Section III. We do not use cookies for cross-site advertising or to build advertising profiles.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>VIII. How We Protect Your Information</SectionHeading>
            <Body>
              We implement reasonable technical and organizational security measures to protect your information, including encryption of data in transit (TLS/HTTPS), encryption of sensitive credentials at rest, and access controls limiting which systems and personnel can access production data.
            </Body>
            <Body mb="0">
              No method of electronic transmission or storage is 100% secure. By using the Service, you acknowledge these inherent risks.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>IX. Your Privacy Rights</SectionHeading>

            <SubHeading>A. All Users</SubHeading>
            <BulletList items={[
              'Access the personal information we hold about you by contacting us',
              'Correct inaccurate information via your account settings or by contacting us',
              'Delete your account and associated data — we will fulfill requests within 30 days',
              'Disconnect your DUPR account at any time from your account settings',
              'Opt out of marketing emails at any time via the unsubscribe link in any marketing message',
            ]} />

            <SubHeading>B. California Residents (CCPA / CPRA)</SubHeading>
            <Body>If you are a California resident, you have the following additional rights:</Body>
            <BulletList items={[
              <><strong>Right to Know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you, the sources, the business purpose, and the categories of third parties with whom we share it</>,
              <><strong>Right to Delete:</strong> You may request deletion of personal information we have collected, subject to certain exceptions such as information needed to complete a transaction or comply with a legal obligation</>,
              <><strong>Right to Correct:</strong> You may request correction of inaccurate personal information</>,
              <><strong>Right to Opt Out of Sale or Sharing:</strong> We do not sell or share your personal information for cross-context behavioral advertising</>,
              <><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your privacy rights</>,
            ]} />
            <Body>
              To exercise any of these rights, contact us at{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink>. We will verify your identity before fulfilling the request and respond within 45 days. If additional time is needed, we will notify you before the initial 45-day period expires.
            </Body>

            <SubHeading>C. Merchants</SubHeading>
            <Body mb="0">
              Merchants may request deletion of all data associated with their store by contacting us or by uninstalling the app. For a full data deletion request, contact{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink> and we will process the request within 30 days.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>X. Children's Privacy</SectionHeading>
            <Body mb="0">
              The Service is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. If you believe we may have collected information from a child under 13, please contact us at{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink>.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>XI. Links to Third-Party Sites</SectionHeading>
            <Body mb="0">
              The Service may contain links to third-party websites including DUPR, Shopify, and brand partner sites. This Privacy Policy applies solely to information collected through the GG Pickleball Service. We encourage you to review the privacy policies of any third-party sites you visit.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="6">
            <SectionHeading>XII. Changes to This Privacy Policy</SectionHeading>
            <Body mb="0">
              We may update this Privacy Policy from time to time. When we do, we will revise the "Last Updated" date at the top of this page. For material changes, we will notify you by email or by posting a prominent notice on the Service at least 30 days before the change takes effect. Your continued use of the Service after the effective date constitutes your acceptance of the updated policy.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          <Box mb="4">
            <SectionHeading>XIII. Contact Us</SectionHeading>
            <Body>If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:</Body>
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

          <Box p="4" mt="4" style={{
            backgroundColor: '#fffbeb',
            borderRadius: 'var(--radius-3)',
            border: '1px solid #fde68a',
          }}>
            <Text size="1" style={{ color: '#92400e', lineHeight: 1.6 }}>
              <strong>Note for merchants:</strong> This Privacy Policy governs Gogh Group's use of data accessed through the GG Pickleball Shopify application. As a Shopify merchant, you remain independently responsible for your own privacy obligations to your customers. Our access to your store data is limited to the scopes described in Section V above.
            </Text>
          </Box>

        </Flex>
      </Container>
    </Box>
  );
}