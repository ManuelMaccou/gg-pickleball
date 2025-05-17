import { Button, Card, Flex, Inset, Link, Strong, Text } from "@radix-ui/themes";
import Image from "next/image";
import darkGgLogo from "../public/logos/gg_logo_black_transparent.png"
import lightGgLogo from "../public/logos/gg_logo_white_transparent.png"
import powerPlayLogo from "../public/partnerLogos/PowerPlay_logo.png"
import hero from "../public/home/hero.jpg"
import { Copyright } from "lucide-react";

export default function GGPickleball() {

  return (
    <Flex direction={'column'} align={'center'} justify={'center'}>

      {/* Header */}
      <Flex direction={'column'} width={'100vw'} style={{borderBottom: '1px solid lightgray' }} maxWidth={'1500px'}>
        <Flex direction={'row'} justify={'between'} px={{initial: '4', md: '9'}} pt={'5'} pb={'4'}>
          <Flex direction={'column'} position={'relative'} justify={'center'} align={'center'}>
            <Image
              src={darkGgLogo}
              alt="GG Pickleball logo"
              priority
              height={540}
              width={960}
              style={{
                width: 'auto',
                maxHeight: '60px',
              }}
            />
          </Flex>
          <Flex direction={{initial: 'column', md: 'row'}} gap={'5'}>
            <Button asChild color="gray" highContrast radius="full" style={{paddingLeft: '20px', paddingRight: '20px'}}>
              <Link href="/play" style={{textDecoration: 'none'}}>Go to app</Link>
            </Button>
            <Button asChild color="gray" highContrast radius="full" variant="outline" style={{paddingLeft: '20px', paddingRight: '20px'}}>
              <Link target="_blank" href="mailto:play@ggpickleball.co?subject=Partner%20Facility%20Inquiry" style={{textDecoration: 'none'}}>Work with us</Link>
            </Button>
          </Flex>
        </Flex>
      </Flex>

      {/* Hero */}
      <Flex direction={'column'} my={'7'} width={'100vw'} maxWidth={'1500px'}>
        <Flex direction={'column'} position={'relative'} height={'500px'} width={{initial: '95vw', md: '80vw'}} style={{margin: 'auto'}}>
          <Image
            src={hero}
            alt="Pickleball players"
            priority
            fill
            style={{
              maxWidth: '1200px',
              borderRadius: '20px',
              objectFit: 'cover',
              objectPosition: 'top',
              margin: 'auto'
            }}
          />
        </Flex>
      </Flex>

      {/* Help text */}
      <Flex direction={'column'} maxWidth={'800px'} align={'center'} justify={'center'} my={'7'} mx={'4'}>
        <Text align={'center'} size={'6'}>
        GG Pickleball allows facilities to reward and celebrate the progress of their players. 
        It&apos;s a fun way to recognize improvements and encourage play.
        </Text>
      </Flex>

      {/* Grid */}
      <Flex direction={'column'} width={{initial: '100vw', md: '80vw'}} mt={'7'} mb={'5'} maxWidth={'1500px'}>
        <Flex direction={'row'} gap={'5'} justify={'between'} wrap={'nowrap'} px={{initial: '3', md: '0'}}
          style={{overflowX: 'auto'}}
        >
          <Flex direction={'column'} flexGrow={'1'} maxWidth={'33.3%'} minWidth={"300px"}>
            <Card m={'4'} size="2" variant="ghost" style={{backgroundColor: "#313538"}}>
              <Flex direction={'column'} height={'80px'} maxWidth={'200px'} justify={'center'} style={{justifySelf: 'center'}}>
                <Text as="p" size="5" my={'3'} weight={'bold'} align={'center'} style={{color: 'white'}}>
                  Visit a partnering facility
                </Text>
              </Flex>
              <Inset clip="padding-box" side="bottom" pt={'current'}>
                <img
                  src={'/home/partner-facility.jpg'}
                  alt="PowerPlay Pickleball"
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
            <Card m={'4'} size="2" variant="ghost" style={{backgroundColor: "#313538"}}>
              <Flex direction={'column'} height={'80px'} maxWidth={'200px'} justify={'center'} style={{justifySelf: 'center'}}>
                <Text as="p" size="5" my={'3'} weight={'bold'} align={'center'} style={{color: 'white'}}>
                  Log your score after each match
                </Text>
              </Flex>
              <Inset clip="padding-box" side="bottom" pt={'current'}>
                <img
                  src={'/home/pickleball-share.jpg'}
                  alt="Pickleball players"
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
            <Card m={'4'} size="2" variant="ghost" style={{backgroundColor: "#313538"}}>
              <Flex direction={'column'} height={'80px'} maxWidth={'200px'} justify={'center'} style={{justifySelf: 'center'}}>
                <Text as="p" size="5" my={'3'} weight={'bold'} align={'center'} style={{color: 'white'}}>
                  Unlock achievements and earn rewards
                </Text>
              </Flex>
              <Inset clip="padding-box" side="bottom" pt={'current'}>
                <img
                  src={'/home/end-match.jpg'}
                  alt="Pickleball players"
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
      
      {/* Partner */}
      <Flex direction={'column'} py={'7'} width={{initial: '95vw', md: '80vw'}} mb={'7'} maxWidth={'1500px'} style={{backgroundColor: "#313538", borderRadius: '8px'}}>
        <Flex direction={{initial: 'column-reverse', md: 'row'}} justify={'center'} gap={{initial: '2', md: '9'}}>
          <Flex direction={'column'} gap={'5'}>
            <Text size={'5'} align={{initial: 'center', md: 'left'}} style={{color: 'white'}}>Play at our partner facility to start earning rewards.</Text>
            <Button size={'3'} radius="full" asChild mx={'9'}>
              <Link target="_blank" href="https://maps.app.goo.gl/9nEevuLUuHhn5VCz7">Get directions</Link>
            </Button>
          </Flex>
          <Flex direction={'column'} position={'relative'} align={'center'}>
            <Image
              src={powerPlayLogo}
              alt="PowerPlay Pickleball Logo"
              priority
              height={94}
              width={306}
              style={{
                width: '300px',
                height: 'auto',
              }}
            />
          </Flex>
        </Flex>

      </Flex>

      {/* Footer */}
      <Flex direction={'column'} py={'7'} width={'100vw'} style={{backgroundColor: "black"}}>
        <Flex direction={{initial: 'column', md: 'row'}} mx={{initial: '4', md: '9'}} justify={'between'} gap={{initial: '5', md: '9'}}>
          <Flex direction={'column'} position={'relative'} justify={'center'} align={'center'}>
            <Image
              src={lightGgLogo}
              alt="GG Pickleball logo"
              priority
              height={540}
              width={960}
              style={{
                width: 'auto',
                maxHeight: '60px',
              }}
            />
          </Flex>
          <Flex direction={'column'}>
            <Button size={'3'} radius="full" asChild style={{width: '300px', alignSelf: 'center'}}>
              <Link target="_blank" href="mailto:play@ggpickleball.co?subject=Partner%20Facility%20Inquiry">Work with us</Link>
            </Button>
          </Flex>
        </Flex>
        <Flex direction={'row'} gap={'3'} flexGrow={'1'} justify={'center'} align={'center'} mt={'5'}>
          <Copyright style={{color: 'white'}} />
          <Text size={'2'} align={'center'} style={{color: 'white'}}>2025 <Strong>GG Pickleball</Strong> all rights reserved.</Text>
        </Flex>

      </Flex>
    </Flex>
  )
}