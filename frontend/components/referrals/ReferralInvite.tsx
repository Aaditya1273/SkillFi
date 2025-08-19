'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Copy, Check } from 'lucide-react';

const ReferralInvite = () => {
  const { data: session } = useSession();
  const [referralData, setReferralData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const fetchReferralData = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/referrals/me'); // This needs to be implemented as a frontend API route proxying to the backend
      if (!response.ok) {
        throw new Error('Failed to fetch referral data');
      }
      const data = await response.json();
      setReferralData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/referrals/generate', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to generate code');
      }
      const data = await response.json();
      setReferralData(prev => ({ ...prev, referralCode: data }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [session]);

  const handleCopy = () => {
    if (referralData?.referralCode?.referralLink) {
      navigator.clipboard.writeText(referralData.referralCode.referralLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (isLoading) return <p>Loading referral info...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="p-6 bg-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Refer & Earn</h2>
      {referralData?.referralCode ? (
        <div>
          <p className="mb-2">Share your referral link to earn tokens:</p>
          <div className="flex items-center gap-2 p-2 bg-gray-900 rounded">
            <input 
              type="text" 
              readOnly 
              value={referralData.referralCode.referralLink} 
              className="flex-grow bg-transparent focus:outline-none"
            />
            <button onClick={handleCopy} className="p-2 hover:bg-gray-700 rounded">
              {isCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">You have referred {referralData.referralCount || 0} users.</p>
        </div>
      ) : (
        <div>
          <p className="mb-4">You don't have a referral code yet.</p>
          <button onClick={generateCode} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
            Generate My Code
          </button>
        </div>
      )}

      {referralData?.referralsMade?.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold">Your Referrals:</h3>
          <ul className="mt-2 space-y-2">
            {referralData.referralsMade.map(ref => (
              <li key={ref.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                <img src={ref.referee.avatar || '/default-avatar.png'} alt={ref.referee.username} className="w-8 h-8 rounded-full" />
                <span>{ref.referee.username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ReferralInvite;
