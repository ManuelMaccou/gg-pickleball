'use client'

import { useUser } from "@auth0/nextjs-auth0"
import DesktopSidebar from "@/app/components/Sections/DesktopSidebar";
import { Button, Flex, Strong, Text } from "@radix-ui/themes";
import { Checkbox } from "@/components/ui/checkbox"
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import TopBanner from "@/app/components/Sections/TopBanner";

export default function Chat() {
  const router = useRouter();
  const params = useParams()
  const matchId = params.matchId
  const { isLoading, user } = useUser();

  const [checked, setChecked] = useState<boolean>(false);

  const handleCheckBox = (value: boolean) => {
    setChecked(value);
  };

  if (!isLoading && !user) {
    router.push('/auth/login')
  }


  return (
    <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}}>
      <Flex display={{ initial: 'none', md: 'flex' }}>
        <DesktopSidebar />
      </Flex>

      <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
        <TopBanner />
      </Flex>

      <Flex direction={'column'} px={'4'} width={{initial: "100%", md: "60%"}} style={{marginRight: 'auto', marginLeft: 'auto'}}>
       

          <Flex direction={'column'} gap={'6'} mt={'6'}>
            <Flex direction={'column'} gap={'2'}>
              <Text size={'6'} weight={'bold'} mb={'4'}>Please confirm the following:</Text>
              <Text size={'5'} weight={'bold'}>Reservation Policy</Text>
              <Text><Strong>All players in this match must pay before the reservation can be submitted to the facility</Strong></Text>
              <Text mt={'-2'}>
                Reservations are not guaranteed. If a court is no longer available by the time all players have paid,
                you will have the opportunity to select a new time. You will not be charged until the reservation has been
                confirmed by the facility shown above.
              </Text>
            </Flex>
 
           <Flex direction={'column'} gap={'2'}>
             <Text size={'5'} weight={'bold'}>Cancelation Policy</Text>
             <Text><Strong>This cancelatin policy supercedes the policies of facilities where reservations are made.</Strong></Text>
             <Text mt={'-2'}>
               Court reservations made for GG Pickleball league play may be cancelled for credit 72 hours prior 
               to the scheduled time by emailing play@ggpickleball.co. Credits may be used towards a future booking. 
               Any cancelation request made within 72 hours of your scheduled reservation may not be honored.
             </Text>
           </Flex>
 
           <Flex direction={'column'} gap={'2'}>
             <Text size={'5'} weight={'bold'}>Facility waivers</Text>
             <Text>
               By continuing, you agree to the facility waivers listed in our {" "}
               <Link href={'/rules'} target="_blank" style={{color: 'aqua'}}>official league rules and cancelation policies</Link>.
             </Text>
           </Flex>
 
           <Flex direction={'row'} gap={'3'} my={'5'}>
             <Checkbox
               id="terms"
               className="w-6 h-6"
               checked={checked}
               onCheckedChange={handleCheckBox}
             />
             <label
               htmlFor="terms"
               className="text-m font-medium leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
             >
               I agree to the above policies.
             </label>
           </Flex>
 
         </Flex>
 
         <Flex direction={'column'} p={{initial: '6', md: '0'}} mt={{initial: '0', md: '4'}} width={{initial: '100%', md: '50%'}}>
           <Button size={'4'} disabled={!checked}
             onClick={() => router.push(`/reserve/pay?matchId=${matchId}`)}
           >
             Next
           </Button>
         </Flex>
       
      

      

      </Flex>
    </Flex>

  )
    
    

}