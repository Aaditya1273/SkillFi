// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./SkillToken.sol";

/**
 * @title SkillFiRewards
 * @dev Advanced reward system with multiple earning mechanisms and loyalty programs
 */
contract SkillFiRewards is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;
    
    SkillToken public immutable skillToken;
    
    enum RewardType {
        ProjectCompletion,    // 0 - Rewards for completing projects
        QualityBonus,        // 1 - Bonus for high-quality work
        ReferralReward,      // 2 - Rewards for referring new users
        LoyaltyReward,       // 3 - Long-term platform usage rewards
        CommunityReward,     // 4 - DAO participation and community contributions
        SkillDevelopment,    // 5 - Learning and skill improvement rewards
        EarlyAdopter,        // 6 - Early platform adoption rewards
        SeasonalBonus        // 7 - Special seasonal/event bonuses
    }
    
    enum LoyaltyTier {
        Bronze,    // 0 - 0-10 projects
        Silver,    // 1 - 11-25 projects
        Gold,      // 2 - 26-50 projects
        Platinum,  // 3 - 51-100 projects
        Diamond    // 4 - 100+ projects
    }
    
    struct RewardPool {
        uint256 totalAllocated;
        uint256 totalDistributed;
        uint256 rewardRate; // Rewards per unit
        uint256 lastUpdateTime;
        bool isActive;
    }
    
    struct UserRewards {
        uint256 totalEarned;
        uint256 totalClaimed;
        uint256 pendingRewards;
        uint256 lastClaimTime;
        uint256 streakDays;
        uint256 lastActivityTime;
        LoyaltyTier loyaltyTier;
        mapping(RewardType => uint256) rewardsByType;
        mapping(address => uint256) referralRewards;
    }
    
    struct ReferralProgram {
        uint256 referrerReward;    // Reward for referrer
        uint256 refereeReward;     // Reward for new user
        uint256 minProjectsForReward; // Min projects before referral reward
        uint256 maxReferrals;      // Max referrals per user
        bool isActive;
    }
    
    struct LoyaltyProgram {
        uint256 baseMultiplier;    // Base loyalty multiplier (basis points)
        uint256 tierMultipliers;   // Additional multiplier per tier
        uint256 streakBonus;       // Bonus for consecutive days
        uint256 maxStreakBonus;    // Maximum streak bonus
    }
    
    struct SeasonalCampaign {
        string name;
        uint256 startTime;
        uint256 endTime;
        uint256 totalRewards;
        uint256 distributedRewards;
        uint256 multiplier; // Bonus multiplier for the period
        bool isActive;
    }
    
    mapping(RewardType => RewardPool) public rewardPools;
    mapping(address => UserRewards) public userRewards;
    mapping(address => address) public referrers; // user => referrer
    mapping(address => address[]) public referees; // referrer => referees
    mapping(address => uint256) public userProjectCounts;
    mapping(uint256 => SeasonalCampaign) public seasonalCampaigns;
    
    ReferralProgram public referralProgram;
    LoyaltyProgram public loyaltyProgram;
    
    uint256 public campaignCounter;
    uint256 public totalRewardsDistributed;
    
    // Authorized contracts that can distribute rewards
    mapping(address => bool) public authorizedDistributors;
    
    // Daily activity tracking
    mapping(address => mapping(uint256 => bool)) public dailyActivity; // user => day => active
    
    uint256 public constant LOYALTY_TIER_THRESHOLDS = 10; // Projects per tier
    uint256 public constant MAX_STREAK_DAYS = 365;
    uint256 public constant DAILY_LOGIN_REWARD = 10 * 10**18; // 10 SKILL
    uint256 public constant QUALITY_BONUS_THRESHOLD = 45; // 4.5 rating * 10
    
    event RewardEarned(
        address indexed user,
        RewardType indexed rewardType,
        uint256 amount,
        string reason
    );
    
    event RewardClaimed(
        address indexed user,
        uint256 amount,
        uint256 totalClaimed
    );
    
    event ReferralReward(
        address indexed referrer,
        address indexed referee,
        uint256 referrerReward,
        uint256 refereeReward
    );
    
    event LoyaltyTierUpdated(
        address indexed user,
        LoyaltyTier oldTier,
        LoyaltyTier newTier
    );
    
    event StreakUpdated(
        address indexed user,
        uint256 streakDays,
        uint256 bonusReward
    );
    
    event SeasonalCampaignCreated(
        uint256 indexed campaignId,
        string name,
        uint256 startTime,
        uint256 endTime,
        uint256 totalRewards
    );
    
    modifier onlyAuthorized() {
        require(
            authorizedDistributors[msg.sender] || msg.sender == owner(),
            "Not authorized to distribute rewards"
        );
        _;
    }
    
    constructor(address _skillToken) {
        skillToken = SkillToken(_skillToken);
        
        // Initialize reward pools
        _initializeRewardPools();
        
        // Initialize referral program
        referralProgram = ReferralProgram({
            referrerReward: 500 * 10**18,  // 500 SKILL
            refereeReward: 100 * 10**18,   // 100 SKILL
            minProjectsForReward: 1,
            maxReferrals: 50,
            isActive: true
        });
        
        // Initialize loyalty program
        loyaltyProgram = LoyaltyProgram({
            baseMultiplier: 10000,  // 100% (no bonus)
            tierMultipliers: 500,   // 5% per tier
            streakBonus: 100,       // 1% per day
            maxStreakBonus: 5000    // 50% max
        });
    }
    
    /**
     * @dev Initialize reward pools with default allocations
     */
    function _initializeRewardPools() internal {
        rewardPools[RewardType.ProjectCompletion] = RewardPool({
            totalAllocated: 5000000 * 10**18, // 5M SKILL
            totalDistributed: 0,
            rewardRate: 100 * 10**18, // 100 SKILL per project
            lastUpdateTime: block.timestamp,
            isActive: true
        });
        
        rewardPools[RewardType.QualityBonus] = RewardPool({
            totalAllocated: 2000000 * 10**18, // 2M SKILL
            totalDistributed: 0,
            rewardRate: 50 * 10**18, // 50 SKILL bonus
            lastUpdateTime: block.timestamp,
            isActive: true
        });
        
        rewardPools[RewardType.ReferralReward] = RewardPool({
            totalAllocated: 1000000 * 10**18, // 1M SKILL
            totalDistributed: 0,
            rewardRate: 500 * 10**18, // 500 SKILL per referral
            lastUpdateTime: block.timestamp,
            isActive: true
        });
        
        rewardPools[RewardType.LoyaltyReward] = RewardPool({
            totalAllocated: 3000000 * 10**18, // 3M SKILL
            totalDistributed: 0,
            rewardRate: 10 * 10**18, // 10 SKILL per day
            lastUpdateTime: block.timestamp,
            isActive: true
        });
        
        rewardPools[RewardType.CommunityReward] = RewardPool({
            totalAllocated: 1500000 * 10**18, // 1.5M SKILL
            totalDistributed: 0,
            rewardRate: 25 * 10**18, // 25 SKILL per contribution
            lastUpdateTime: block.timestamp,
            isActive: true
        });
    }
    
    /**
     * @dev Distribute project completion reward
     */
    function distributeProjectReward(
        address user,
        uint256 projectValue,
        uint256 rating
    ) external onlyAuthorized {
        require(user != address(0), "Invalid user address");
        
        // Base project completion reward
        uint256 baseReward = rewardPools[RewardType.ProjectCompletion].rewardRate;
        
        // Apply value-based multiplier (0.1% of project value, max 2x base reward)
        uint256 valueBonus = (projectValue * 10) / 10000; // 0.1%
        valueBonus = valueBonus.min(baseReward); // Cap at base reward
        
        uint256 totalReward = baseReward + valueBonus;
        
        // Apply loyalty multiplier
        totalReward = _applyLoyaltyMultiplier(user, totalReward);
        
        _distributeReward(user, RewardType.ProjectCompletion, totalReward, "Project completion");
        
        // Update project count and loyalty tier
        userProjectCounts[user]++;
        _updateLoyaltyTier(user);
        
        // Quality bonus for high ratings
        if (rating >= QUALITY_BONUS_THRESHOLD) {
            uint256 qualityBonus = rewardPools[RewardType.QualityBonus].rewardRate;
            qualityBonus = _applyLoyaltyMultiplier(user, qualityBonus);
            _distributeReward(user, RewardType.QualityBonus, qualityBonus, "High quality work");
        }
        
        // Update daily activity
        _updateDailyActivity(user);
    }
    
    /**
     * @dev Process referral rewards
     */
    function processReferral(address referrer, address referee) external onlyAuthorized {
        require(referrer != address(0) && referee != address(0), "Invalid addresses");
        require(referrer != referee, "Cannot refer yourself");
        require(referrers[referee] == address(0), "User already referred");
        require(referees[referrer].length < referralProgram.maxReferrals, "Max referrals reached");
        require(referralProgram.isActive, "Referral program not active");
        
        referrers[referee] = referrer;
        referees[referrer].push(referee);
        
        // Immediate referee reward
        uint256 refereeReward = referralProgram.refereeReward;
        _distributeReward(referee, RewardType.ReferralReward, refereeReward, "Welcome bonus");
        
        // Referrer reward (paid when referee completes first project)
        userRewards[referrer].referralRewards[referee] = referralProgram.referrerReward;
        
        emit ReferralReward(referrer, referee, 0, refereeReward);
    }
    
    /**
     * @dev Pay referrer reward when referee completes required projects
     */
    function payReferrerReward(address referee) external onlyAuthorized {
        address referrer = referrers[referee];
        require(referrer != address(0), "No referrer found");
        require(userProjectCounts[referee] >= referralProgram.minProjectsForReward, "Min projects not met");
        
        uint256 reward = userRewards[referrer].referralRewards[referee];
        require(reward > 0, "No pending referral reward");
        
        userRewards[referrer].referralRewards[referee] = 0;
        _distributeReward(referrer, RewardType.ReferralReward, reward, "Referral bonus");
        
        emit ReferralReward(referrer, referee, reward, 0);
    }
    
    /**
     * @dev Distribute community participation reward
     */
    function distributeCommunityReward(
        address user,
        uint256 multiplier,
        string memory reason
    ) external onlyAuthorized {
        uint256 baseReward = rewardPools[RewardType.CommunityReward].rewardRate;
        uint256 reward = (baseReward * multiplier) / 100;
        reward = _applyLoyaltyMultiplier(user, reward);
        
        _distributeReward(user, RewardType.CommunityReward, reward, reason);
        _updateDailyActivity(user);
    }
    
    /**
     * @dev Claim daily login reward and update streak
     */
    function claimDailyReward() external nonReentrant whenNotPaused {
        uint256 today = block.timestamp / 86400;
        require(!dailyActivity[msg.sender][today], "Already claimed today");
        
        UserRewards storage rewards = userRewards[msg.sender];
        
        // Update streak
        uint256 yesterday = today - 1;
        if (dailyActivity[msg.sender][yesterday] || rewards.streakDays == 0) {
            rewards.streakDays++;
            if (rewards.streakDays > MAX_STREAK_DAYS) {
                rewards.streakDays = MAX_STREAK_DAYS;
            }
        } else {
            rewards.streakDays = 1; // Reset streak
        }
        
        // Calculate streak bonus
        uint256 streakBonus = (DAILY_LOGIN_REWARD * rewards.streakDays * loyaltyProgram.streakBonus) / 10000;
        streakBonus = streakBonus.min((DAILY_LOGIN_REWARD * loyaltyProgram.maxStreakBonus) / 10000);
        
        uint256 totalReward = DAILY_LOGIN_REWARD + streakBonus;
        totalReward = _applyLoyaltyMultiplier(msg.sender, totalReward);
        
        _distributeReward(msg.sender, RewardType.LoyaltyReward, totalReward, "Daily login");
        _updateDailyActivity(msg.sender);
        
        emit StreakUpdated(msg.sender, rewards.streakDays, streakBonus);
    }
    
    /**
     * @dev Create seasonal campaign
     */
    function createSeasonalCampaign(
        string memory name,
        uint256 duration,
        uint256 totalRewards,
        uint256 multiplier
    ) external onlyOwner returns (uint256) {
        require(duration > 0 && duration <= 90 days, "Invalid duration");
        require(totalRewards > 0, "Invalid reward amount");
        require(multiplier >= 10000 && multiplier <= 30000, "Invalid multiplier"); // 1x to 3x
        
        campaignCounter++;
        uint256 campaignId = campaignCounter;
        
        seasonalCampaigns[campaignId] = SeasonalCampaign({
            name: name,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            totalRewards: totalRewards,
            distributedRewards: 0,
            multiplier: multiplier,
            isActive: true
        });
        
        emit SeasonalCampaignCreated(campaignId, name, block.timestamp, block.timestamp + duration, totalRewards);
        
        return campaignId;
    }
    
    /**
     * @dev Distribute seasonal bonus
     */
    function distributeSeasonalBonus(
        address user,
        uint256 campaignId,
        uint256 baseAmount,
        string memory reason
    ) external onlyAuthorized {
        SeasonalCampaign storage campaign = seasonalCampaigns[campaignId];
        require(campaign.isActive, "Campaign not active");
        require(block.timestamp >= campaign.startTime && block.timestamp <= campaign.endTime, "Campaign not running");
        
        uint256 bonusAmount = (baseAmount * campaign.multiplier) / 10000;
        require(campaign.distributedRewards + bonusAmount <= campaign.totalRewards, "Campaign budget exceeded");
        
        campaign.distributedRewards += bonusAmount;
        _distributeReward(user, RewardType.SeasonalBonus, bonusAmount, reason);
    }
    
    /**
     * @dev Internal function to distribute rewards
     */
    function _distributeReward(
        address user,
        RewardType rewardType,
        uint256 amount,
        string memory reason
    ) internal {
        require(amount > 0, "Invalid reward amount");
        
        RewardPool storage pool = rewardPools[rewardType];
        require(pool.isActive, "Reward pool not active");
        require(pool.totalDistributed + amount <= pool.totalAllocated, "Pool exhausted");
        
        UserRewards storage rewards = userRewards[user];
        
        rewards.totalEarned += amount;
        rewards.pendingRewards += amount;
        rewards.rewardsByType[rewardType] += amount;
        rewards.lastActivityTime = block.timestamp;
        
        pool.totalDistributed += amount;
        totalRewardsDistributed += amount;
        
        emit RewardEarned(user, rewardType, amount, reason);
    }
    
    /**
     * @dev Apply loyalty multiplier based on user's tier
     */
    function _applyLoyaltyMultiplier(address user, uint256 amount) internal view returns (uint256) {
        UserRewards storage rewards = userRewards[user];
        uint256 multiplier = loyaltyProgram.baseMultiplier + 
                           (uint256(rewards.loyaltyTier) * loyaltyProgram.tierMultipliers);
        
        return (amount * multiplier) / 10000;
    }
    
    /**
     * @dev Update user's loyalty tier based on project count
     */
    function _updateLoyaltyTier(address user) internal {
        uint256 projectCount = userProjectCounts[user];
        LoyaltyTier oldTier = userRewards[user].loyaltyTier;
        LoyaltyTier newTier = oldTier;
        
        if (projectCount >= 100) {
            newTier = LoyaltyTier.Diamond;
        } else if (projectCount >= 51) {
            newTier = LoyaltyTier.Platinum;
        } else if (projectCount >= 26) {
            newTier = LoyaltyTier.Gold;
        } else if (projectCount >= 11) {
            newTier = LoyaltyTier.Silver;
        } else {
            newTier = LoyaltyTier.Bronze;
        }
        
        if (newTier != oldTier) {
            userRewards[user].loyaltyTier = newTier;
            emit LoyaltyTierUpdated(user, oldTier, newTier);
        }
    }
    
    /**
     * @dev Update daily activity tracking
     */
    function _updateDailyActivity(address user) internal {
        uint256 today = block.timestamp / 86400;
        dailyActivity[user][today] = true;
    }
    
    /**
     * @dev Claim pending rewards
     */
    function claimRewards() external nonReentrant whenNotPaused {
        UserRewards storage rewards = userRewards[msg.sender];
        uint256 pendingAmount = rewards.pendingRewards;
        require(pendingAmount > 0, "No pending rewards");
        
        rewards.pendingRewards = 0;
        rewards.totalClaimed += pendingAmount;
        rewards.lastClaimTime = block.timestamp;
        
        // Mint reward tokens
        skillToken.mint(msg.sender, pendingAmount);
        
        emit RewardClaimed(msg.sender, pendingAmount, rewards.totalClaimed);
    }
    
    /**
     * @dev Get user's reward summary
     */
    function getUserRewardSummary(address user) external view returns (
        uint256 totalEarned,
        uint256 totalClaimed,
        uint256 pendingRewards,
        LoyaltyTier loyaltyTier,
        uint256 streakDays,
        uint256 projectCount
    ) {
        UserRewards storage rewards = userRewards[user];
        return (
            rewards.totalEarned,
            rewards.totalClaimed,
            rewards.pendingRewards,
            rewards.loyaltyTier,
            rewards.streakDays,
            userProjectCounts[user]
        );
    }
    
    /**
     * @dev Get user's rewards by type
     */
    function getUserRewardsByType(address user, RewardType rewardType) external view returns (uint256) {
        return userRewards[user].rewardsByType[rewardType];
    }
    
    /**
     * @dev Get user's referees
     */
    function getUserReferees(address user) external view returns (address[] memory) {
        return referees[user];
    }
    
    /**
     * @dev Check if user claimed daily reward today
     */
    function hasClaimedToday(address user) external view returns (bool) {
        uint256 today = block.timestamp / 86400;
        return dailyActivity[user][today];
    }
    
    /**
     * @dev Add authorized distributor
     */
    function addAuthorizedDistributor(address distributor) external onlyOwner {
        authorizedDistributors[distributor] = true;
    }
    
    /**
     * @dev Remove authorized distributor
     */
    function removeAuthorizedDistributor(address distributor) external onlyOwner {
        authorizedDistributors[distributor] = false;
    }
    
    /**
     * @dev Update reward pool allocation
     */
    function updateRewardPool(
        RewardType rewardType,
        uint256 totalAllocated,
        uint256 rewardRate,
        bool isActive
    ) external onlyOwner {
        RewardPool storage pool = rewardPools[rewardType];
        require(totalAllocated >= pool.totalDistributed, "Cannot reduce below distributed");
        
        pool.totalAllocated = totalAllocated;
        pool.rewardRate = rewardRate;
        pool.isActive = isActive;
        pool.lastUpdateTime = block.timestamp;
    }
    
    /**
     * @dev Update referral program parameters
     */
    function updateReferralProgram(
        uint256 referrerReward,
        uint256 refereeReward,
        uint256 minProjectsForReward,
        uint256 maxReferrals,
        bool isActive
    ) external onlyOwner {
        referralProgram.referrerReward = referrerReward;
        referralProgram.refereeReward = refereeReward;
        referralProgram.minProjectsForReward = minProjectsForReward;
        referralProgram.maxReferrals = maxReferrals;
        referralProgram.isActive = isActive;
    }
    
    /**
     * @dev Update loyalty program parameters
     */
    function updateLoyaltyProgram(
        uint256 baseMultiplier,
        uint256 tierMultipliers,
        uint256 streakBonus,
        uint256 maxStreakBonus
    ) external onlyOwner {
        require(baseMultiplier >= 5000 && baseMultiplier <= 20000, "Invalid base multiplier");
        require(maxStreakBonus <= 10000, "Max streak bonus too high");
        
        loyaltyProgram.baseMultiplier = baseMultiplier;
        loyaltyProgram.tierMultipliers = tierMultipliers;
        loyaltyProgram.streakBonus = streakBonus;
        loyaltyProgram.maxStreakBonus = maxStreakBonus;
    }
    
    /**
     * @dev End seasonal campaign
     */
    function endSeasonalCampaign(uint256 campaignId) external onlyOwner {
        seasonalCampaigns[campaignId].isActive = false;
        seasonalCampaigns[campaignId].endTime = block.timestamp;
    }
    
    /**
     * @dev Emergency functions
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency reward distribution (only when paused)
     */
    function emergencyDistributeReward(
        address user,
        uint256 amount,
        string memory reason
    ) external onlyOwner whenPaused {
        skillToken.mint(user, amount);
        emit RewardEarned(user, RewardType.CommunityReward, amount, reason);
    }
}