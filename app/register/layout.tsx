import { auth0 } from '@/lib/auth0'
import { redirect } from 'next/navigation'
import RegistrationBanner from "../components/Sections/RegistrationBanner";

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession()

  if (!session) {
    redirect('/auth/login')
  }  

  return (
    <>
      <RegistrationBanner />
      {children}
    </>
  );
}
