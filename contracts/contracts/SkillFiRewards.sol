// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SkillToken.sol";
import "./SkillFiEscrow.sol";

/**
 * @title SkillFiRewards
 * @dev Advanced reward system with loyalty programs, referrals, and achievement NFTs
 */
contract SkillFiRewards is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    SkillToken public immutable skillToken;
    SkillFiEscrow public immutable escrow;
    
    // Loyalty tiers
    enum LoyaltyTier {
        Bronze,    // 0-10 projects
        Silver,    // 11-50 projects
        Gold,      // 51-100 projects
        Platinum,  // 101-250 projects
        Diamond    // 250+ projects
    }
    
    // Achievement types
    enum AchievementType {
        FirstProject,
        ProjectStreak,
        HighRating,
        VolumeTrader,
        CommunityHelper,
        EarlyAdopter,
        Specialist,
        Mentor
    }
    
    struct UserRewards {
        uint256 totalEarned;
        uint256 referralRewards;
        uint256 loyaltyPoints;
        LoyaltyTier tier;
        uint256 streak;
        uint256 lastActivityTime;
        address referrer;
        uint256 referralCount;
        mapping(AchievementType => bool) achievements;
        mapping(AchievementType => uint256) achievementTimestamps;
    }
    
    struct RewardPool {
        uint256 dailyRewards;
        uint256 weeklyRewards;
        uint256 monthlyRewards;
        uint256 lastDistribution;
        uint256 totalDistributed;
    }
    
    struct ReferralProgram {
        uint256 referrerReward;    // Reward for referrer
        uint256 refereeReward;     // Reward for new user
        uint256 minProjectValue;   // Minimum project value to qualify
        uint256 maxRewardPerUser;  // Maximum total referral rewards per user
        bool isActive;
    }
    
    mapping(address => UserRewards) public userRewards;
    mapping(LoyaltyTier => uint256) public tierMultipliers; // Basis points
    mapping(AchievementType => uint256) public achievementRewards;
    mapping(address => mapping(uint256 => bool)) public dailyClaimed; // user => day => claimed
    
    RewardPool public rewardPool;
    ReferralProgram public referralProgram;
    
    uint256 public constant POINTS_PER_PROJECT = 100;
    uint256 public constant STREAK_BONUS_MULTIPLIER = 110; // 10% bonus per streak (max 5x)
    uint256 public constant MAX_STREAK_MULTIPLIER = 500; // 5x max
    uint256 public constant DAILY_REWARD_BASE = 10 * 10**18; // 10 SKILL per day
    
    // Events
    event RewardClaimed(address indexed user, uint256 amount, string rewardType);
    event AchievementUnlocked(address indexed user, AchievementType achievement, uint256 reward);
    event ReferralReward(address indexed referrer, address indexed referee, uint256 amount);
    event LoyaltyTierUpgraded(address indexed user, LoyaltyTier newTier);
    event StreakUpdated(address indexed user, uint256 newStreak);
    
    constructor(
        address _skillToken,
        address _escrow
    ) {
        skillToken = SkillToken(_skillToken);
        escrow = SkillFiEscrow(_escrow);
        
        // Initialize tier multipliers (basis points)
        tierMultipliers[LoyaltyTier.Bronze] = 10000;   // 1x
        tierMultipliers[LoyaltyTier.Silver] = 11000;   // 1.1x
        tierMultipliers[LoyaltyTier.Gold] = 12500;     // 1.25x
        tierMultipliers[LoyaltyTier.Platinum] = 15000; // 1.5x
        tierMultipliers[LoyaltyTier.Diamond] = 20000;  // 2x
        
        // Initialize achievement rewards
        achievementRewards[AchievementType.FirstProject] = 100 * 10**18;
        achievementRewards[AchievementType.ProjectStreak] = 250 * 10**18;
        achievementRewards[AchievementType.HighRating] = 500 * 10**18;
        achievementRewards[AchievementType.VolumeTrader] = 1000 * 10**18;
        achievementRewards[AchievementType.CommunityHelper] = 750 * 10**18;
        achievementRewards[AchievementType.EarlyAdopter] = 2000 * 10**18;
        achievementRewards[AchievementType.Specialist] = 1500 * 10**18;
        achievementRewards[AchievementType.Mentor] = 3000 * 10**18;
        
        // Initialize referral program
        referralProgram = ReferralProgram({
            referrerReward: 100 * 10**18,  // 100 SKILL
            refereeReward: 50 * 10**18,    // 50 SKILL
            minProjectValue: 1000 * 10**18, // 1000 SKILL minimum
            maxRewardPerUser: 10000 * 10**18, // 10,000 SKILL max
            isActive: true
        });
        
        // Initialize reward pool
        rewardPool.dailyRewards = 10000 * 10**18;  // 10,000 SKILL per day
        rewardPool.weeklyRewards = 100000 * 10**18; // 100,000 SKILL per week
        rewardPool.monthlyRewards = 500000 * 10**18; // 500,000 SKILL per month
        rewardPool.lastDistribution = block.timestamp;
    }
    
    /**
     * @dev Register referral relationship
     */
    function registerReferral(address referrer) external {
        require(referrer != msg.sender, "Cannot refer yourself");
        require(userRewards[msg.sender].referrer == address(0), "Already has referrer");
        require(referrer != address(0), "Invalid referrer");
        
        userRewards[msg.sender].referrer = referrer;
        userRewards[referrer].referralCount++;
    }
    
    /**
     * @dev Update user activity and calculate rewards (called by escrow)
     */
    function updateUserActivity(
        address user,
        uint256 projectValue,
        bool isCompleted
    ) external {
        require(msg.sender == address(escrow), "Only escrow can update");
        
        UserRewards storage rewards = userRewards[user];
        
        if (isCompleted) {
            // Update loyalty points and tier
            rewards.loyaltyPoints += POINTS_PER_PROJECT;
            _updateLoyaltyTier(user);
            
            // Update streak
            _updateStreak(user);
            
            // Check for achievements
            _checkAchievements(user, projectValue);
            
            // Process referral rewards
            _processReferralRewards(user, projectValue);
            
            // Calculate and mint completion rewards
            uint256 completionReward = _calculateCompletionReward(user, projectValue);
            if (completionReward > 0) {
                skillToken.mint(user, completionReward);
                rewards.totalEarned += completionReward;
                emit RewardClaimed(user, completionReward, "completion");
            }
        }
        
        rewards.lastActivityTime = block.timestamp;
    }
    
    /**
     * @dev Claim daily rewards
     */
    function claimDailyReward() external nonReentrant {
        uint256 currentDay = block.timestamp / 86400;
        require(!dailyClaimed[msg.sender][currentDay], "Already claimed today");
        
        UserRewards storage rewards = userRewards[msg.sender];
        require(rewards.loyaltyPoints > 0, "No activity to claim rewards");
        
        dailyClaimed[msg.sender][currentDay] = true;
        
        uint256 baseReward = DAILY_REWARD_BASE;
        uint256 tierMultiplier = tierMultipliers[rewards.tier];
        uint256 streakMultiplier = _getStreakMultiplier(rewards.streak);
        
        uint256 dailyReward = (baseReward * tierMultiplier * streakMultiplier) / (10000 * 100);
        
        skillToken.mint(msg.sender, dailyReward);
        rewards.totalEarned += dailyReward;
        
        emit RewardClaimed(msg.sender, dailyReward, "daily");
    }
    
    /**
     * @dev Claim achievement reward
     */
    function claimAchievement(AchievementType achievement) external nonReentrant {
        UserRewards storage rewards = userRewards[msg.sender];
        require(rewards.achievements[achievement], "Achievement not unlocked");
        require(rewards.achievementTimestamps[achievement] == 0, "Already claimed");
        
        rewards.achievementTimestamps[achievement] = block.timestamp;
        uint256 reward = achievementRewards[achievement];
        
        skillToken.mint(msg.sender, reward);
        rewards.totalEarned += reward;
        
        emit RewardClaimed(msg.sender, reward, "achievement");
    }
    
    /**
     * @dev Update loyalty tier based on points
     */
    function _updateLoyaltyTier(address user) internal {
        UserRewards storage rewards = userRewards[user];
        uint256 points = rewards.loyaltyPoints;
        LoyaltyTier newTier = rewards.tier;
        
        if (points >= 25000) { // 250+ projects
            newTier = LoyaltyTier.Diamond;
        } else if (points >= 10100) { // 101+ projects
            newTier = LoyaltyTier.Platinum;
        } else if (points >= 5100) { // 51+ projects
            newTier = LoyaltyTier.Gold;
        } else if (points >= 1100) { // 11+ projects
            newTier = LoyaltyTier.Silver;
        } else {
            newTier = LoyaltyTier.Bronze;
        }
        
        if (newTier != rewards.tier) {
            rewards.tier = newTier;
            emit LoyaltyTierUpgraded(user, newTier);
        }
    }
    
    /**
     * @dev Update user streak
     */
    function _updateStreak(address user) internal {
        UserRewards storage rewards = userRewards[user];
        
        // Check if last activity was within 7 days
        if (block.timestamp - rewards.lastActivityTime <= 7 days) {
            rewards.streak++;
        } else {
            rewards.streak = 1; // Reset streak
        }
        
        emit StreakUpdated(user, rewards.streak);
    }
    
    /**
     * @dev Check and unlock achievements
     */
    function _checkAchievements(address user, uint256 projectValue) internal {
        UserRewards storage rewards = userRewards[user];
        
        // First project achievement
        if (!rewards.achievements[AchievementType.FirstProject] && rewards.loyaltyPoints == POINTS_PER_PROJECT) {
            rewards.achievements[AchievementType.FirstProject] = true;
            emit AchievementUnlocked(user, AchievementType.FirstProject, achievementRewards[AchievementType.FirstProject]);
        }
        
        // Project streak achievement (10+ streak)
        if (!rewards.achievements[AchievementType.ProjectStreak] && rewards.streak >= 10) {
            rewards.achievements[AchievementType.ProjectStreak] = true;
            emit AchievementUnlocked(user, AchievementType.ProjectStreak, achievementRewards[AchievementType.ProjectStreak]);
        }
        
        // High rating achievement (4.8+ average rating)
        uint256 rating = escrow.getUserRating(user);
        if (!rewards.achievements[AchievementType.HighRating] && rating >= 48) { // 4.8 * 10
            rewards.achievements[AchievementType.HighRating] = true;
            emit AchievementUnlocked(user, AchievementType.HighRating, achievementRewards[AchievementType.HighRating]);
        }
        
        // Volume trader achievement (100,000+ SKILL total)
        if (!rewards.achievements[AchievementType.VolumeTrader] && rewards.totalEarned >= 100000 * 10**18) {
            rewards.achievements[AchievementType.VolumeTrader] = true;
            emit AchievementUnlocked(user, AchievementType.VolumeTrader, achievementRewards[AchievementType.VolumeTrader]);
        }
        
        // Community helper achievement (50+ referrals)
        if (!rewards.achievements[AchievementType.CommunityHelper] && rewards.referralCount >= 50) {
            rewards.achievements[AchievementType.CommunityHelper] = true;
            emit AchievementUnlocked(user, AchievementType.CommunityHelper, achievementRewards[AchievementType.CommunityHelper]);
        }
    }
    
    /**
     * @dev Process referral rewards
     */
    function _processReferralRewards(address user, uint256 projectValue) internal {
        if (!referralProgram.isActive || projectValue < referralProgram.minProjectValue) {
            return;
        }
        
        UserRewards storage userReward = userRewards[user];
        address referrer = userReward.referrer;
        
        if (referrer != address(0)) {
            UserRewards storage referrerReward = userRewards[referrer];
            
            // Check if referrer hasn't exceeded max rewards
            if (referrerReward.referralRewards < referralProgram.maxRewardPerUser) {
                uint256 reward = referralProgram.referrerReward;
                
                // Ensure doesn't exceed max
                if (referrerReward.referralRewards + reward > referralProgram.maxRewardPerUser) {
                    reward = referralProgram.maxRewardPerUser - referrerReward.referralRewards;
                }
                
                if (reward > 0) {
                    skillToken.mint(referrer, reward);
                    referrerReward.referralRewards += reward;
                    referrerReward.totalEarned += reward;
                    
                    emit ReferralReward(referrer, user, reward);
                }
            }
        }
    }
    
    /**
     * @dev Calculate completion reward based on tier and streak
     */
    function _calculateCompletionReward(address user, uint256 projectValue) internal view returns (uint256) {
        UserRewards storage rewards = userRewards[user];
        
        // Base reward: 1% of project value
        uint256 baseReward = projectValue / 100;
        
        // Apply tier multiplier
        uint256 tierMultiplier = tierMultipliers[rewards.tier];
        uint256 streakMultiplier = _getStreakMultiplier(rewards.streak);
        
        return (baseReward * tierMultiplier * streakMultiplier) / (10000 * 100);
    }
    
    /**
     * @dev Get streak multiplier (capped at 5x)
     */
    function _getStreakMultiplier(uint256 streak) internal pure returns (uint256) {
        if (streak == 0) return 100;
        
        uint256 multiplier = 100 + (streak * 10); // 10% per streak
        return multiplier > MAX_STREAK_MULTIPLIER ? MAX_STREAK_MULTIPLIER : multiplier;
    }
    
    /**
     * @dev Get user's current rewards info
     */
    function getUserRewardsInfo(address user) external view returns (
        uint256 totalEarned,
        uint256 loyaltyPoints,
        LoyaltyTier tier,
        uint256 streak,
        uint256 referralCount,
        bool canClaimDaily
    ) {
        UserRewards storage rewards = userRewards[user];
        uint256 currentDay = block.timestamp / 86400;
        
        return (
            rewards.totalEarned,
            rewards.loyaltyPoints,
            rewards.tier,
            rewards.streak,
            rewards.referralCount,
            !dailyClaimed[user][currentDay] && rewards.loyaltyPoints > 0
        );
    }
    
    /**
     * @dev Check if user has achievement
     */
    function hasAchievement(address user, AchievementType achievement) external view returns (bool) {
        return userRewards[user].achievements[achievement];
    }
    
    /**
     * @dev Admin functions
     */
    function updateReferralProgram(
        uint256 _referrerReward,
        uint256 _refereeReward,
        uint256 _minProjectValue,
        uint256 _maxRewardPerUser,
        bool _isActive
    ) external onlyOwner {
        referralProgram.referrerReward = _referrerReward;
        referralProgram.refereeReward = _refereeReward;
        referralProgram.minProjectValue = _minProjectValue;
        referralProgram.maxRewardPerUser = _maxRewardPerUser;
        referralProgram.isActive = _isActive;
    }
    
    function updateAchievementReward(AchievementType achievement, uint256 reward) external onlyOwner {
        achievementRewards[achievement] = reward;
    }
    
    function updateTierMultiplier(LoyaltyTier tier, uint256 multiplier) external onlyOwner {
        require(multiplier >= 10000, "Multiplier must be at least 1x");
        tierMultipliers[tier] = multiplier;
    }
    
    /**
     * @dev Emergency functions
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        skillToken.safeTransfer(owner(), amount);
    }
}