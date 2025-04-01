import { Theme } from '@radix-ui/themes'
import { ReactNode } from 'react'


interface LayoutProps {
  children: ReactNode
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