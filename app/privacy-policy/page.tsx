import type { Metadata } from 'next';
import { Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Orbit Control Automation privacy policy. How we collect, use, and protect your personal information.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 pb-3 border-b border-navy-700">{title}</h2>
      <div className="text-slate-300 space-y-3 leading-relaxed text-sm">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="bg-navy-800 border-b border-navy-700">
        <div className="page-container py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gold-500/10 border border-gold-500/20 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-gold-500" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-slate-400">Last updated: January 2025</p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="max-w-3xl">
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 mb-10">
            <p className="text-sm text-slate-300 leading-relaxed">
              At Orbit Control Automation (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or submit inquiries to us.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <p>We may collect the following types of information:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Name and company name',
                'Email address',
                'Phone number / WhatsApp number',
                'Country of residence or business',
                'Part numbers and product inquiries',
                'IP address and browser information (through cookies)',
                'Any information you voluntarily provide in messages or forms',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Respond to RFQ requests and provide price quotations',
                'Process orders and communicate order status',
                'Send shipping and tracking information',
                'Improve our website and services',
                'Comply with legal and regulatory obligations',
                'Send relevant product updates (only with your consent)',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p>We do not sell, trade, or rent your personal information to third parties.</p>
          </Section>

          <Section title="3. Data Sharing">
            <p>We may share your information with:</p>
            <p><strong className="text-slate-200">Shipping Partners:</strong> DHL and FedEx require shipping address and contact details to deliver your order.</p>
            <p><strong className="text-slate-200">Payment Processors:</strong> We use secure third-party payment processing. We do not store credit card information.</p>
            <p><strong className="text-slate-200">Legal Requirements:</strong> We may disclose information if required by law, court order, or government request.</p>
          </Section>

          <Section title="4. Cookies">
            <p>Our website may use cookies to enhance your browsing experience. Cookies are small files stored on your device that help us understand how visitors use our site. You can control cookie settings through your browser preferences.</p>
          </Section>

          <Section title="5. Data Security">
            <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, loss, or misuse. Our website uses SSL/TLS encryption for all data transmission.</p>
            <p>However, no internet transmission is completely secure. We cannot guarantee the absolute security of information transmitted online.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, or as required by applicable law. RFQ and order records are typically retained for 7 years for accounting and legal purposes.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Request access to your personal data we hold',
                'Request correction of inaccurate information',
                'Request deletion of your personal data',
                'Opt out of marketing communications at any time',
                'Lodge a complaint with a relevant data protection authority',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="8. Third-Party Links">
            <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies independently.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated &ldquo;last updated&rdquo; date. Continued use of our website after changes constitutes acceptance of the revised policy.</p>
          </Section>

          <Section title="10. Contact Us">
            <p>For privacy-related inquiries or to exercise your rights:</p>
            <p>Email: <a href="mailto:info@orbit-surplus.com" className="text-gold-500 hover:text-gold-400">info@orbit-surplus.com</a></p>
            <p>Orbit Control Automation, United Arab Emirates</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
