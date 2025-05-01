"use client"

import * as React from "react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Box, Button, Card, ChevronDownIcon, Flex, VisuallyHidden } from "@radix-ui/themes"
import { IClient } from "../types/databaseTypes";
import Image from "next/image";

interface LocationDrawerProps {
  allClients: IClient[];
}

export default function LocationDrawer({ allClients }: LocationDrawerProps) {


  return (
    <Drawer>
      <DrawerTrigger asChild>
      <Button variant="ghost">
        <ChevronDownIcon width={'20px'} height={'20px'}/>
      </Button>
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
            {allClients.map((client: IClient) => (
              <Card key={client._id.toString()}>
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
            ))}
          </Flex>

        </Flex>
      </DrawerContent>
    </Drawer>
  )
}
