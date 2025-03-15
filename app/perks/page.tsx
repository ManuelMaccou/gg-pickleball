import { auth0 } from "@/lib/auth0";
import { Box, Button, Flex, Grid, Link, Strong, Text } from "@radix-ui/themes";
import DesktopSidebar from "../components/Sections/DesktopSidebar";
import TopBanner from "../components/Sections/TopBanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function RegisterPage() {

 const session = await auth0.getSession();

  let errorMessage: string | null = null;
   
  if (!session || !session.user) {
    await delay(4000);
    errorMessage ='You must be logged in to view this page. Redirecting...'
    redirect("/api/auth/login");
  }

  if (errorMessage) {
    return (
      <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}}>
        <Flex display={{ initial: 'none', md: 'flex' }}>
          <DesktopSidebar />
        </Flex>

        <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
          <TopBanner />
        </Flex>
        <Box m="4">
          <Alert variant="destructive" style={{ backgroundColor: "white" }}>
            <AlertCircle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}}>
      <Flex display={{ initial: 'none', md: 'flex' }}>
        <DesktopSidebar />
      </Flex>

      <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
        <TopBanner />
      </Flex>

      <Grid columns={{ initial: "1", md: "2", lg: "3" }} gap={"4"} m={{initial: "0", md: "4"}}>
        
        {/* SMPC */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/smpc_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/smpc_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "100px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                $20 off 2-hour reservations during the following hours:
              </Text>
              <Text size={'6'}>
                Weekdays:
                12pm - 4pm | 7:30pm - 10pm
              </Text>
              <Text size={'6'}>
                Weekends:
                After 6pm
              </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
                Request your court on the GG Pickleball platform
              </Text>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Pickle Pop */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/picklepop_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover", objectPosition: 'left center'}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#E3C9E8'}}  p={'5'}>
                <Image 
                  src={"/logos/picklepop_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "100px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                $20 off all 2-hour court reservations
              </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
                Request your court on the GG Pickleball platform
              </Text>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Gherkin */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/gherkin_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/gherkin_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                15% off Gherkin paddles
              </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
               Use this code online at checkout: <Strong>GGPBL15</Strong>
              </Text>
              <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://www.gherkinusa.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#678CAF", color: "#FFFFFF"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Court & Crew */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/courtcrew_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover", objectPosition: 'top center', marginTop: '70px'}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  marginTop: '70px'
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/courtcrew_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                15% off all orders over $45
              </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
               Use this code at checkout: <Strong>GG15</Strong>
              </Text>
              <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://thecourtandcrew.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#DC2710", color: "#FFFFFF"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Training Mate */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/trainingmate_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/trainingmate_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
                <Text size={'8'} mt={'-4'} weight={'bold'} align={'center'}>Free 5-pack of classes for the winning team at the Santa Monica location. Valued at $150.</Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
                  We will contact the winning team.
              </Text>
              <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://trainingmate.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#0093d0", color: "#FFFFFF"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Training Mate */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/trainingmate_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/trainingmate_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
                <Text size={'8'} mt={'-4'} weight={'bold'} align={'center'}>
                  All players receive a free class for you and a friend at the Santa Monica location. Valued at $64.
                </Text>
              <Button mt={'3'} size={'3'} style={{backgroundColor: '#0093D0', color: '#FFFFFF'}}> Claim your free class</Button>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Training Mate */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/trainingmate_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/trainingmate_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
                <Text size={'8'} mt={'-4'} weight={'bold'} align={'center'}>
                  All players receive discounted membership rates at the Santa Monica location.
                </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
                Show this screen at the front desk.
              </Text>
              <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://trainingmate.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#0093d0", color: "#FFFFFF"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>
       
        {/* Knockaround */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/knockaround_bg2.jpg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/knockaround_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                Free sunglasses for the winning team.
              </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
                We will reach out to the winning team to coordinate shipping.
              </Text>
              <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://knockaround.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#2BB4E8", color: "#FFFFFF"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>
          
        {/* The Hive */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/thehive_bg.jpg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#000000'}}  p={'5'}>
                <Image 
                  src={"/logos/The_Hive_Logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "60px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                10% off at Santa Monica, Mar Vista, and Marina del Rey locations
              </Text>
              <Text size={'6'}>
                <Strong>To redeem: </Strong>
                Show this screen at checkout.
              </Text>
              <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://www.hivehealthyeats.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#FFE605", color: "#000000"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        {/* Everytable */}
        <Box height={'600px'}>
          <Flex direction={'column'} position={'relative'} width={'100%'} height={'100%'}>
            <div style={{ position: "absolute", width: "100%", height: "100%", zIndex: "-1" }}>
              <Image 
                src={"/partnerAssets/everytable_bg.jpeg"} 
                alt={""}          
                fill
                style={{ objectFit: "cover"}}
              />
              <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                }} />
            </div>
            <Flex direction={'column'}  align={'center'} height={'100%'} gap={'4'}>
              <Flex direction={'column'} align={'center'} width={'100%'} height={'100px'} style={{backgroundColor: '#FFFFFF'}}  p={'5'}>
                <Image 
                  src={"/logos/everytable_logo.png"} 
                  alt={""}          
                  height={'158'}
                  width={'306'}
                  style={{ width: "auto", maxHeight: "80px" }}
                />
              </Flex>
              <Flex direction={'column'} p={'5'} justify={'center'} height={'100%'} gap={'4'}>
              <Text size={'8'} weight={'bold'} align={'center'}>
                10% off all meals online and in-store at the Santa Monica location.
              </Text>
              <Text size={'6'}><Strong>To redeem: </Strong>
                <Text>Show this screen when checking out in-store.</Text></Text>
               <Text size={'6'}>Use this code when checking out online: <Strong>ETPICKLE</Strong></Text>
               <Flex direction={'column'} width={'100%'} align={'center'}>
                <Link href="https://www.everytable.com/?utm_source=gg-pickleball&utm_medium=referral&utm_campaign=community-partners&utm_content=perks-page" target="blank">
                  <Button size={'4'} mt={'5'} style={{backgroundColor: "#00464B", color: "#FFFFFF"}}>Visit website</Button>
                </Link>
              </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Box>
      </Grid>
    </Flex>
  )
}