import { Button, Card, Flex, Inset, Link, Strong, Text } from "@radix-ui/themes";
import Image from "next/image";
import darkGgLogo from "../public/logos/gg_logo_black_transparent.png"
import lightGgLogo from "../public/logos/gg_logo_white_transparent.png"
import calabasasPbLogo from "../public/partnerLogos/calabasaspb_logo.png"
import hero1 from "../public/home/hero1.jpg"
import { Copyright } from "lucide-react";

export default function GGPickleball() {

  return (
    <Flex direction={'column'} align={'center'} justify={'center'}>
      {/* Header + Hero Container with background image */}
      <Flex
        direction="column"
        position="relative"
        width="100vw"
        maxHeight={'100vh'}
        style={{ overflow: 'hidden'}}
      >
        {/* Background image behind both Header and Hero */}
        <Image
          src={hero1}
          alt="Pickleball background"
          priority
          fill
          style={{
            objectFit: 'cover',
            objectPosition: 'top',
          }}
        />

        {/* Header */}
        <Flex
          direction="column"
          width="100vw"
          maxWidth="1500px"
          style={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Flex
            direction="row"
            justify="between"
            px={{ initial: '4', md: '9' }}
            pt="5"
            pb="4"
          >
            <Flex
              direction="column"
              position="relative"
              justify="center"
              align="center"
              display={{initial: "flex", md: "none"}}
            >
              <Image
                src={lightGgLogo}
                alt="GG Pickleball logo"
                height={540}
                width={960}
                style={{
                  width: 'auto',
                  maxHeight: 'clamp(40px, 6vw, 60px)',
                }}
              />
            </Flex>
             <Flex
              direction="column"
              position="relative"
              justify="center"
              align="center"
              display={{initial: "none", md: "flex"}}
            >
              <Image
                src={darkGgLogo}
                alt="GG Pickleball logo"
                height={540}
                width={960}
                style={{
                  width: 'auto',
                  maxHeight: 'clamp(40px, 6vw, 60px)',
                }}
              />
            </Flex>

              <Flex direction="column" justify="center">
                <Button
                  asChild
                  color="gray"
                  highContrast
                  radius="full"
                  style={{ paddingLeft: '20px', paddingRight: '20px' }}
                >
                  <Link href="/play" style={{ textDecoration: 'none' }}>
                    Go to app
                  </Link>
                </Button>
              </Flex>
            
          </Flex>
        </Flex>

        {/* Hero */}
        <Flex
          direction="column"
          height={{
            initial: '400px',
            sm: '400px',
            md: '800px',
            lg: '800px',
          }}
          width="100vw"
          maxWidth="1500px"
          style={{
            position: 'relative',
            zIndex: 1,
            justifyContent: 'flex-end', // This moves children to bottom
          }}
        >
          {/* Hero text container pinned to bottom */}
          <Flex
            direction="column"
            align="center"
            width="100vw"
            maxWidth="1500px"
            pb={{initial: '5', md: '0'}}
            
          >
            <Text
              weight="bold"
              align="center"
              style={{
                color: 'white',
                fontSize: 'clamp(3rem, 6vw, 80px)',
                lineHeight: '1',
                textShadow: '2px 2px 8px rgba(0, 0, 0, 0.6)',
              }}
            >
              Celebrate your progress.
            </Text>
            <Text
              weight="bold"
              align="center"
              style={{
                color: 'white',
                fontSize: 'clamp(3rem, 6vw, 80px)',
                textShadow: '2px 2px 8px rgba(0, 0, 0, 0.6)',
              }}
            >
              Earn rewards.
            </Text>

            <Flex
              direction="column"
              gap="5"
              align="center"
              width="100vw"
              maxWidth="1500px"
              display={{initial: 'none', md: 'flex'}}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                padding: '2rem 1rem',
                marginTop: '2rem',
              }}
            >
              <Text align={'center'} weight={'bold'} size={'7'} style={{color: 'white'}}>A new dimension of pickleball</Text>
              <Text
                align="center"
                size="6"
                style={{
                  color: 'white',
                  maxWidth: '800px',
                }}
              >
                Win or lose, GG Pickleball allows you to be recognized for your achievements and be rewarded for them. 
                Play to earn discounts on reservations, programming, and gear.
              </Text>
              <Flex direction={'row'} width={'100%'} justify={'center'} gap={'5'} mt={'4'}>
                <Button
                  asChild
                  size="4"
                  highContrast
                  radius="full"
                  mb={'8'}
                  style={{width: '250px'}}
                >
                  <Link href="/play" style={{ textDecoration: 'none' }}>
                    Go to app
                  </Link>
                </Button>
              <Button
                asChild
                size="4"
                highContrast
                radius="full"
                mb={'8'}
                style={{ width: '250px', backgroundColor: 'white', color: '#1F2D5C' }}
              >
                <Link
                  target="_blank"
                  href="mailto:play@ggpickleball.co?subject=Partner%20Facility%20Inquiry"
                  style={{ textDecoration: 'none' }}
                >
                  Work with us
                </Link>
              </Button>
              </Flex>
            </Flex>
          </Flex>
        </Flex>

      </Flex>

      {/* Help text */}
      <Flex direction={'column'} gap={'5'} maxWidth={'800px'} align={'center'} justify={'center'} my={'7'} mx={'4'} display={{initial: 'flex', md: 'none'}}>
        <Text align={'center'} weight={'bold'} size={'6'}>A new dimension of pickleball</Text>
        <Text align={'center'} size={'4'} wrap={'pretty'}>
          Win or lose, GG Pickleball allows you to be recognized for your achievements and be rewarded for them. 
          Play to earn discounts on reservations, programming, and gear.
        </Text>
        <Flex direction={'column'} width={'100%'} align={'center'} justify={'center'} gap={'4'} mx={'4'}>
          <Button
            asChild
            size="4"
            highContrast
            variant="outline"
            radius="full"
            style={{ width: '70%', backgroundColor: '#1F2D5C', color: 'white' }}
          >
            <Link href="/play" style={{ textDecoration: 'none' }}>
              Go to app
            </Link>
          </Button>

          <Button
            asChild
            size="4"
            highContrast
            radius="full"
            style={{width: '70%'}}
          >
            <Link
              target="_blank"
              href="mailto:play@ggpickleball.co?subject=Partner%20Facility%20Inquiry"
              style={{ textDecoration: 'none', backgroundColor: 'white', borderColor: '#1F2D5C', borderStyle: 'solid', borderWidth: '1px', color: '#1F2D5C' }}
            >
              Work with us
            </Link>
          </Button>
        </Flex>
      </Flex>

      <Flex direction={'column'} width={{initial: '100vw', md: '80vw'}} mt={'7'} mb={'5'} maxWidth={'1500px'}>
        <Flex direction={'row'} gap={'3'} justify={'between'} wrap={'nowrap'} 
          style={{overflowX: 'auto'}}
        >
          <Flex direction={'column'} flexGrow={'1'} maxWidth={'33.3%'} minWidth={"300px"}>
            <Card m={'4'} style={{boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)"}}>
              <Flex direction={'column'} height={'80px'} flexGrow={'1'} align={'center'} justify={'center'}>
                <Text as="p" size="5" my={'3'} weight={'bold'} align={'center'} style={{maxWidth: '200px'}}>
                  Visit a partnering facility
                </Text>
              </Flex>
              <Inset clip="padding-box" side="bottom" pt={'current'}>
                <Image
                  priority
                  src={'/home/calabasaspb-facility.jpg'}
                  alt="PowerPlay Pickleball"
                  width={900}
                  height={600}
                  style={{
                    display: "block",
                    objectFit: "cover",
                    width: "100%",
                    height: 300,
                  }}
                />
              </Inset>
            </Card>
          </Flex>

          <Flex direction={'column'} flexGrow={'1'} maxWidth={'33.3%'} minWidth={"300px"}>
            <Card m={'4'} style={{boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)"}}>
              <Flex direction={'column'} height={'80px'} flexGrow={'1'} align={'center'} justify={'center'}>
                <Text as="p" size="5" my={'3'} weight={'bold'} align={'center'} style={{maxWidth: '200px'}}>
                  Log your score after each match
                </Text>
              </Flex>
              <Inset clip="padding-box" side="bottom" pt={'current'}>
                <Image
                  src={'/home/pickleball-share.jpg'}
                  alt="Pickleball players"
                  width={900}
                  height={600}
                  style={{
                    display: "block",
                    objectFit: "cover",
                    width: "100%",
                    height: 300,
                  }}
                />
              </Inset>
            </Card>
          </Flex>

          <Flex direction={'column'} flexGrow={'1'} maxWidth={'33.3%'} minWidth={"300px"}>
            <Card m={'4'} style={{boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)"}}>
              <Flex direction={'column'} height={'80px'} flexGrow={'1'} align={'center'} justify={'center'}>
                <Text as="p" size="5" my={'3'} weight={'bold'} align={'center'} style={{maxWidth: '250px'}}>
                  Get discounts on reservations and gear
                </Text>
              </Flex>
              <Inset clip="padding-box" side="bottom" pt={'current'}>
                <Image
                  src={'/home/celebrate.jpg'}
                  alt="Pickleball players"
                  width={800}
                  height={533}
                  style={{
                    display: "block",
                    objectFit: "cover",
                    width: "100%",
                    height: 300,
                  }}
                />
              </Inset>
            </Card>
          </Flex>
        </Flex>
      </Flex>
      
      <Flex direction={'column'} py={'7'} width={{initial: '95vw', md: '80vw'}} mb={'7'} maxWidth={'1500px'} style={{backgroundColor: "#313538", borderRadius: '8px'}}>
        <Flex direction={{initial: 'column-reverse', md: 'row'}} justify={'center'} align={'center'} gap={{initial: '2', md: '9'}}>
          <Flex direction={'column'} gap={'5'}>
            <Text size={'5'} align={{initial: 'center', md: 'left'}} style={{color: 'white'}}>Play at our partner facility to start earning rewards.</Text>
            <Button size={'3'} radius="full" asChild mx={'9'}>
              <Link target="_blank" href="https://maps.app.goo.gl/5SQ4izAPSspzDUi87">Get directions</Link>
            </Button>
          </Flex>
          <Flex direction={'column'} position={'relative'} align={'center'}>
            <Image
              src={calabasasPbLogo}
              alt="Calabasas Pickleball Club Logo"
              height={594}
              width={594}
              style={{
                width: '150px',
                height: 'auto',
              }}
            />
          </Flex>
        </Flex>

      </Flex>

      <Flex direction={'column'} py={'7'} width={'100vw'} style={{backgroundColor: "black"}}>
        <Flex direction={{initial: 'column', md: 'row'}} mx={{initial: '4', md: '9'}} justify={'between'} gap={{initial: '5', md: '9'}}>
          <Flex direction={'column'} position={'relative'} justify={'center'} align={'center'}>
            <Image
              src={lightGgLogo}
              alt="GG Pickleball logo"
              height={540}
              width={960}
              style={{
                width: 'auto',
                maxHeight: '60px',
              }}
            />
          </Flex>
          <Flex direction={'column'}>
            <Button variant="ghost" size={'3'} asChild style={{width: '300px', alignSelf: 'center', color: 'white'}}>
              <Link target="_blank" href="mailto:play@ggpickleball.co?subject=Partner%20Facility%20Inquiry">Work with us</Link>
            </Button>
          </Flex>
        </Flex>
        <Flex direction={'column'} gap={'4'}>
          <Flex direction={'row'} gap={'3'} flexGrow={'1'} justify={'center'} align={'center'} mt={'5'}>
            <Copyright style={{color: 'white'}} />
            <Text size={'2'} align={'center'} style={{color: 'white'}}>2025 <Strong>GG Pickleball</Strong> all rights reserved.</Text>
          </Flex>
          <Link size={'2'} target="_blank" href="https://www.instagram.com/ocmedia.pb/" style={{alignSelf: 'center', textDecoration: 'underline', color: 'white'}}>Main image by OC Media</Link>
        </Flex>
      </Flex>

    </Flex>
  )
}