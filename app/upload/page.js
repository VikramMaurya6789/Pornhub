'use client';
import { useState } from 'react';
import { IconDownload, IconCheck } from '../../components/Icons';

export default function UploadPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title) return;

    setUploading(true);
    // In production, this would upload to a storage service
    // For now, simulate upload
    setTimeout(() => {
      setUploading(false);
      setDone(true);
    }, 2000);
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#ff9900]/15 flex items-center justify-center mx-auto mb-4">
          <IconCheck size={32} className="text-[#ff9900]" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Upload Complete!</h1>
        <p className="text-neutral-400">Your video has been submitted for review.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-black text-white mb-2 flex items-center gap-3">
        <IconDownload size={28} className="text-[#ff9900]" />
        Upload Video
      </h1>
      <p className="text-neutral-400 text-sm mb-8">Share your content with the OrangeHub community.</p>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#141414] border border-[#222] rounded-2xl p-6">
        <div>
          <label className="block text-sm font-bold text-white mb-2">Video File</label>
          <div className="border-2 border-dashed border-[#2a2a2a] rounded-xl p-8 text-center hover:border-[#ff9900]/50 transition-colors">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="video-file"
            />
            <label htmlFor="video-file" className="cursor-pointer">
              <IconDownload size={32} className="text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-300">
                {file ? file.name : 'Click to select video file'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">MP4, WebM, or MOV (max 2GB)</p>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your video..."
            rows={4}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9900] resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#ff9900]"
          >
            <option value="">Select category</option>
            <option value="amateur">Amateur</option>
            <option value="professional">Professional</option>
            <option value="homemade">Homemade</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={uploading || !file || !title}
          className="w-full py-3 rounded-xl bg-[#ff9900] hover:bg-[#e68a00] disabled:bg-[#2a2a2a] disabled:text-neutral-500 text-black font-bold transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          By uploading, you confirm you are 18+ and own the rights to this content.
        </p>
      </form>
    </div>
  );
}
