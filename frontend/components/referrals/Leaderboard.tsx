'use client';

import { useState, useEffect } from 'react';

// Types
type Timeframe = 'all' | 'month' | 'week';

type LeaderboardUser = {
  id: string | number;
  username: string;
  avatar?: string | null;
  referralCount: number;
};

type LeaderboardResponse = {
  leaderboard: LeaderboardUser[];
};

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/leaderboard?timeframe=${timeframe}`); // This also needs a proxy route
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        const data = (await response.json()) as LeaderboardResponse;
        setLeaderboard(data.leaderboard ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [timeframe]);

  if (isLoading) return <p>Loading leaderboard...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="p-6 bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Top Referrers</h2>
        <select 
          value={timeframe}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setTimeframe(e.target.value as Timeframe)
          }
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
        >
          <option value="all">All Time</option>
          <option value="month">This Month</option>
          <option value="week">This Week</option>
        </select>
      </div>
      {leaderboard.length > 0 ? (
        <ul className="space-y-3">
          {leaderboard.map((user, index) => (
            <li key={user.id} className="flex items-center justify-between p-3 bg-gray-700 rounded">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">{index + 1}</span>
                <img src={user.avatar || '/default-avatar.png'} alt={user.username} className="w-10 h-10 rounded-full" />
                <span className="font-semibold">{user.username}</span>
              </div>
              <span className="font-bold text-green-400">{user.referralCount} referrals</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No referrals recorded for this period yet.</p>
      )}
    </div>
  );
};

export default Leaderboard;
