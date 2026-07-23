import HeaderV2 from '@/components/layout/HeaderV2';
import HeroV2 from '@/components/home/HeroV2';
import TrustedBrands from '@/components/home/TrustedBrands';
import WhyOrbit from '@/components/home/WhyOrbit';
import FeaturedShowcase from '@/components/home/FeaturedShowcase';
// سيتم إضافتها
import CategoriesV2 from '@/components/home/CategoriesV2';

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
  <HeaderV2 />

  <div className="pt-[74px] lg:pt-[106px]">
    <HeroV2 />
    <TrustedBrands />
    <CategoriesV2 />
    <WhyOrbit />
    <FeaturedShowcase />
  </div>
</main>
  );
}
