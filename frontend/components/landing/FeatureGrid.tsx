export default function FeatureGrid() {
  const features = [
    {
      title: "World‑class talent",
      desc: "Find verified web3 developers, designers, and auditors",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>
      )
    },
    {
      title: "Save time",
      desc: "Post a job and receive proposals in minutes",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6v6l4 2"/></svg>
      )
    },
    {
      title: "Get work done",
      desc: "Escrow, milestones, and dispute resolution built‑in",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary-600" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4"/></svg>
      )
    }
  ];

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
              {f.icon}
            </div>
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-gray-600 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
