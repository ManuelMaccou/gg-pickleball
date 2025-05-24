'use client'

import { createContext, useContext, useState } from 'react'

export type ClientUser = {
  id: string
  name: string
  email?: string
  isGuest: boolean
} | null

type UserContextType = {
  user: ClientUser
  setUser: (user: ClientUser) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider = ({ children, initialUser }: { children: React.ReactNode; initialUser: ClientUser }) => {
  const [user, setUser] = useState<ClientUser>(initialUser)
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext)
  if (!context) {
    return {
      user: { id: '', name: '', isGuest: false },
      setUser: () => {},
    }
  }
  return context
}
