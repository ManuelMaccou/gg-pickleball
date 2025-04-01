import { Theme } from '@radix-ui/themes'
import { ReactNode } from 'react'


interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <Theme appearance="dark" accentColor="yellow">
      <div style={{ background: 'linear-gradient(135deg,rgb(4, 19, 86),rgb(1, 107, 245))' }}>
        {children}
      </div>
    </Theme>
  )
}

export default Layout