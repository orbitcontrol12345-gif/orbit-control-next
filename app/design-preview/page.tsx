import HeroV2 from '@/components/home/HeroV2';

export const metadata = {
  title: 'Orbit Control V2 Preview',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignPreviewPage() {
  return (
    <main className="min-h-screen bg-[#030914]">
      <HeroV2 />
    </main>
  );
}
