import Link from 'next/link';

export const metadata = {
  title: '18 U.S.C. §2257 Compliance Statement | OrangeHub',
  description: 'OrangeHub 18 U.S.C. §2257 record-keeping compliance statement.',
};

export default function Page2257() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black text-white mb-6">18 U.S.C. §2257 Compliance Statement</h1>
      <div className="prose prose-invert max-w-none text-neutral-300 text-sm leading-relaxed space-y-4">
        <p>
          OrangeHub is not the producer (as defined in 18 U.S.C. §2257 and 28 C.F.R. Part 75) of any of the
          visual depictions of actual sexually explicit conduct appearing on this website. OrangeHub's activities
          with respect to such content are limited to the transmission, storage, retrieval, hosting, and/or
          formatting of content posted by third-party users.
        </p>
        <p>
          All models, actors, actresses, and other persons that appear in any visual depiction of actual sexually
          explicit conduct appearing on this website were over the age of eighteen (18) years at the time such
          depictions were created.
        </p>
        <p>
          Records required to be maintained pursuant to 18 U.S.C. §2257 and 28 C.F.R. Part 75 by any producer of
          such content are kept by the respective third-party uploaders and/or original producers of such content.
        </p>
        <p>
          If you are the copyright owner of any content on this site and have not authorized its use, or if you
          believe any content violates applicable law, please contact us via our{' '}
          <Link href="/dmca" className="text-[#ff9900] hover:underline">DMCA / Content Removal</Link> page.
        </p>
        <p className="text-neutral-500 text-xs pt-4 border-t border-[#222]">
          Last updated: October 10, 2026
        </p>
      </div>
    </div>
  );
}
