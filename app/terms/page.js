import { IconAlert } from '../../components/Icons';

export const metadata = {
  title: 'Terms of Use',
  description: 'OrangeHub Terms of Use — 18+ strict age requirement, third-party content disclaimer, and user terms.',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
          Terms of Use
        </h1>
        <p className="text-sm text-neutral-400">
          Last revised: September 2026
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#1c1408] border border-[#ff9900]/30 mb-8 flex items-start gap-3">
        <IconAlert size={22} className="text-[#ff9900] shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-300 leading-relaxed">
          <strong className="text-white">Age Restriction (18+ Only):</strong> You must be at least 18 years of age (or the age of majority in your jurisdiction) to access or view any material on OrangeHub.
        </div>
      </div>

      <div className="space-y-6 text-sm text-neutral-300 leading-relaxed">
        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing or browsing this website, you confirm that you have read, understood, and agreed to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree, you must immediately exit and discontinue use of the site.
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">2. Adult Content &amp; Age Certification</h2>
          <p>
            OrangeHub indexes adult material intended exclusively for consenting adults. By entering, you explicitly swear and affirm under penalty of law that:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-300">
            <li>You are at least 18 years old (or the legal age of majority in your territory).</li>
            <li>Adult content of this nature is legal in the country, state, and community where you reside and access this site.</li>
            <li>You will not permit minors or unauthorized individuals to view or access this content.</li>
          </ul>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">3. Third-Party Content &amp; Indexing Disclaimer</h2>
          <p>
            All videos, titles, previews, models, and metadata listed on OrangeHub belong to their respective copyright owners and creators. Content is indexed and aggregated automatically from publicly available internet sources.
          </p>
          <p>
            OrangeHub does not host, encode, store, or own the video files or intellectual property depicted. We operate as an informational directory and search engine. Any copyright concerns should be addressed to the respective source host or submitted through our DMCA procedure.
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">4. 18 U.S.C. § 2257 Record-Keeping Compliance Notice</h2>
          <p>
            OrangeHub is not a producer (primary or secondary) of any visual content depicted on this site. All content is produced and hosted by third parties. For all content displayed on this website, the records required pursuant to 18 U.S.C. § 2257 and 28 C.F.R. Part 75 are maintained by the respective original producers and uploaders at the source repositories.
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">5. Limitation of Liability</h2>
          <p>
            This service is provided &ldquo;as is&rdquo; without warranties of any kind, whether express or implied. In no event shall OrangeHub, its operators, or affiliates be liable for any damages arising out of the use or inability to use this service.
          </p>
        </section>
      </div>
    </div>
  );
}
