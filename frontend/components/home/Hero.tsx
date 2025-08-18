import Link from 'next/link';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';

export function Hero() {
  return (
    <section className="bg-gradient-to-br from-primary-50 to-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            The Future of
            <span className="text-primary-600"> Freelancing</span>
            <br />
            is Decentralized
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Connect with global talent on a secure, transparent blockchain platform. 
            No middlemen, lower fees, instant payments.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/projects" className="btn-primary text-lg px-8 py-3 inline-flex items-center">
              Browse Projects
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/freelancers" className="btn-secondary text-lg px-8 py-3">
              Find Talent
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Escrow</h3>
              <p className="text-gray-600">Smart contracts ensure safe payments for both parties</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Payments</h3>
              <p className="text-gray-600">Get paid immediately upon project completion</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Global Access</h3>
              <p className="text-gray-600">Work with anyone, anywhere, without restrictions</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}