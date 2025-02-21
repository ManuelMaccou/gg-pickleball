'use client'

import { useUser } from "@auth0/nextjs-auth0"
import { Avatar, Flex, Text } from '@radix-ui/themes'

export default function RegistrationBanner() {
  const { user, isLoading } = useUser()

  if (isLoading) return null

  return (
    <Flex direction="column" align="end" px={'9'} py={'4'}>
      <a href="/auth/logout">Log out</a>
      <Flex direction="row" gap={'4'} align={'center'}>
        <Avatar
          radius="full"
          src={user?.picture} alt={user?.name ?? 'User'}
          fallback={user?.name?.[0] ?? 'A'}
        />
        <Text weight={'medium'}>{user?.name ?? user?.email}</Text>
      </Flex>
    </Flex>
  )
}
