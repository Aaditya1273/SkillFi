import { Search, FileText, CreditCard, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Find Projects',
    description: 'Browse through thousands of projects or post your own to find the perfect match.',
  },
  {
    icon: FileText,
    title: 'Submit Proposals',
    description: 'Send detailed proposals with your portfolio and timeline to stand out.',
  },
  {
    icon: CreditCard,
    title: 'Secure Payment',
    description: 'Funds are held in smart contract escrow until project milestones are met.',
  },
  {
    icon: CheckCircle,
    title: 'Get Paid',
    description: 'Receive instant payment upon successful completion and client approval.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How SkillFi Works
          </h2>
          <p className="text-lg text-gray-600">
            Simple, secure, and transparent freelancing process
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-8 h-8 text-primary-600" />
              </div>
              <div className="text-sm font-semibold text-primary-600 mb-2">
                STEP {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-gray-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="btn-primary text-lg px-8 py-3">
            Get Started Today
          </button>
        </div>
      </div>
    </section>
  );
}