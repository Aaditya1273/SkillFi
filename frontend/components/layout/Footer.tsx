import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold">SkillFi</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              The decentralized freelance marketplace where talent meets opportunity. 
              Secure, transparent, and powered by blockchain technology.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white">Twitter</a>
              <a href="#" className="text-gray-400 hover:text-white">Discord</a>
              <a href="#" className="text-gray-400 hover:text-white">GitHub</a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="font-semibold mb-4">Platform</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/projects" className="hover:text-white">Browse Projects</Link></li>
              <li><Link href="/freelancers" className="hover:text-white">Find Talent</Link></li>
              <li><Link href="/how-it-works" className="hover:text-white">How It Works</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2024 SkillFi. All rights reserved.
          </p>
          <p className="text-gray-400 text-sm mt-2 md:mt-0">
            Built with ❤️ on the blockchain
          </p>
        </div>
      </div>
    </footer>
  );
}