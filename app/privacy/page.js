import { IconAlert } from '../../components/Icons';

export const metadata = {
  title: 'Privacy Policy',
  description: 'OrangeHub Privacy Policy — No-login, anonymous UID, zero personal data collection.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-400">
          Last revised: September 2026
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#121212] border border-white/5 mb-8 flex items-start gap-3">
        <IconAlert size={22} className="text-[#ff9900] shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-300 leading-relaxed">
          <strong className="text-white">Privacy First Architecture:</strong> OrangeHub requires zero registration, zero accounts, and collects no personally identifiable information (PII).
        </div>
      </div>

      <div className="space-y-6 text-sm text-neutral-300 leading-relaxed">
        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">1. No User Accounts &amp; Anonymous UID</h2>
          <p>
            You do not need to register an account, log in, or provide your email address to use OrangeHub.
          </p>
          <p>
            To provide personal client-side utilities such as Watch Later, Favorites, and Watch History progress, OrangeHub generates an anonymous, random UUID stored in your browser&apos;s local storage (<code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">oh_uid</code>). This identifier is completely pseudonymous and is never linked to your personal identity, IP address, or external credentials.
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">2. Reverse Proxying for Thumbnails and Media</h2>
          <p>
            To protect your privacy and shield your client IP address from third-party advertising networks and trackers, images and media segments are requested through our server-side reverse proxy endpoints (<code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">/api/img</code> and <code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">/api/seg</code>).
          </p>
          <p>
            Your browser does not establish direct connections to untrusted upstream tracking networks when viewing cached image assets.
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">3. Cookies &amp; Local Storage</h2>
          <p>
            OrangeHub does not use third-party advertising cookies or cross-site tracking pixels. All thumbnails and media streams are proxied server-side to protect your IP address. We use browser LocalStorage and essential cookies strictly for core site operations and your chosen functional preferences:
          </p>
          <ul className="list-disc pl-5 space-y-2.5 text-neutral-300">
            <li>
              <strong className="text-white">Age Verification Flag (<code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">oh_age_ok</code>):</strong> Remembers that you verified being 18 years or older so you are not prompted repeatedly on every page load.
            </li>
            <li>
              <strong className="text-white">Cookie Consent Preferences (<code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">oh_cookie_consent</code>):</strong> Saves your chosen cookie preferences (essential, functional, and analytics) so we honor your privacy choices.
            </li>
            <li>
              <strong className="text-white">Anonymous User ID (<code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">oh_uid</code>):</strong> A pseudonymous, random client-side UUID used strictly for your saved Favorites, Continue Watching progress, and Watch History. If you reject functional cookies, this key is never persisted.
            </li>
            <li>
              <strong className="text-white">Theater Mode Preference (<code className="text-[#ff9900] bg-black/60 px-1.5 py-0.5 rounded">oh_theater</code>):</strong> Remembers whether you prefer theater mode or standard layout for the video player.
            </li>
          </ul>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">4. Search Queries &amp; Analytics</h2>
          <p>
            Popular search terms are aggregated strictly in count form (<code className="text-[#ff9900] bg-black/60 px-1 rounded">SearchLog</code>) to calculate anonymous trending chips. We do not associate search queries with IP addresses or individual user records.
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">5. Data Deletion</h2>
          <p>
            Because your data is stored locally under an anonymous identifier, you can completely erase all your history and favorites at any time by clearing your browser&apos;s site data or clicking &ldquo;Clear History&rdquo; directly on the homepage and favorites screen.
          </p>
        </section>
      </div>
    </div>
  );
}
