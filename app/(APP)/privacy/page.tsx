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
  <Text
    as="p"
    size="2"
    mb={mb ?? '3'}
    style={{ color: 'var(--slate-11)', lineHeight: 1.75 }}
  >
    {children}
  </Text>
);

const BulletList = ({ items }: { items: (string | React.ReactNode)[] }) => (
  <Box mb="3" pl="4">
    {items.map((item, i) => (
      <Flex key={i} gap="2" mb="2" align="start">
        <Text size="2" style={{ color: 'var(--slate-9)', flexShrink: 0, marginTop: 2 }}>
          •
        </Text>
        <Text as="p" size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.7 }}>
          {item}
        </Text>
      </Flex>
    ))}
  </Box>
);

export default function PrivacyPolicyPage() {
  return (
    <Box style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      <Container size="3" py="9" px="5">
        <Flex direction="column" gap="2">

          {/* ── Header ── */}
          <Box mb="4">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Text size="2" color="gray" style={{ cursor: 'pointer', display: 'block', marginBottom: 16 }}>
                ← Back to GG Pickleball
              </Text>
            </Link>
            <Heading size="9" mb="2" style={{ letterSpacing: '-0.02em' }}>
              Privacy Policy
            </Heading>
            <Text size="3" color="gray">
              Gogh Group — operating GG Pickleball at{' '}
              <RadixLink href="https://ggpickleball.co">ggpickleball.co</RadixLink>
            </Text>
            <Text as="p" size="1" color="gray" mt="2">
              Last Updated: May 8, 2026
            </Text>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── Intro ── */}
          <Box mb="6">
            <Body>
              Gogh Group ("<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") operates the GG Pickleball platform, including the website at{' '}
              <RadixLink href="https://ggpickleball.co">https://ggpickleball.co</RadixLink> and any related
              mobile or web applications (collectively, the "<strong>Service</strong>"). This Privacy Policy
              explains how we collect, use, disclose, and protect information about you when you use the Service,
              and describes your rights regarding that information.
            </Body>
            <Body>
              GG Pickleball serves two distinct types of users: (1) <strong>Players</strong> — pickleball players
              who connect their DUPR account to earn rewards, and (2) <strong>Merchants</strong> — Shopify store
              owners who install our Shopify application to issue discount codes and rewards to players. Different
              provisions of this Policy may apply differently to each group; we note where that is the case.
            </Body>
            <Body mb="0">
              By accessing or using the Service, you acknowledge that you have read and understood this Privacy
              Policy. If you do not agree with the practices described here, please do not use the Service.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── I. Information We Collect ── */}
          <Box mb="6">
            <SectionHeading>I. Information We Collect</SectionHeading>

            <SubHeading>A. Information Players Provide Directly</SubHeading>
            <BulletList items={[
              'Email address and display name (collected via Auth0 at account registration)',
              'DUPR credentials and OAuth tokens (access token, refresh token) provided when you connect your DUPR account — stored securely to sync your match history on your behalf',
              'Guest session identifier if you browse without creating a full account',
            ]} />

            <SubHeading>B. Information Collected Automatically from Players</SubHeading>
            <BulletList items={[
              'DUPR match history and ratings (doubles and singles ratings, provisional status, career highs) — pulled via the DUPR API after you authorize the connection',
              'Match statistics: wins, losses, points earned, match timestamps, and achievement progress',
              'DUPR club memberships and any DUPR Organizer/Director roles associated with your account',
              'Browser type, device type, referring URL, IP address, and pages visited — collected via cookies and server logs',
              <>
                A <code>lastLocation</code> cookie storing your most recently selected brand/data-source
                preference (30-day persistent cookie)
              </>,
              'Analytics data via Google Analytics or a similar analytics service (see Section IV)',
              'Error and crash data via Sentry (see Section IV)',
            ]} />

            <SubHeading>C. Information Merchants Provide Directly</SubHeading>
            <Body>
              When a Shopify merchant installs the GG Pickleball app from the Shopify App Store, we collect
              and receive:
            </Body>
            <BulletList items={[
              "Shopify store domain, shop name, and Shopify access token (obtained through Shopify's OAuth flow)",
              'Admin account name and email address of the person who installs the app',
              'Store configuration data needed to generate and track discount codes',
            ]} />

            <SubHeading>D. Shopify Customer and Order Data (Merchants)</SubHeading>
            <Body>
              Through the Shopify API, we access the following data from merchant stores solely to operate
              the rewards and commission-tracking features of the Service:
            </Body>
            <BulletList items={[
              'Discount codes — created, issued, and updated by our Service in your store',
              'Order data — to detect when a GG Pickleball discount code has been redeemed, including order ID, discount code used, order total, and order status',
              'Refund and chargeback data — to adjust commission calculations when a sale is reversed',
            ]} />
            <Body>
              We access only the Shopify API scopes required for these functions. We do not access or store
              Shopify customer names, addresses, payment information, or other personal details beyond what
              is listed above.
            </Body>

            <SubHeading>E. Communications</SubHeading>
            <Body mb="0">
              If you contact us by email or through our support channels, we retain the content of
              your communications and our responses to assist with future requests.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── II. How We Use Information ── */}
          <Box mb="6">
            <SectionHeading>II. How We Use Your Information</SectionHeading>

            <SubHeading>A. To Operate and Deliver the Service</SubHeading>
            <BulletList items={[
              'Authenticate your identity and maintain your account session',
              'Sync your DUPR match history and calculate your reward eligibility',
              'Display your match history, statistics, and available rewards',
              'Generate, issue, and track Shopify discount codes on behalf of merchants',
              'Record which codes have been redeemed and flag returns or chargebacks for commission purposes',
              'Show merchants a dashboard of player engagement, rewards issued, and redemption status',
            ]} />

            <SubHeading>B. To Improve the Service</SubHeading>
            <BulletList items={[
              'Analyze aggregate usage patterns to understand how the Service is used',
              'Diagnose and fix bugs, errors, and performance issues using error-tracking data',
              'Develop new features and improve existing functionality',
            ]} />

            <SubHeading>C. To Communicate with You</SubHeading>
            <BulletList items={[
              'Send transactional emails related to your account (e.g., password reset, reward notifications)',
              'Respond to support requests and inquiries',
              'Send product updates or promotional communications — you may opt out of marketing emails at any time using the unsubscribe link in any such message',
            ]} />

            <SubHeading>D. Legal and Safety Purposes</SubHeading>
            <BulletList items={[
              'Comply with applicable law or legal process',
              'Enforce our Terms of Service',
              'Prevent fraud, abuse, or harm to users or third parties',
            ]} />
          </Box>

          <Separator size="4" mb="6" />

          {/* ── III. How We Share Information ── */}
          <Box mb="6">
            <SectionHeading>III. How We Share Your Information</SectionHeading>
            <Body>
              We do not sell your personal information. We share information only as described below.
            </Body>

            <SubHeading>A. Service Providers</SubHeading>
            <Body>
              We share information with third-party service providers who perform functions on our behalf.
              These providers are contractually obligated to use your information only to perform services
              for us and in a manner consistent with this Privacy Policy:
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
                    <Table.Cell><strong>Email provider</strong></Table.Cell>
                    <Table.Cell>Transactional &amp; marketing email delivery</Table.Cell>
                    <Table.Cell>Email address, name</Table.Cell>
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
                    <Table.Cell><strong>MongoDB Atlas</strong></Table.Cell>
                    <Table.Cell>Database hosting</Table.Cell>
                    <Table.Cell>All user and merchant application data</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Root>
            </Box>

            <SubHeading>B. Merchants and Players</SubHeading>
            <Body>
              When a player earns a reward from a merchant brand, we share the player's name, email address,
              and the discount code issued with the relevant merchant solely for the purpose of fulfilling
              the reward and tracking redemption. Merchants are independently responsible for the handling
              of any player data they receive.
            </Body>

            <SubHeading>C. Legal Requirements</SubHeading>
            <Body>
              We may disclose information if required by law, subpoena, or other legal process, or if we
              believe in good faith that disclosure is necessary to protect the rights, property, or safety
              of our users, the public, or the Company.
            </Body>

            <SubHeading>D. Business Transfers</SubHeading>
            <Body mb="0">
              If the Company is involved in a merger, acquisition, financing, or sale of all or a portion
              of its assets, your information may be transferred as part of that transaction. We will notify
              you via email or prominent notice on the Service if such a transfer occurs and your information
              will be subject to a different privacy policy.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── IV. Third-Party Services ── */}
          <Box mb="6">
            <SectionHeading>IV. Third-Party Services and Shopify-Specific Disclosures</SectionHeading>

            <SubHeading>A. Shopify Merchant Data</SubHeading>
            <Body>
              Our Shopify application accesses merchant store data through the Shopify API in accordance
              with Shopify's Partner Program Agreement and API Terms of Service. Specifically:
            </Body>
            <BulletList items={[
              <>
                <strong>Data accessed:</strong> Shopify access tokens, discount codes (create/read/update/delete),
                and order data (order ID, discount code applied, order total, refund status)
              </>,
              <>
                <strong>Purpose:</strong> To generate unique discount codes for players, mark codes as redeemed
                when an order is placed, and identify returns or chargebacks for commission tracking
              </>,
              <>
                <strong>Storage:</strong> Shopify access tokens are encrypted at rest in our database.
                Order data is retained only as long as needed for commission reconciliation purposes
              </>,
              <>
                <strong>Deletion:</strong> When a merchant uninstalls the app, we delete or anonymize
                their Shopify access token within 48 hours. Aggregated or anonymized order statistics
                may be retained for reporting purposes
              </>,
              <>
                <strong>No resale:</strong> We do not sell or share Shopify merchant or customer data
                with any third party for their own marketing or commercial purposes
              </>,
            ]} />

            <SubHeading>B. DUPR Integration</SubHeading>
            <Body>
              When a player connects their DUPR account, we store OAuth access tokens and refresh tokens
              to sync match history on their behalf. Access tokens have a 30-day TTL; refresh tokens have
              a 90-day TTL. If a refresh token expires, the player must reconnect their DUPR account.
              Players can disconnect their DUPR account at any time from their account settings, which
              will remove stored tokens.
            </Body>

            <SubHeading>C. Google Analytics</SubHeading>
            <Body>
              We use Google Analytics to understand how users interact with the Service. Google Analytics
              collects information such as how often you visit, what pages you view, and what site you
              visited before ours. We use this data only to improve the Service. Google's ability to use
              and share information collected by Google Analytics is governed by the{' '}
              <RadixLink href="https://policies.google.com/technologies/partner-sites" target="_blank">
                Google Analytics Terms of Service
              </RadixLink>{' '}
              and{' '}
              <RadixLink href="https://policies.google.com/privacy" target="_blank">
                Google Privacy Policy
              </RadixLink>
              . You can opt out of Google Analytics by installing the{' '}
              <RadixLink href="https://tools.google.com/dlpage/gaoptout" target="_blank">
                Google Analytics Opt-Out Browser Add-on
              </RadixLink>
              .
            </Body>

            <SubHeading>D. Sentry</SubHeading>
            <Body mb="0">
              We use Sentry to monitor application errors and performance issues. Sentry may collect your
              user ID, browser and device information, and the context surrounding an error event. This
              data is used solely to diagnose and fix problems with the Service. Sentry's privacy practices
              are described in the{' '}
              <RadixLink href="https://sentry.io/privacy/" target="_blank">
                Sentry Privacy Policy
              </RadixLink>
              .
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── V. Data Retention ── */}
          <Box mb="6">
            <SectionHeading>V. Data Retention</SectionHeading>
            <Body>
              We retain your information for as long as your account is active or as needed to provide
              the Service. Specific retention periods by data type:
            </Body>
            <BulletList items={[
              <>
                <strong>Player account data:</strong> Retained while your account is active. Deleted or
                anonymized within 30 days of an account deletion request
              </>,
              <>
                <strong>DUPR OAuth tokens:</strong> Retained until you disconnect your DUPR account or
                your account is deleted. Refresh tokens expire after 90 days and are purged automatically
              </>,
              <>
                <strong>Match history and statistics:</strong> Retained while your account is active.
                Upon deletion, match data is anonymized (player identifiers removed) rather than deleted,
                as it may be needed for aggregate reporting
              </>,
              <>
                <strong>Merchant Shopify tokens:</strong> Deleted or encrypted within 48 hours of app
                uninstall. Other merchant data retained for up to 12 months for commission and
                audit-trail purposes, then deleted
              </>,
              <>
                <strong>Reward codes and redemption records:</strong> Retained for up to 36 months for
                financial reconciliation and fraud prevention purposes
              </>,
              <>
                <strong>Analytics and error data:</strong> Retained per Google Analytics and Sentry's
                respective default retention policies (typically 14–26 months)
              </>,
            ]} />
          </Box>

          <Separator size="4" mb="6" />

          {/* ── VI. Cookies ── */}
          <Box mb="6">
            <SectionHeading>VI. Cookies and Tracking Technologies</SectionHeading>
            <Body>
              We use cookies and similar tracking technologies to operate and improve the Service.
              You can instruct your browser to refuse all cookies or to indicate when a cookie is being
              sent. However, some features of the Service may not function properly without cookies.
            </Body>
            <Body>Cookies we set directly include:</Body>
            <BulletList items={[
              <>
                <strong>lastLocation</strong> — persistent (30 days) — stores your most recently selected
                brand or data source so your preference is remembered across sessions
              </>,
              <>
                <strong>Session cookies</strong> — set by Auth0 to maintain your authenticated session;
                expire when you close your browser or log out
              </>,
            ]} />
            <Body mb="0">
              Third-party cookies may also be set by Google Analytics and other services described in
              Section IV. We do not use cookies for cross-site advertising or to build advertising profiles.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── VII. Data Security ── */}
          <Box mb="6">
            <SectionHeading>VII. How We Protect Your Information</SectionHeading>
            <Body>
              We implement technical and organizational security measures designed to protect your information
              from unauthorized access, disclosure, alteration, or destruction, including:
            </Body>
            <BulletList items={[
              'Encryption of data in transit using TLS/HTTPS',
              'Encryption of sensitive credentials (OAuth tokens, API keys) at rest in our database',
              'Access controls limiting which personnel and systems can access production data',
              'Error monitoring and alerting via Sentry to detect and respond to security incidents',
              'Regular review of third-party integrations and their security practices',
            ]} />
            <Body mb="0">
              No method of electronic transmission or storage is 100% secure. While we strive to use
              commercially acceptable means to protect your information, we cannot guarantee absolute
              security. By using the Service, you acknowledge and accept these inherent risks.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── VIII. Your Rights ── */}
          <Box mb="6">
            <SectionHeading>VIII. Your Privacy Rights</SectionHeading>

            <SubHeading>A. All Users</SubHeading>
            <Body>Regardless of where you are located, you may:</Body>
            <BulletList items={[
              'Access the personal information we hold about you by contacting us',
              'Correct inaccurate information in your account via your profile settings or by contacting us',
              'Delete your account and associated data by contacting us — we will fulfill requests within 30 days',
              'Disconnect your DUPR account at any time from your account settings',
              'Opt out of marketing emails at any time via the unsubscribe link in any marketing message',
            ]} />

            <SubHeading>B. California Residents (CCPA / CPRA)</SubHeading>
            <Body>
              If you are a California resident, you have the following rights under the California Consumer
              Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA):
            </Body>
            <BulletList items={[
              <>
                <strong>Right to Know:</strong> You may request a disclosure of the categories and specific
                pieces of personal information we have collected about you, the categories of sources, the
                business purpose for collecting it, and the categories of third parties with whom we share it
              </>,
              <>
                <strong>Right to Delete:</strong> You may request deletion of personal information we have
                collected about you, subject to certain exceptions (e.g., information needed to complete a
                transaction or comply with a legal obligation)
              </>,
              <>
                <strong>Right to Correct:</strong> You may request correction of inaccurate personal information
              </>,
              <>
                <strong>Right to Opt Out of Sale or Sharing:</strong> We do not sell or share your personal
                information for cross-context behavioral advertising. No opt-out is required, but you may
                contact us to confirm
              </>,
              <>
                <strong>Right to Limit Use of Sensitive Personal Information:</strong> We do not use sensitive
                personal information beyond what is necessary to provide the Service
              </>,
              <>
                <strong>Right to Non-Discrimination:</strong> We will not discriminate against you for
                exercising any of your privacy rights
              </>,
            ]} />
            <Body>
              To exercise any of these rights, please contact us at{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink>. We will
              verify your identity before fulfilling the request and will respond within 45 days as required
              by law (with the option to extend by an additional 45 days with notice).
            </Body>

            <SubHeading>C. Merchants — Data Deletion</SubHeading>
            <Body mb="0">
              Merchants may request deletion of all data associated with their store by contacting us or
              by uninstalling the app from the Shopify Admin. Upon uninstall, we delete your Shopify access
              token within 48 hours. For a full data deletion request, contact{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink> and we
              will process the request within 30 days.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── IX. Children ── */}
          <Box mb="6">
            <SectionHeading>IX. Children's Privacy</SectionHeading>
            <Body mb="0">
              The Service is not directed to children under the age of 13, and we do not knowingly collect
              personal information from children under 13. If we become aware that we have inadvertently
              collected personal information from a child under 13 without verifiable parental consent, we
              will delete such information promptly. If you believe we may have collected information from
              a child under 13, please contact us at{' '}
              <RadixLink href="mailto:play@ggpickleball.co">play@ggpickleball.co</RadixLink>.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── X. Third-Party Links ── */}
          <Box mb="6">
            <SectionHeading>X. Links to Third-Party Sites</SectionHeading>
            <Body mb="0">
              The Service may contain links to third-party websites, including DUPR, Shopify, and brand
              partner sites. We are not responsible for the privacy practices of those websites. This Privacy
              Policy applies solely to information collected through the GG Pickleball Service. We encourage
              you to review the privacy policies of any third-party sites you visit.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── XI. Changes ── */}
          <Box mb="6">
            <SectionHeading>XI. Changes to This Privacy Policy</SectionHeading>
            <Body mb="0">
              We may update this Privacy Policy from time to time. When we do, we will revise the
              "Last Updated" date at the top of this page. For material changes, we will notify you by
              email (sent to the address associated with your account) or by posting a prominent notice
              on the Service at least 30 days before the change takes effect. Your continued use of the
              Service after the effective date of any change constitutes your acceptance of the updated
              Privacy Policy.
            </Body>
          </Box>

          <Separator size="4" mb="6" />

          {/* ── XII. Contact ── */}
          <Box mb="4">
            <SectionHeading>XII. Contact Us</SectionHeading>
            <Body>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data
              practices, please contact us:
            </Body>
            <Box
              p="4"
              style={{
                backgroundColor: 'var(--slate-2)',
                borderRadius: 'var(--radius-3)',
                border: '1px solid var(--slate-4)',
              }}
            >
              <Text as="p" size="2" weight="bold" mb="1" style={{ color: 'var(--slate-12)' }}>
                Gogh Group
              </Text>
              <Text as="p" size="2" style={{ color: 'var(--slate-11)' }}>
                Operating as GG Pickleball
              </Text>
              <Text as="p" size="2" style={{ color: 'var(--slate-11)' }} mt="2">
                Email:{' '}
                <RadixLink href="mailto:play@ggpickleball.co">
                  play@ggpickleball.co
                </RadixLink>
              </Text>
              <Text as="p" size="2" style={{ color: 'var(--slate-11)' }}>
                Website:{' '}
                <RadixLink href="https://ggpickleball.co">
                  https://ggpickleball.co
                </RadixLink>
              </Text>
            </Box>
          </Box>

          {/* Footer note */}
          <Box
            p="4"
            mt="4"
            style={{
              backgroundColor: '#fffbeb',
              borderRadius: 'var(--radius-3)',
              border: '1px solid #fde68a',
            }}
          >
            <Text size="1" style={{ color: '#92400e', lineHeight: 1.6 }}>
              <strong>Note for merchants:</strong> This Privacy Policy governs Gogh Group's use of data
              accessed through the GG Pickleball Shopify application. As a Shopify merchant, you remain
              independently responsible for your own privacy obligations to your customers under applicable
              law and Shopify's policies. Our access to your store data is limited to the scopes described
              in Section I.D above.
            </Text>
          </Box>

        </Flex>
      </Container>
    </Box>
  );
}