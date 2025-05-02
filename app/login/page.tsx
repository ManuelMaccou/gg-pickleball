'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Preserve `iss` parameter from OIDC third-party login spec
    const iss = searchParams.get('iss')
    const loginUrl = iss
      ? `/auth/login?iss=${encodeURIComponent(iss)}`
      : '/auth/login'

    router.push(loginUrl)
  }, [router, searchParams])

  return <p>Redirecting to login...</p>
}

export default function Login() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
