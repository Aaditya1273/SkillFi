export default function Showcase() {
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Find the perfect freelancer</h2>
          <p className="text-gray-600 mb-6">Our platform connects businesses with talented web3 freelancers to get work done faster and safer.</p>
          <ul className="space-y-2 text-gray-700">
            <li>• On-chain escrow and milestone releases</li>
            <li>• Wallet + Web2 login with SIWE</li>
            <li>• DAO governance ready and reputation scoring</li>
          </ul>
        </div>
        <div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex gap-2 mb-3">
              <div className="h-6 w-20 bg-gray-100 rounded" />
              <div className="h-6 w-16 bg-gray-100 rounded" />
              <div className="h-6 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-40 w-full bg-gray-50 rounded" />
          </div>
        </div>
      </div>
    </section>
  );
}
