'use client';

import { Flex } from "@radix-ui/themes";
import Link from "next/link";

export default function GGAdminSidebar() {

  return (
    <Flex direction={'column'} width={'250px'} py={'4'} px={'2'} style={{backgroundColor: '#F1F1F1', borderRight: '1px solid #d3d3d3'}}>
      <Flex direction={'column'} gap={'3'} px={'2'}>
        <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
          <Link href={'/admin/gg/sync'}>Sync</Link>
        </Flex>
        <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
          <Link href={'/admin/gg/config'}>Configure clients</Link>
        </Flex>
      </Flex>
    </Flex>
  )
}

