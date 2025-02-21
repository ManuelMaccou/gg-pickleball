'use client'

import { Box, Button, Flex, Heading, Link, Strong, Text, Theme } from "@radix-ui/themes";
import Image from "next/image";
import darkGGLogo from "../../public/gg_logo_black_transparent.png"
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

export default function Rules() {
  const router = useRouter()

  const handleGoBack = () => {
    router.back()
  }

  return (
    <Theme appearance="light" accentColor="yellow">
      <Flex direction={'column'} py={'9'} width={'100vw'} align={'center'} className="px-[15px] md:px-[50px] lg:px-[300px]">
        <Flex direction={'column'} align={'start'} width={'100%'} mb={{initial: '9', md: '0'}}>
          <Button 
            size={'4'}
            variant="ghost"
            onClick={handleGoBack}
          >
            <ArrowLeftIcon />
            <Text size={'7'}>Go back</Text>
          </Button>
        </Flex>
        <Flex direction={'column'}>
          <Flex
            mb={'9'}
            className={`relative`}
            direction={'column'}
            maxWidth={'200px'}
          >
            <Image
              src={darkGGLogo}
              alt={'Dark GG Pickleball logo'}
              priority
              style={{
                width: 'auto',
                maxHeight: '125px',
              }}
          />
          </Flex>
        </Flex>

        <Flex direction={'column'} mb={'9'}>
          <Text><Strong>
            By participating in GG Pickleball leagues, you agree to these rules, cancelation policies, 
            and facility waivers. Please read this document carefully.
          </Strong></Text>
        </Flex>

        <Flex direction={'row'} justify={'between'} width={'90%'} mb={'9'}>
          <Link color="blue" href="#rules">Official Rules</Link>
          <Link color="blue" href="#cancelation">Cancelation Policy</Link>
          <Link color="blue" href="#smpc">SM Pickleball Center Waiver</Link>
          <Link color="blue" href="#picklepop">Pickle Pop Waiver</Link>
        </Flex>
        
        <Flex direction={'column'} gap={'6'}>
          <Box>
            <Heading as="h1" id="rules">Official Rules</Heading>
          </Box>
          <Box>
            <Text >
              GG Pickleball is a monthly, leaderboard style league with a twist. Teams don&apos;t commit to a 
              specific time or place. Instead our flexible format allows people to play at any time at multiple 
              courts. We match you with teams of similar skill and suggest a court to play on based on player 
              and court availability. This flexibility creates a more inclusive environment for people with busy 
              schedules, families, or just want more opportunities to play with equally skilled opponents.
            </Text>
          </Box>

          <Flex gap={'3'} direction={'column'}>
            <Heading as="h2">Registration Fee</Heading>
            <Text >
              Each team is required to pay an $80 league fee each month in order to be active for that season. 
              Each season lasts 1 month. 
            </Text>
            <Text><Strong>This fee does not include court fees, although you will receive a discount at certain courts
              for participating in this league.</Strong></Text>
          </Flex>
              
          <Flex gap={'3'} direction={'column'}>
            <Heading as="h2">Maintaining an active status</Heading>
            <Text>
              To remain active each month, players must meet the following requirements:
            </Text>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <Text>
                  • Pay the registration fee prior to the posted start date of the next league season.
                </Text>
              </li>
              <li>
                <Text>
                  • Log 4 official games per week in the GG Pickleball platform including scores for the winning and 
                  losing team. See next section for more details.
                </Text>
              </li>
              <li>
                <Text>
                  • Log 16 official games per season in the GG Pickleball platform including scores for the winning and losing team.
                </Text>
              </li>
            </ul>
          </Flex>

          <Flex gap={'3'} direction={'column'}>
            <Heading as="h2">Logging Official Games</Heading>
            <Text >
              Teams can play as many games as they want during the allotted time of each court reservation. However, in 
              order for a game to count towards official standings, it must be logged in the GG Pickleball platform. All 
              players must log the same scores for both the winners and losers. This ensures honest game play. If two teams 
              cannot agree on the scores or the winners and losers, the game will not count. If a player does not log 4 games 
              per week or 16 games for the season, they will not be eligible to win. If a player logs more than 4 games in 
              a given week, only the first 4 games will count.
            </Text>
            <Text >
              Given this requirement, it is recommended teams announce BEFORE the game begins that the next game will be 
              officially scored. 
            </Text>
          </Flex>

          <Flex gap={'3'} direction={'column'}>
            <Heading as="h2">Maximum Number of Same-Team Matches</Heading>
            <Text >
              The same two teams can only play each other a maximum of 10 times over the course of the 16-game season. 
              We strongly encourage teams to play as many different opponents as possible, but we understand schedules 
              may not always match up. This is to ensure fair league play. This rule will automatically be enforced on 
              the platform. Official games will not be able to be logged if there are already 10 games logged between 
              the same two teams. 
            </Text>
          </Flex>

          <Flex gap={'3'} direction={'column'}>
            <Heading as="h2">Match Rules for Officially Scored Games</Heading>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <Text size="5">
                  • Games are played to 11.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • Games must be won by 2.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • Only teams of 2 are allowed.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • The player closest to the ball calls in or out.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • There is no rule for who serves first.
                </Text>
              </li>
            </ul>
          </Flex>
        </Flex>

        <Flex direction={'column'} gap={'6'} mt={'9'}>
          <Box>
            <Heading as="h2" id="cancelation">Cancelation Policy</Heading>
          </Box>
          <Text>
            Court reservations made for GG Pickleball league play may be cancelled for credit 72 hours prior 
            to the scheduled time by emailing play@ggpickleball.co. Credits may be used towards a future booking. 
            Any cancelation request made within 72 hours of your scheduled reservation may not be honored.
          </Text>
        </Flex>

        <Flex direction={'column'} mt={'9'} gap={'6'} id="smpc">
          <Box>
            <Heading as="h2" mb={'4'} id="rules">SM Pickleball Center Waiver</Heading>
            <Text>
              This waiver has been slightly modified to remove the Santa Monica Pickleball Center cancellation policy.
              The GG Pickleball league cancelation policy applies to all courts booked for league play.
            </Text>
          </Box>
          <Flex direction={'column'} gap={'3'}>
            <Text>
              PLEASE READ CAREFULLY. BY SIGNING THIS AGREEMENT, YOU ARE CONSENTING TO THE WAIVER AND RELEASE OF 
              CERTAIN LEGAL RIGHTS, ACKNOWLEDGING YOUR EXPRESS ASSUMPTION OF RISK, AND AGREEING TO A COVENANT NOT TO 
              SUE AS SET FORTH IN THIS AGREEMENT. THIS AGREEMENT ALSO INCLUDES AN ARBITRATION PROVISION AND A WAIVER OF 
              YOUR RIGHT TO BRING A CLASS ACTION.
            </Text>
            <Text>
              I wish to participate in, or otherwise attend, a Pickleball exhibition, tournament, match, event, demonstration, 
              practice, game and/or training (the “Activities”) organized and/or promoted by Santa Monica Tennis Center LLC 
              (“Santa Monica Pickleball Center”) at 2505 Wilshire Blvd and any other locations and hereby agree to the following. 
              If the individual participating in the Activity is a minor, the individual&apos;s parent(s) or legal guardian(s), by 
              signing this Agreement, makes the following representations on behalf of the individual.
            </Text>
            <Text>
              I understand and acknowledge that: (i) the Activities may be hazardous to participant and others and that 
              there are risks and dangers, including that of personal injury (including death), property damage or loss, 
              and other hazards that could arise from or occur during the Activities; (ii) these risks and dangers include, 
              but are not limited to, those arising from falls, collisions, being struck by paddles, balls, or other objects, 
              bodily contact with the court, fence, other participants, or other barriers, and risks and dangers of illness 
              arising from any communicable disease; and (iii) there may be other dangerous conditions or risks including, 
              but not limited to, weather and/or related court conditions, and the conduct of other participants, instructors, 
              vendors, entities, or individuals other than Releasees, over which Releasees may not have control,
            </Text>
            <Text>
              I ACKNOWLEDGE THAT: (i) THE ACTIVITIES WILL INVOLVE PHYSICAL AND MENTAL EXERTIONS AND STRESSES, (ii) I AM 
              VOLUNTARILY PARTICIPATING IN THEM ENTIRELY AT MY OWN RISK, and (iii) THE RISKS ASSOCIATED WITH THE ACTIVITIES 
              MAY INCLUDE, BUT NOT BE LIMITED TO, INJURY FROM THE FACILITIES, TEMPERATURE, WEATHER, LACK OF HYDRATION, 
              CONDITIONS OF PARTICIPANTS, EQUIPMENT, VEHICULAR AND PEDESTRIAN TRAFFIC, AND THE ACTION OF OTHERS, AND OTHER 
              CONDITIONS OR INDIVIDUALS OVER WHICH RELEASEES HAVE NO CONTROL (SUCH AS, WITHOUT LIMITATION, OTHER PARTICIPANTS, 
              VOLUNTEERS, SPECTATORS, COACHES, VENDORS, ACTIVITIES&apos;: OFFICIALS, MONITORS, SPONSORS, OR ORGANIZERS). I UNDERSTAND 
              THAT PHYSICAL, MENTAL, EMOTIONAL, REPUTATIONAL OR PSYCHOLOGICAL INJURY, PROPERTY DAMAGE AND ECONOMIC LOSS MAY RESULT. 
              NOTWITHSTANDING THE FOREGOING, I ASSUME ALL RELATED RISKS, BOTH KNOWN OR UNKNOWN TO ME.
            </Text>
            <Text>
              I, on behalf of myself, and any minor child on whose behalf this Agreement is executed hereby voluntarily and 
              irrevocably and forever release, waive and discharge (and covenant not to sue) Santa Monica Pickleball Center, 
              Santa Monica Tennis Center, LA Pickleball Inc and their respective officials, employees, members, equity holders, 
              subsidiaries, affiliates, parents, directors, officers, managers, partners, agents, successors and assigns 
              (collectively, the “Releasees”) from or with respect to any and all claims, suits, causes of action and claims 
              for damages including, but not limited to, claims arising out of or in connection with my death, personal injury, 
              illness, temporary or permanent disability, suffering of short-term or long-term health effects, economic loss, 
              out of pocket expenses, or loss of or damage to property (“Losses”), which I, any minor child on whose behalf 
              this Agreement is executed, may have or hereafter accrue against any of the Releasees as a result of or that 
              relate in any way to (i) my participation in the Activities; (ii) my travel to or presence within the Center or 
              (iii) any of the risks or dangers identified above, each of which I have knowingly and voluntarily assumed and 
              legal recourse for which I have knowingly, voluntarily and irrevocably waived, in each case whether caused by 
              any action, inaction, fault, misconduct, or negligence of any of the Releasees or otherwise, excepting only 
              those Losses caused by the willful misconduct or gross negligence of the Releasees. I further agree to defend 
              and indemnify the Releasees from and against any and all claims, suits, actions, actions and legal proceedings 
              that may be instituted on Participant&apos;s or my behalf.
            </Text>
            <Text>
              In the event that I should require medical care or treatment, I agree to be financially responsible for any 
              costs incurred as a result of such treatment and understand that the Releasees do not assume any responsibility 
              for or obligation to provide financial assistance or other assistance, including but not limited to medical, 
              health, or disability insurance in the event of injury or illness.  I am aware and understand that I should carry 
              my own health insurance and any other insurance I deem necessary to participate in the Activity, and that I am 
              solely responsible for any and all medical expenses due to bodily injury, illness, disability, death, property 
              damage and other harm in connection with the Activities. In the event that any damage to equipment or facilities 
              occurs as a result of my willful actions, neglect or recklessness, I acknowledge and agree to be held liable for 
              any and all costs associated with any actions, neglect or recklessness. I do hereby release and forever discharge 
              the Releasees from any claim whatsoever which arises or may hereafter arise on account of any first aid, treatment, 
              or service rendered in connection with my participation in the Activities.
            </Text>
            <Text>
              I do hereby grant and convey all right, title, and interest in any and all photographic images and video or 
              audio recordings made of me by the Releasees during the Activities including, but not limited to, any royalties, 
              proceeds, or other benefits derived from such photographs or recordings, whether for commercial or non-commercial 
              use. To the fullest extent permitted by law, acknowledgment of this release and waiver of liability and in 
              consideration for participation in the Activities, I hereby grant to the Releasees, their licenses, designees, 
              successors and assigns, a worldwide, perpetual, irrevocable, fully-paid royalty free, assignable license to use, 
              copy, and disseminate my image and personal attributes and to modify and present same in any form, manner, and 
              media, now known or hereafter devised for any purpose whatsoever.
            </Text>
            <Text>
              I expressly agree that this Agreement shall be governed by, construed and enforced in accordance with, the laws 
              of the State of New York without regard to choice of law principles, and is intended to be as broad and inclusive 
              as is permitted by the laws of New York. If any portion of this Agreement is held invalid, illegal, or unenforceable 
              to any extent and for any reason by any court of competent jurisdiction, such portion will be excluded to the extent 
              of such invalidity or unenforceability; all other terms of this Agreement will remain in full force and effect; and, 
              to the extent permitted and possible, the invalid or unenforceable term will be deemed replaced by a term that is 
              valid and enforceable and that comes closest to expressing the intention of such invalid or unenforceable term.
            </Text>
            <Text>
              I agree to submit any dispute arising under this Agreement to binding arbitration pursuant to American 
              Arbitration Association rules. I further agree that (i) the arbitrator shall have the power to award any remedies, 
              including attorneys&apos; fees and costs, available under applicable law; (ii) judgment upon the award rendered by the 
              arbitrator may be entered in any court having jurisdiction; (iii) the award may be vacated or modified only on 
              the grounds specified in applicable rules and laws; and (iv) any arbitration conducted pursuant to this Agreement 
              shall take place in New York, New York. In agreeing to submit all disputes for resolution by arbitration, I 
              acknowledge that such agreement is given in exchange for rights or benefits to which I am not otherwise entitled 
              and the more expeditious and confidential resolution of any such disputes.
            </Text>
            <Text>
              I agree that all claims must be pursued on an individual basis only. By signing this Agreement, I hereby waive 
              my right to commence, or be a party to, any class or collective claims against the Releasees.
            </Text>
            <Text>
              I have carefully read this Agreement and fully understand its terms and that I am hereby giving up substantial 
              legal rights. I further agree that no oral representations, statements, or inducements contrary to anything 
              contained herein have been made by Releasees. I further understand that I may consult an attorney about this 
              Agreement. I expressly agree to release and discharge, indemnify and hold harmless, the Releasees, from any 
              and all claims or causes of action, suits, actions or judgments of any kind whatsoever for liability, damages, 
              compensation, equitable relief or otherwise, brought by me or anyone on my behalf, including claims or awards 
              of attorney&apos;s fees, statutory interest, sanctions and any related costs and I agree to voluntarily give up or 
              waive any right that I otherwise have to bring a legal action of any kind against the Releasees for personal 
              injury or property damage.
            </Text>
            <Text>
              I agree that Santa Monica Pickleball Center may send me emails at the email address provided about future 
              events and Promotions as indicated below. I also agree to the following privacy policies:
            </Text>
            <Text>
              By participating, I agree that Santa Monica Pickleball Center may send me 
              emails about future events and promotions at the email address provided and that I agree to Santa Monica 
              Pickleball Center&apos;s privacy policy at: https://santamonicapickleballcenter.com/policies/privacy-policy 
            </Text>
            <Text>
              The Center is not responsible for the security of property lost, found or abandoned in the facility or in the 
              parking lot. Users are expected to keep their belongings such as cell phones and laptops within their sight at 
              all times.
            </Text>
          </Flex>
        </Flex>

        <Flex direction={'column'} gap={'6'} mt={'9'}>
          <Box>
            <Heading as="h1" id="picklepop">Pickle Pop Waiver</Heading>
          </Box>
          <Flex direction={'column'} gap={'3'}>
            <Text>
              I, the undersigned, in consideration for being permitted to participate in pickleball activities at Pickle Pop, 
              do hereby agree to the following:
            </Text>
            <Text>
              Acknowledgment of Risks: I understand and acknowledge that playing pickleball, being present at the Pickle 
              Pop indoor facility, and participating in any related activities carry inherent risks, hazards, and dangers 
              that cannot be eliminated, including but not limited to the risk of physical injury, accidents, or illness.
            </Text>
            <Text>
              Assumption of Risk: I willingly and voluntarily assume all risks and hazards associated with my participation 
              in pickleball activities, including any related activities at Pickle Pop, and accept responsibility for any and 
              all injuries (including death), damages, or loss which I might sustain.
            </Text>
            <Text>
              Release and Indemnification: I, on behalf of myself, my heirs, assigns, personal representatives, and next of 
              kin, release, indemnify, and hold harmless Pickle Pop, its officers, agents, employees, and volunteers 
              (collectively “Releasees”) from and against any claims, liabilities, damages, or causes of action arising out of 
              or in any way connected with my participation in pickleball activities at Pickle Pop, whether arising from the 
              negligence of the Releasees or otherwise.
            </Text>
            <Text>
              Health & Safety: I attest that I am physically fit and have no known medical conditions that would prevent my 
              participation in pickleball activities at Pickle Pop. I understand and agree to follow all safety instructions 
              and guidelines provided by Pickle Pop.
            </Text>
            <Text>
              Photo and Video Release: I consent to and authorize Pickle Pop, its representatives, and employees to take 
              photographs or videos of me during my participation in activities at the facility. I grant Pickle Pop permission 
              to use the resulting images and footage for any lawful purpose, including but not limited to promotional materials, 
              digital platforms, and social media.
            </Text>
            <Text>
              Personal Property: I acknowledge that Pickle Pop is not responsible for any lost, stolen, or damaged personal 
              property brought to or left at the facility.
            </Text>
            <Text>
              Acknowledgment: I acknowledge that I have read and understood this waiver, that I am at least 18 years old and 
              mentally competent to agree to its terms, or that I am the parent or guardian of a minor participant and consent 
              to their participation under the terms herein.
            </Text>
            <Text>
              
            </Text>
          </Flex>
        </Flex>

      </Flex>
    </Theme>
    
      
  )
}