import HeroEnterprise from "@/components/enterprise/HeroEnterprise";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise Preview",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EnterprisePreviewPage() {
  return (
    <main className="min-h-screen bg-[#030712]">
      <HeroEnterprise />
    </main>
  );
}
