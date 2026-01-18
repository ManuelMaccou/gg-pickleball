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
import { Box, Card, ChevronDownIcon, Flex, Spinner, VisuallyHidden } from "@radix-ui/themes"
import Image from "next/image";
import { SelectableItem } from "../types/frontendTypes";

interface LocationDrawerProps {
  allSelectableItems: SelectableItem[];
  currentItem: SelectableItem | null; // Can be null during initial load
  onItemChange: (item: SelectableItem) => void;
}

export default function LocationDrawer({ allSelectableItems, currentItem, onItemChange }: LocationDrawerProps) {

  const handleSelectItem = (item: SelectableItem) => {
    document.cookie = `lastLocation=${item._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    onItemChange(item);
  };

  console.log('LocationDrawer received currentItem:', currentItem);

  // Handle loading state gracefully
  if (!currentItem) {
    return <Spinner/>;
  }


  return (
    <Drawer>
      <DrawerTrigger>
        <Flex direction={'row'} justify={'center'} align={'center'} gap={'6'} mx={'4'}>
          <Box position={'relative'} height={'70px'} width={'200px'}>
            <Image
              src={currentItem.displayIcon} 
              alt={currentItem.name || "Location logo"}
              fill
              priority
              style={{objectFit: 'contain'}}
            />
          </Box>
          {allSelectableItems.length > 1 && (
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
            {allSelectableItems.map((item: SelectableItem) => (
              <DrawerClose asChild key={item._id}>
                {/* 3. UPDATE ONCLICK HANDLER */}
                <Card onClick={() => handleSelectItem(item)}>
                  <Flex direction={'column'} align="center" style={{marginBottom: '30px'}}>
                    <Box position={'relative'} height={'70px'} width={'200px'}>
                      {/* 4. UPDATE IMAGE SOURCE IN THE LIST */}
                      <Image
                        src={item.displayIcon}
                        alt={`${item.name} logo`}
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
