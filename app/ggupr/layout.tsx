import { Theme } from '@radix-ui/themes'
import { Viewport } from 'next'
import { ReactNode } from 'react'


interface LayoutProps {
  children: ReactNode
}

export const viewport: Viewport = {
  themeColor: 'linear-gradient(135deg,rgb(5, 21, 94), #4895FC)',
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <Theme appearance="dark" accentColor="yellow">
      <div style={{ background: 'linear-gradient(135deg,rgb(5, 21, 94), #4895FC)' }}>
        {children}
      </div>
    </Theme>
  )
}

export default Layout