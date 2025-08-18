export function Stats() {
  const stats = [
    { label: 'Active Projects', value: '2,500+' },
    { label: 'Freelancers', value: '10,000+' },
    { label: 'Total Paid Out', value: '$2.5M+' },
    { label: 'Success Rate', value: '98%' },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                {stat.value}
              </div>
              <div className="text-gray-600 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}