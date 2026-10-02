export default function WatchLoading() {
  return (
    <div className="max-w-[1720px] mx-auto px-3 sm:px-4 lg:px-6 py-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="aspect-video rounded-xl skeleton" />
          <div className="mt-4 h-6 rounded skeleton w-3/4" />
          <div className="mt-2 h-4 rounded skeleton w-1/3" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-40 aspect-video rounded-xl skeleton shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 rounded skeleton w-11/12" />
                <div className="h-3 rounded skeleton w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
