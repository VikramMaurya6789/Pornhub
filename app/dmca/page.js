'use client';
import { useState } from 'react';
import { IconAlert, IconSend } from '../../components/Icons';

export default function DmcaPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [senderName, setSenderName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const dmcaContact = 'vikrammauryayt08@gmail.com';

  const handleSendReport = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`DMCA Takedown Notice - ${videoUrl || 'OrangeHub'}`);
    const body = encodeURIComponent(
      `DMCA TAKEDOWN NOTICE\n\n` +
      `Infringing URL / Content: ${videoUrl}\n` +
      `Copyright Owner / Representative: ${senderName}\n` +
      `Contact Email: ${contactEmail}\n\n` +
      `Infringement Details:\n${description}\n\n` +
      `Statement of Good Faith:\nI state under penalty of perjury that the information in this notification is accurate and that I am the copyright owner or authorized to act on behalf of the owner.\n`
    );
    window.location.href = `mailto:${dmcaContact}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
          DMCA / Copyright Takedown Policy
        </h1>
        <p className="text-sm text-neutral-400">
          Last revised: September 2026
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#1c1408] border border-[#ff9900]/30 mb-8 flex items-start gap-3">
        <IconAlert size={22} className="text-[#ff9900] shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-300 leading-relaxed">
          <strong className="text-white">Third-Party Content Disclaimer:</strong> OrangeHub is an automated search engine and indexing tool. All video content and thumbnails are hosted entirely by external third parties. OrangeHub does not host, upload, or encode video files on its servers.
        </div>
      </div>

      <div className="space-y-6 text-sm text-neutral-300 leading-relaxed">
        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">Notice and Procedure for Making Claims of Copyright Infringement</h2>
          <p>
            OrangeHub respects the intellectual property rights of others and complies with the Digital Millennium Copyright Act (17 U.S.C. § 512). If you believe your copyrighted work has been indexed in a way that constitutes infringement, please submit a formal DMCA notice.
          </p>
          <p>
            Official DMCA Designated Agent Email:{' '}
            <a
              href="mailto:vikrammauryayt08@gmail.com"
              className="font-mono text-[#ff9900] bg-black/60 px-2 py-0.5 rounded border border-[#ff9900]/20 hover:underline"
            >
              vikrammauryayt08@gmail.com
            </a>
          </p>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5 space-y-3">
          <h2 className="text-lg font-bold text-white">Required Information for DMCA Notice</h2>
          <ul className="list-disc pl-5 space-y-2 text-neutral-300">
            <li>An electronic or physical signature of the person authorized to act on behalf of the owner of the copyright interest.</li>
            <li>A description of the copyrighted work that you claim has been infringed.</li>
            <li>The exact URL on OrangeHub and original URL where the allegedly infringing material is located.</li>
            <li>Your address, telephone number, and email address.</li>
            <li>A statement that you have a good faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement made under penalty of perjury that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner&apos;s behalf.</li>
          </ul>
        </section>

        <section className="bg-[#121212] p-6 rounded-2xl border border-white/5">
          <h2 className="text-lg font-bold text-white mb-4">Direct DMCA Report Form</h2>
          <form onSubmit={handleSendReport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Infringing Video URL or ID *
              </label>
              <input
                type="text"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://orangehub.royalcloud.qzz.io/watch/... or upstream URL"
                className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff9900]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Your Full Name or Organization *
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Copyright owner or agent name"
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff9900]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Contact Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff9900]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Description of Copyright Infringement *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your copyrighted work, original registration or proof of ownership, and the specific infringement details..."
                className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff9900] resize-y"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff9900] hover:bg-[#ffa826] text-black font-bold text-sm transition-colors cursor-pointer shadow-lg shadow-[#ff9900]/20 active:scale-95"
            >
              <IconSend size={16} />
              <span>Send DMCA Notice via Email</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
