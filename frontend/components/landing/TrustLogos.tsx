export default function TrustLogos() {
  const logos = ["Google", "Microsoft", "coinbase", "Spotify"];
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Companies hiring on SkillFi</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center">
          {logos.map((name) => (
            <div key={name} className="h-10 flex items-center justify-center rounded bg-white border">
              <span className="text-gray-600 font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
