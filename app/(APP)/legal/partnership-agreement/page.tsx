'use client';

import Link from 'next/link';
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes';

const AGREEMENT_VERSION = '1.0';
const EFFECTIVE_DATE = 'May 18, 2026';

const isCustomApp = process.env.NEXT_PUBLIC_SHOPIFY_APP_MODE === 'custom';

export default function PartnershipAgreementPage() {
  return (
    <Box style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* Header */}
      <Box style={{ borderBottom: '1px solid var(--gray-4)', backgroundColor: '#ffffff' }}>
        <Container size="3" px="5">
          <Flex justify="between" align="center" py="4">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Text size="2" weight="bold" style={{ color: '#0a0a0a' }}>
                GG Pickleball
              </Text>
            </Link>
            <Text size="1" color="gray">
              Agreement Version {AGREEMENT_VERSION} — {EFFECTIVE_DATE}
            </Text>
          </Flex>
        </Container>
      </Box>

      <Container size="3" px="5" py="9">
        <Box style={{ maxWidth: 720 }}>

          {/* Title */}
          <Heading size="8" mb="2" style={{ letterSpacing: '-0.02em' }}>
            Brand Partner Agreement
          </Heading>
          <Text size="3" color="gray" style={{ display: 'block', marginBottom: 48 }}>
            Version {AGREEMENT_VERSION} — Effective {EFFECTIVE_DATE}
          </Text>

          <Text size="3" style={{ lineHeight: 1.75, display: 'block', marginBottom: 40 }}>
            This Brand Partner Agreement (the "Agreement") is entered into as of the date of
            digital acceptance (the "Effective Date") by and between{' '}
            <strong>Gogh Group Inc., a Delaware C-Corporation operating the GG Pickleball
            platform ("GG Pickleball")</strong>, and the company accepting this Agreement
            ("Brand Partner").
          </Text>

          <Text size="3" style={{ lineHeight: 1.75, display: 'block', marginBottom: 48 }}>
            By clicking "I Agree" or otherwise accepting this Agreement digitally, the Brand
            Partner agrees to be legally bound by all terms and conditions set forth herein.
            The individual accepting on behalf of the Brand Partner represents and warrants
            that they have the authority to bind the Brand Partner to this Agreement.
          </Text>

          {/* Section 1 */}
          <Section number="1" title="Parties & Definitions">
            <Para>For purposes of this Agreement, the following terms shall have the meanings set forth below:</Para>
            <DefList items={[
              ['"GG Pickleball"', 'means the rewards and commerce platform operated by Gogh Group Inc. that connects pickleball players with brand partners through promo code-based rewards tied to in-game achievements.'],
              ['"Platform"', 'means the GG Pickleball website, mobile application, and associated services.'],
              ['"Brand Partner"', 'means the company that has been approved by GG Pickleball and has accepted this Agreement.'],
              ['"Promo Code"', 'means a unique discount code issued by the Brand Partner and made available to players through the Platform.'],
              ['"Win Milestones"', 'means the DUPR-verified pickleball win thresholds at which players become eligible to receive Promo Codes. GG Pickleball may adjust milestone structures from time to time with reasonable notice to Brand Partners.'],
              ['"Order"', 'means a completed, paid transaction placed by a player at the Brand Partner\'s Shopify storefront using a Promo Code.'],
              ['"Net Order Value"', 'means the total value of an Order minus any amounts refunded to the customer.'],
              ['"Commission"', 'means the fee owed to GG Pickleball equal to 5% of the Net Order Value of each Order.'],
              ['"Go-Live Date"', 'means the date on which the Brand Partner\'s first Promo Code is made active and available to players on the Platform.'],
            ]} />
          </Section>

          {/* Section 2 */}
          <Section number="2" title="Onboarding & Eligibility">
            <SubSection title="2.1 Approval Required">
              <Para>Participation in the Platform is by invitation or application only. GG Pickleball reserves the right, in its sole discretion, to approve or reject any brand application and to revoke approval at any time for any reason consistent with this Agreement. Acceptance of this Agreement does not guarantee activation on the Platform.</Para>
            </SubSection>
            <SubSection title="2.2 Eligible Brand Partners">
              <Para>The Platform is open to brands that sell pickleball products, related sporting goods, health and wellness products, hydration and nutrition products, and other products and services relevant to the pickleball community. The following categories are expressly ineligible:</Para>
              <BulletList items={[
                'Direct competitors to GG Pickleball (platforms offering substantially similar pickleball rewards or commerce services);',
                'Gambling, sports betting, or fantasy sports operators;',
                'Tobacco, vaping, or related products;',
                'Adult content or services;',
                'Entities subject to applicable government sanctions or export restrictions; and',
                'Any brand that GG Pickleball, in its reasonable judgment, determines to be inconsistent with the values and standards of the pickleball community.',
              ]} />
            </SubSection>
            <SubSection title="2.3 Technical Setup">
              <Para>Prior to activation on the Platform, the Brand Partner must:</Para>
              <BulletList items={[
                'Connect their Shopify storefront to the Platform in accordance with GG Pickleball\'s onboarding instructions;',
                'Configure at least one active Promo Code within the Platform; and',
                isCustomApp
                  ? 'Complete billing setup through GG Pickleball\'s onboarding flow, which governs commission collection for platform activity.'
                  : 'Maintain an active subscription to the GG Pickleball app through Shopify, which governs billing for platform commissions.',
              ]} />
              <Para>The Brand Partner's account will not go live until all of the above requirements are satisfied.</Para>
            </SubSection>
            <SubSection title="2.4 Authorized Representative">
              <Para>The individual completing onboarding and accepting this Agreement must be an employee, officer, or authorized agent of the Brand Partner with authority to legally bind the Brand Partner to contractual obligations. By accepting this Agreement, that individual represents and warrants that such authority exists. The Brand Partner's legal company name, brand display name, and the accepting individual's title or role will be recorded as part of the acceptance record.</Para>
            </SubSection>
          </Section>

          {/* Section 3 */}
          <Section number="3" title="Promo Codes & Minimum Commitment">
            <SubSection title="3.1 Brand Partner Discretion">
              <Para>The Brand Partner retains full discretion over the discount amounts, terms, and conditions of its Promo Codes, subject to the requirements of this Agreement. The Brand Partner may choose which Win Milestones to attach Promo Codes to and is not required to cover all milestones.</Para>
            </SubSection>
            <SubSection title="3.2 Minimum Active Period">
              <Para>The Brand Partner agrees to maintain at least one active Promo Code on the Platform for a minimum period of three (3) months from the Go-Live Date (the "Minimum Commitment Period"). Deactivating, expiring, or removing all Promo Codes before the end of the Minimum Commitment Period constitutes a material breach of this Agreement.</Para>
            </SubSection>
            <SubSection title="3.3 Changes and Termination After Minimum Period">
              <Para>Following the Minimum Commitment Period, the Brand Partner may update, pause, or remove Promo Codes at any time.</Para>
            </SubSection>
            <SubSection title="3.4 Code Validity and Honoring Discounts">
              <Para>The Brand Partner is solely responsible for ensuring that all Promo Codes configured on the Platform are valid, functional, and honored at checkout on the Brand Partner's Shopify storefront. The Brand Partner must honor all Promo Codes redeemed by players who have legitimately earned the applicable Win Milestone, in accordance with the terms the Brand Partner has configured.</Para>
            </SubSection>
            <SubSection title="3.5 Win Milestone Adjustments">
              <Para>GG Pickleball may update Win Milestone structures (including milestone increments) from time to time. GG Pickleball will provide Brand Partners with at least fourteen (14) days' prior written notice of any such changes. Brand Partners will have fourteen (14) days following notice to review and update their Promo Code configurations if necessary.</Para>
            </SubSection>
          </Section>

          {/* Section 4 */}
          <Section number="4" title="Commission & Billing">
            <SubSection title="4.1 Commission Rate">
              <Para>GG Pickleball charges a Commission equal to five percent (5%) of the Net Order Value of each Order placed using a Promo Code. The Commission rate applicable to each Order is stored at the time the Order is recorded and governs that Order regardless of any subsequent rate changes.</Para>
            </SubSection>
            <SubSection title="4.2 Billing Cycle">
              {isCustomApp ? (
                <Para>Commissions are collected thirty (30) days after the Order date. Each Order generates a separate billing event thirty (30) days after the Order date, identifying the Order and the applicable commission amount. Commissions are collected automatically through GG Pickleball's billing system as part of the Brand Partner's account activity.</Para>
              ) : (
                <Para>Commissions are collected thirty (30) days after the Order date. Each Order generates a separate billing event submitted to Shopify thirty (30) days after the Order date, identifying the Order and the applicable commission amount. Shopify collects the Commission as part of the Brand Partner's app subscription billing cycle.</Para>
              )}
            </SubSection>
            <SubSection title="4.3 Returns, Refunds, and Disputes">
              <Para>The Commission owed on any Order is subject to adjustment based on the following rules, which are evaluated on day 30 after the Order date and, for held orders, every five (5) days thereafter until day 60:</Para>
              <BulletList items={[
                'If the Order has an open or in-progress return request, or a dispute under review by a payment processor, the Commission is placed on hold and re-evaluated in five (5) days.',
                'If a dispute is lost or accepted by the Brand Partner, the Commission is waived in full.',
                'If a dispute is won or prevented, processing continues under the standard rules.',
                'If the Order has been fully refunded, the Commission is waived and set to $0.',
                'If the Order has been partially refunded and no returns or disputes remain open, the Commission is charged on the Net Order Value (Order total minus refunded amount).',
                'If the return was unsuccessful or the Order is clean with no return or dispute, the full Commission is charged on the original Order total.',
              ]} />
            </SubSection>
            <SubSection title="4.4 Subscription Requirement">
              {isCustomApp ? (
                <Para>The Brand Partner must maintain an active billing relationship with GG Pickleball at all times while the account is active. If the billing relationship lapses or is suspended due to a payment issue, GG Pickleball may suspend the Brand Partner's account until the issue is resolved. GG Pickleball will notify the Brand Partner of billing issues through the Brand Partner's registered account email.</Para>
              ) : (
                <Para>The Brand Partner must maintain an active Shopify app subscription at all times while the account is active. If the subscription lapses, is cancelled, or is frozen due to a billing issue, GG Pickleball may suspend the Brand Partner's account until the subscription is restored. Shopify will notify the Brand Partner of billing issues through its standard merchant communications.</Para>
              )}
            </SubSection>
            <SubSection title="4.5 Commission Rate Changes">
              <Para>GG Pickleball may update the Commission rate applicable to future Orders upon sixty (60) days' prior written notice to the Brand Partner. If the Brand Partner does not accept the new rate, the Brand Partner may terminate this Agreement without penalty by providing written notice of termination before the new rate takes effect. Continued participation in the Platform after the new rate takes effect constitutes acceptance of the updated rate.</Para>
            </SubSection>
            <SubSection title="4.6 Billing Records">
              {isCustomApp ? (
                <Para>GG Pickleball maintains records of all billing events and Commission calculations. The Brand Partner may request a summary of billing activity by contacting GG Pickleball. GG Pickleball's billing records constitute the authoritative source for Commission calculations, absent manifest error.</Para>
              ) : (
                <Para>GG Pickleball maintains records of all billing events submitted to Shopify. The Brand Partner may request a summary of billing events by contacting GG Pickleball. GG Pickleball's billing records constitute the authoritative source for Commission calculations, absent manifest error. Shopify's billing statements serve as the authoritative record of charges actually collected.</Para>
              )}
            </SubSection>
          </Section>

          {/* Section 5 */}
          <Section number="5" title="Brand Partner Obligations">
            <Para>In addition to the obligations set forth elsewhere in this Agreement, the Brand Partner agrees to:</Para>
            <BulletList items={[
              'Maintain a functional, publicly accessible Shopify storefront throughout the term of this Agreement;',
              'Keep their Shopify integration with the Platform connected and in good standing;',
              isCustomApp
                ? 'Maintain an active billing relationship with GG Pickleball and keep payment information current;'
                : 'Maintain an active GG Pickleball app subscription through Shopify;',
              'Ensure that product listings, pricing, and Promo Code terms displayed on the Platform accurately reflect what is available at checkout;',
              'Notify GG Pickleball in writing within five (5) business days if the Brand Partner\'s Shopify store undergoes any material change, including but not limited to a domain change, store suspension, change of ownership, or discontinuation of operations; and',
              'Comply with all applicable laws and regulations in connection with the Brand Partner\'s products, services, and promotional activities.',
            ]} />
          </Section>

          {/* Section 6 */}
          <Section number="6" title="Data & Privacy">
            <SubSection title="6.1 Performance Analytics">
              <Para>GG Pickleball will make available to each Brand Partner analytics and reporting related to that Brand Partner's own Promo Code performance, including redemption counts, associated Order values, and Commission totals. Brand Partners will not have access to data belonging to or generated by any other Brand Partner.</Para>
            </SubSection>
            <SubSection title="6.2 Player Data">
              <Para>GG Pickleball may share player email addresses with the Brand Partner solely where the applicable player has expressly opted in to sharing their contact information with brand partners on the Platform. Player data shared with the Brand Partner under this Agreement may only be used for communications directly related to the Brand Partner and must not be shared with any other party.</Para>
            </SubSection>
            <SubSection title="6.3 Prohibited Uses of Player Data">
              <Para>The Brand Partner may not:</Para>
              <BulletList items={[
                'Sell, rent, transfer, or otherwise disclose player data to any third party;',
                'Use player data for marketing, advertising, or communications unrelated to the Brand Partners core product or service offerings;',
                'Combine player data received under this Agreement with data obtained from other sources for targeting or profiling purposes; or',
                'Retain player data beyond what is reasonably necessary to fulfill the purposes described in Section 6.2.',
              ]} />
            </SubSection>
            <SubSection title="6.4 Compliance with Privacy Laws">
              <Para>The Brand Partner is solely responsible for compliance with all applicable privacy and data protection laws in connection with its receipt and use of player data, including the California Consumer Privacy Act (CCPA) and any other applicable federal or state laws. The Brand Partner shall implement and maintain reasonable administrative, technical, and physical safeguards to protect player data from unauthorized access, use, or disclosure.</Para>
            </SubSection>
            <SubSection title="6.5 Platform Data Ownership">
              <Para>GG Pickleball owns all data generated on or through the Platform, including aggregated, anonymized, and platform-level data. The Brand Partner receives a limited, non-exclusive, non-transferable license to use its own performance data solely for internal business purposes related to this Agreement. This license does not convey any ownership interest in Platform data.</Para>
            </SubSection>
          </Section>

          {/* Section 7 */}
          <Section number="7" title="Intellectual Property">
            <SubSection title="7.1 Ownership">
              <Para>Each party retains all right, title, and interest in and to its own intellectual property, including trademarks, logos, trade names, copyrights, and proprietary technology. Nothing in this Agreement transfers ownership of any intellectual property from one party to the other.</Para>
            </SubSection>
            <SubSection title="7.2 License to GG Pickleball">
              <Para>The Brand Partner grants GG Pickleball a limited, non-exclusive, royalty-free, worldwide license during the term of this Agreement to display the Brand Partner's name, logo, and offer details on the Platform and in marketing materials that identify the Brand Partner as a GG Pickleball brand partner. GG Pickleball will use commercially reasonable efforts to display the Brand Partner's branding accurately and in a manner consistent with the Brand Partner's brand guidelines if such guidelines are provided in writing.</Para>
            </SubSection>
            <SubSection title="7.3 License to Brand Partner">
              <Para>GG Pickleball grants the Brand Partner a limited, non-exclusive, non-transferable, royalty-free license during the term of this Agreement to display GG Pickleball's name and approved marks solely to identify the Brand Partner as a participant in the GG Pickleball platform (e.g., "Available on GG Pickleball"). Any use of GG Pickleball's marks beyond this scope requires prior written approval.</Para>
            </SubSection>
          </Section>

          {/* Section 8 */}
          <Section number="8" title="Representations & Warranties">
            <Para>Each party represents and warrants to the other as of the Effective Date and on a continuing basis that:</Para>
            <BulletList items={[
              'It is duly organized, validly existing, and in good standing under the laws of its jurisdiction of organization;',
              'It has the full legal authority to enter into and perform its obligations under this Agreement; and',
              'Its execution and performance of this Agreement does not violate any applicable law, regulation, or binding agreement.',
            ]} />
            <Para style={{ marginTop: 16 }}>The Brand Partner additionally represents and warrants that:</Para>
            <BulletList items={[
              'The individual accepting this Agreement on behalf of the Brand Partner has the legal authority to bind the Brand Partner;',
              'The Brand Partner\'s products and services comply with all applicable federal, state, and local laws and regulations;',
              'The Brand Partner has the right to offer the discounts it configures and to fulfill Orders placed using its Promo Codes; and',
              'The Brand Partner\'s products and services do not infringe any third-party intellectual property rights.',
            ]} />
          </Section>

          {/* Section 9 */}
          <Section number="9" title="Indemnification & Limitation of Liability">
            <SubSection title="9.1 Indemnification by Brand Partner">
              <Para>The Brand Partner shall indemnify, defend, and hold harmless GG Pickleball, Gogh Group Inc., and their respective officers, directors, employees, and agents from and against any claims, losses, liabilities, damages, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) the Brand Partner's products or services; (b) the Brand Partner's breach of this Agreement; (c) the Brand Partner's violation of any applicable law or third-party rights; or (d) any claim by a player or customer relating to a Promo Code or Order.</Para>
            </SubSection>
            <SubSection title="9.2 Mutual Indemnification">
              <Para>Each party shall indemnify the other for claims directly arising from that party's own gross negligence or willful misconduct.</Para>
            </SubSection>
            <SubSection title="9.3 Limitation of Liability">
              <Para>GG Pickleball's total cumulative liability to the Brand Partner under or in connection with this Agreement, regardless of the basis of the claim, shall not exceed the total Commissions paid by the Brand Partner to GG Pickleball in the three (3) months immediately preceding the event giving rise to the claim.</Para>
            </SubSection>
            <SubSection title="9.4 Exclusion of Consequential Damages">
              <Para style={{ textTransform: 'uppercase', fontSize: 13 }}>
                Neither party shall be liable to the other for any indirect, incidental, special,
                consequential, or punitive damages, including lost profits, lost revenue, or loss
                of goodwill, arising out of or related to this Agreement, even if advised of the
                possibility of such damages.
              </Para>
            </SubSection>
          </Section>

          {/* Section 10 */}
          <Section number="10" title="Term & Termination">
            <SubSection title="10.1 Term">
              <Para>This Agreement is effective as of the Effective Date and continues until terminated in accordance with this Section 10.</Para>
            </SubSection>
            <SubSection title="10.2 Minimum Commitment Period">
              <Para>Neither party may terminate this Agreement for convenience during the three (3) month Minimum Commitment Period following the Go-Live Date. Termination for cause under Section 10.4 is not subject to this restriction.</Para>
            </SubSection>
            <SubSection title="10.3 Termination for Convenience After Minimum Period">
              <Para>Following the Minimum Commitment Period, either party may terminate this Agreement for any reason by providing thirty (30) days' prior written notice to the other party.</Para>
            </SubSection>
            <SubSection title="10.4 Termination for Cause">
              <Para>GG Pickleball may terminate this Agreement immediately upon written notice to the Brand Partner in the event of:</Para>
              <BulletList items={[
                isCustomApp
                  ? 'Lapse or cancellation of the Brand Partner\'s billing relationship with GG Pickleball that remains unresolved for more than ten (10) days;'
                  : 'Lapse or cancellation of the Brand Partner\'s Shopify app subscription that remains unresolved for more than ten (10) days;',
                'Material breach of this Agreement by the Brand Partner that remains uncured for ten (10) days after written notice of such breach;',
                'The Brand Partner\'s Shopify store becoming permanently inactive or suspended;',
                'Violation of the prohibited brand or content policies set forth in Section 2.2; or',
                'The Brand Partner becoming insolvent, making an assignment for the benefit of creditors, or becoming subject to bankruptcy or similar proceedings.',
              ]} />
            </SubSection>
            <SubSection title="10.5 Effect of Termination">
              <Para>Upon termination of this Agreement for any reason:</Para>
              <BulletList items={[
                'All active Promo Codes will be deactivated on the Platform;',
                'All outstanding Commissions on Orders placed prior to the termination date remain due and payable in accordance with Section 4; and',
                'Each party will promptly cease use of the other party\'s marks, except as required to fulfill outstanding obligations.',
              ]} />
            </SubSection>
            <SubSection title="10.6 Survival">
              <Para>The following Sections survive termination or expiration of this Agreement: Section 4 (with respect to Commissions accrued prior to termination), Section 6 (Data & Privacy), Section 7 (Intellectual Property), Section 9 (Indemnification & Limitation of Liability), Section 11 (Governing Law & Disputes), and Section 12 (General Provisions).</Para>
            </SubSection>
          </Section>

          {/* Section 11 */}
          <Section number="11" title="Governing Law & Disputes">
            <SubSection title="11.1 Governing Law">
              <Para>This Agreement and any dispute arising out of or related to it shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law principles.</Para>
            </SubSection>
            <SubSection title="11.2 Binding Arbitration">
              <Para>Any dispute, claim, or controversy arising out of or relating to this Agreement, including its formation, interpretation, breach, or termination, that cannot be resolved by good-faith negotiation shall be submitted to binding arbitration administered by the American Arbitration Association ("AAA") in accordance with its Commercial Arbitration Rules. The arbitration shall take place in California. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.</Para>
            </SubSection>
            <SubSection title="11.3 Small Claims Exception">
              <Para>Either party may bring an individual action in small claims court in lieu of arbitration, provided the claim qualifies for small claims jurisdiction under applicable California law.</Para>
            </SubSection>
            <SubSection title="11.4 Attorneys' Fees">
              <Para>In any arbitration or legal proceeding arising under this Agreement, the prevailing party shall be entitled to recover its reasonable attorneys' fees and costs from the non-prevailing party.</Para>
            </SubSection>
          </Section>

          {/* Section 12 */}
          <Section number="12" title="General Provisions">
            <SubSection title="12.1 Entire Agreement">
              <Para>This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior and contemporaneous discussions, representations, and agreements, whether written or oral, relating to the same subject matter.</Para>
            </SubSection>
            <SubSection title="12.2 Amendments">
              <Para>GG Pickleball may update or modify the terms of this Agreement from time to time by providing at least thirty (30) days' prior written notice to the Brand Partner via the Brand Partner's registered account email. The Brand Partner's continued use of the Platform after the effective date of any modification constitutes acceptance of the updated Agreement. If the Brand Partner does not accept a modification, the Brand Partner may terminate this Agreement as set forth in Section 10.3, provided the Minimum Commitment Period has elapsed.</Para>
            </SubSection>
            <SubSection title="12.3 Independent Contractors">
              <Para>The parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, agency, franchise, or employment relationship between the parties. Neither party has authority to bind the other or to incur obligations on the other's behalf.</Para>
            </SubSection>
            <SubSection title="12.4 Notices">
              <Para>All notices, requests, and communications under this Agreement shall be in writing and delivered to the Brand Partner's registered account email address on file with GG Pickleball, or to GG Pickleball at its designated contact email. Notices sent by email are deemed received upon transmission, absent a delivery failure notification.</Para>
            </SubSection>
            <SubSection title="12.5 No Waiver">
              <Para>The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of that party's right to enforce that provision or any other provision in the future.</Para>
            </SubSection>
            <SubSection title="12.6 Severability">
              <Para>If any provision of this Agreement is held to be invalid, illegal, or unenforceable under applicable law, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remaining provisions shall continue in full force and effect.</Para>
            </SubSection>
          </Section>

          {/* Section 13 */}
          <Section number="13" title="Digital Acceptance">
            <Para>By clicking "I Agree," checking the acceptance box, or otherwise affirmatively accepting this Agreement through the GG Pickleball onboarding interface, the Brand Partner:</Para>
            <BulletList items={[
              'Acknowledges that it has read, understood, and agrees to be legally bound by all terms and conditions of this Agreement;',
              'Confirms that the individual completing acceptance is authorized to legally bind the Brand Partner;',
              'Agrees that this digital acceptance constitutes a valid, enforceable electronic signature under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state law; and',
              'Consents to the recording of the following acceptance information for audit and enforcement purposes: full legal name of the accepting individual, legal company name, brand display name, job title or role, account email address, IP address, date and time of acceptance, and Agreement version number.',
            ]} />
            <Para style={{ marginTop: 16 }}>
              This Agreement is presented with a direct, visible link immediately adjacent to the
              acceptance controls. The Brand Partner is encouraged to save or print a copy of this
              Agreement for its records.
            </Para>
          </Section>

          {/* Footer */}
          <Box
            mt="9"
            pt="6"
            style={{ borderTop: '1px solid var(--gray-4)' }}
          >
            <Text size="2" color="gray">
              GG Pickleball / Gogh Group Inc. — www.ggpickleball.co
            </Text>
            <Text size="2" color="gray" style={{ display: 'block', marginTop: 4 }}>
              Agreement Version {AGREEMENT_VERSION} — {EFFECTIVE_DATE}
            </Text>
          </Box>

        </Box>
      </Container>
    </Box>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  number,
  title,
  children,
}: {
  number: string | number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box mb="8">
      <Heading size="5" mb="4" style={{ color: '#0a0a0a' }}>
        {number}. {title}
      </Heading>
      {children}
    </Box>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box mb="4">
      <Text size="3" weight="bold" style={{ display: 'block', marginBottom: 8, color: '#0a0a0a' }}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

function Para({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <Text
      size="3"
      style={{ lineHeight: 1.75, display: 'block', marginBottom: 12, color: '#374151', ...style }}
    >
      {children}
    </Text>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Box mb="3" style={{ paddingLeft: 20 }}>
      {items.map((item, i) => (
        <Flex key={i} gap="2" mb="2" align="start">
          <Text size="3" style={{ color: '#374151', flexShrink: 0, marginTop: 2 }}>•</Text>
          <Text size="3" style={{ lineHeight: 1.75, color: '#374151' }}>{item}</Text>
        </Flex>
      ))}
    </Box>
  );
}

function DefList({ items }: { items: [string, string][] }) {
  return (
    <Box mb="3">
      {items.map(([term, def], i) => (
        <Box key={i} mb="3" style={{ paddingLeft: 16 }}>
          <Text size="3" weight="bold" style={{ color: '#0a0a0a' }}>{term} </Text>
          <Text size="3" style={{ lineHeight: 1.75, color: '#374151' }}>{def}</Text>
        </Box>
      ))}
    </Box>
  );
}