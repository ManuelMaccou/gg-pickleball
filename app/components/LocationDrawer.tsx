"use client"

import * as React from "react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Box, Card, ChevronDownIcon, Flex, VisuallyHidden } from "@radix-ui/themes"
import { IClient } from "../types/databaseTypes";
import Image from "next/image";

interface LocationDrawerProps {
  allClients: IClient[];
  currentClient: IClient;
  onLocationChange: (client: IClient) => void;
}

const EXCLUDED_CLIENT_NAME = "Test Client";

export default function LocationDrawer({ allClients, currentClient, onLocationChange }: LocationDrawerProps) {

  const handleSelectLocation = async(client: IClient) => {
    document.cookie = `lastLocation=${client._id.toString()}; path=/; max-age=${60 * 60 * 24 * 30}`;
    onLocationChange(client);
  }

  const filteredClients = allClients.filter((client: IClient) =>
    client.name !== EXCLUDED_CLIENT_NAME &&
    client.active &&
    Array.isArray(client.achievements) &&
    client.achievements.length > 0 &&
    client.rewardsPerAchievement &&
    Object.keys(client.rewardsPerAchievement).length > 0
  );


  return (
    <Drawer>
      <DrawerTrigger>
        <Flex direction={'row'} justify={'center'} align={'center'} gap={'6'} mx={'4'}>
          <Box position={'relative'} height={'70px'} width={'200px'}>
            <Image
              src={currentClient.logo} 
              alt={currentClient.name || "Location logo"}
              fill
              priority
              style={{objectFit: 'contain'}}
            />
          </Box>
          {filteredClients.length > 1 && (
            <ChevronDownIcon width={'20px'} height={'20px'}/>
          )}
          
        </Flex>
      </DrawerTrigger>
      <DrawerContent className="bg-gray-800 shadow-[0_-2px_8px_rgba(0,0,0,0.5)] border-t-0 data-[vaul-drawer-direction=bottom]:border-t-0 data-[vaul-drawer-direction=bottom]:rounded-t-lg [&>div.bg-muted]:hidden">
      <Flex direction={'column'} justify={'center'} align={'center'} style={{paddingTop: '30px', paddingBottom: '100px'}}>
          <DrawerHeader>
            <DrawerTitle className="text-white text-2xl font-semibold">Select a location</DrawerTitle>
            <VisuallyHidden>
              <DrawerDescription>Select a location</DrawerDescription>
            </VisuallyHidden>
          </DrawerHeader>

          <Flex direction="column" gap="4" mt={'5'} style={{marginTop: '30px'}}>
            {filteredClients.map((client: IClient) => (
              <DrawerClose asChild key={client._id.toString()}>
                <Card onClick={() => handleSelectLocation(client)}>
                  <Flex direction={'column'} align="center" style={{marginBottom: '30px'}}>
                    <Box position={'relative'} height={'70px'} width={'200px'}>
                      <Image
                        src={client.logo}
                        alt={`${client.name} logo`}
                        fill
                        style={{objectFit: 'contain'}}
                      />
                    </Box>
                  </Flex>
                </Card>
              </DrawerClose>
            ))}
          </Flex>

        </Flex>
      </DrawerContent>
    </Drawer>
  )
}
