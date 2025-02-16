import TopBanner from "../components/Sections/TopBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <section>
        <TopBanner />
        {children}
      </section>
    </html>
  );
}