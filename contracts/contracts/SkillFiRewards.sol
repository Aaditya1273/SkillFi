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
 * @dev Advanced reward system with achievement-based incentives and referral program
 */
contract SkillFiRewards is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    SkillToken public immutable skillToken;
    SkillFiEscrow public immutable escrow;
    
    // Achievement types
    enum AchievementType {
        FirstProject,
        ProjectMilestone,
        RatingMilestone,
        VolumeThreshold,
        ConsecutiveProjects,
        Referral,
        LongTermStaking,
        CommunityContribution
    }
    
    struct Achievement {
        AchievementType achievementType;
        string name;
        string description;
        uint256 rewardAmount;
        uint256 threshold;
        bool isActive;
        uint256 totalClaimed;
    }
    
    struct UserAchievements {
        mapping(uint256 => bool) claimed;
        uint256 totalRewardsEarned;
        uint256 referralCount;
        address referrer;
        uint256 referralRewards;
    }
    
    struct ReferralProgram {
        uint256 referrerReward;
        uint256 refereeReward;
        uint256 minProjectValue;
        bool isActive;
    }
    
    struct SeasonalReward {
        uint256 startTime;
        uint256 endTime;
        uint256 multiplier; // basis points (10000 = 1x)
        uint256 totalPool;
        uint256 claimed;
        bool isActive;
    }
    
    // Storage
    mapping(uint256 => Achievement) public achievements;
    mapping(address => UserAchievements) public userAchievements;
    mapping(address => mapping(uint256 => uint256)) public userProgress;
    
    ReferralProgram public referralProgram;
    SeasonalReward public currentSeason;
    
    uint256 public achievementCounter;
    uint256 public constant MAX_REFERRAL_DEPTH = 3;
    uint256 public constant LOYALTY_BONUS_THRESHOLD = 10; // 10 completed projects
    
    // Events
    event AchievementUnlocked(
        address indexed user,
        uint256 indexed achievementId,
        uint256 rewardAmount
    );
    
    event ReferralReward(
        address indexed referrer,
        address indexed referee,
        uint256 referrerReward,
        uint256 refereeReward
    );
    
    event SeasonalRewardClaimed(
        address indexed user,
        uint256 baseReward,
        uint256 bonusReward,
        uint256 multiplier
    );
    
    event ProgressUpdated(
        address indexed user,
        uint256 indexed achievementId,
        uint256 progress
    );
    
    modifier onlyEscrow() {
        require(msg.sender == address(escrow), "Only escrow can call");
        _;
    }
    
    constructor(
        address _skillToken,
        address _escrow
    ) {
        skillToken = SkillToken(_skillToken);
        escrow = SkillFiEscrow(_escrow);
        
        _initializeAchievements();
        _initializeReferralProgram();
    }
    
    /**
     * @dev Initialize default achievements
     */
    function _initializeAchievements() internal {
        // First Project Achievement
        _createAchievement(
            AchievementType.FirstProject,
            "First Steps",
            "Complete your first project on SkillFi",
            100 * 10**18, // 100 SKILL
            1,
            true
        );
        
        // Project Milestones
        _createAchievement(
            AchievementType.ProjectMilestone,
            "Rising Star",
            "Complete 5 projects successfully",
            500 * 10**18, // 500 SKILL
            5,
            true
        );
        
        _createAchievement(
            AchievementType.ProjectMilestone,
            "Veteran Freelancer",
            "Complete 25 projects successfully",
            2000 * 10**18, // 2000 SKILL
            25,
            true
        );
        
        // Rating Milestones
        _createAchievement(
            AchievementType.RatingMilestone,
            "Five Star Professional",
            "Maintain 5-star average rating with 10+ ratings",
            1000 * 10**18, // 1000 SKILL
            50, // 5.0 * 10 ratings
            true
        );
        
        // Volume Thresholds
        _createAchievement(
            AchievementType.VolumeThreshold,
            "High Earner",
            "Earn 50,000 SKILL tokens from projects",
            5000 * 10**18, // 5000 SKILL
            50000 * 10**18,
            true
        );
    }
    
    /**
     * @dev Initialize referral program
     */
    function _initializeReferralProgram() internal {
        referralProgram = ReferralProgram({
            referrerReward: 200 * 10**18, // 200 SKILL
            refereeReward: 100 * 10**18,  // 100 SKILL
            minProjectValue: 1000 * 10**18, // 1000 SKILL minimum project
            isActive: true
        });
    }
    
    /**
     * @dev Create new achievement
     */
    function _createAchievement(
        AchievementType _type,
        string memory _name,
        string memory _description,
        uint256 _rewardAmount,
        uint256 _threshold,
        bool _isActive
    ) internal {
        achievementCounter++;
        achievements[achievementCounter] = Achievement({
            achievementType: _type,
            name: _name,
            description: _description,
            rewardAmount: _rewardAmount,
            threshold: _threshold,
            isActive: _isActive,
            totalClaimed: 0
        });
    }
    
    /**
     * @dev Update user progress (called by escrow contract)
     */
    function updateProgress(
        address user,
        AchievementType achievementType,
        uint256 value
    ) external onlyEscrow {
        // Update progress for all achievements of this type
        for (uint256 i = 1; i <= achievementCounter; i++) {
            Achievement storage achievement = achievements[i];
            if (achievement.achievementType == achievementType && achievement.isActive) {
                
                if (achievementType == AchievementType.ProjectMilestone) {
                    userProgress[user][i]++;
                } else if (achievementType == AchievementType.VolumeThreshold) {
                    userProgress[user][i] += value;
                } else if (achievementType == AchievementType.RatingMilestone) {
                    // Special handling for rating achievements
                    uint256 avgRating = escrow.getUserRating(user);
                    (,uint256 ratingCount,,,) = escrow.userReputations(user);
                    userProgress[user][i] = avgRating * ratingCount;
                } else {
                    userProgress[user][i] = value;
                }
                
                emit ProgressUpdated(user, i, userProgress[user][i]);
                
                // Check if achievement is unlocked
                _checkAndUnlockAchievement(user, i);
            }
        }
    }
    
    /**
     * @dev Check and unlock achievement if threshold met
     */
    function _checkAndUnlockAchievement(address user, uint256 achievementId) internal {
        Achievement storage achievement = achievements[achievementId];
        UserAchievements storage userAch = userAchievements[user];
        
        if (!userAch.claimed[achievementId] && 
            userProgress[user][achievementId] >= achievement.threshold) {
            
            userAch.claimed[achievementId] = true;
            userAch.totalRewardsEarned += achievement.rewardAmount;
            achievement.totalClaimed += achievement.rewardAmount;
            
            // Apply seasonal multiplier if active
            uint256 finalReward = achievement.rewardAmount;
            if (currentSeason.isActive && 
                block.timestamp >= currentSeason.startTime && 
                block.timestamp <= currentSeason.endTime) {
                
                uint256 bonus = (achievement.rewardAmount * (currentSeason.multiplier - 10000)) / 10000;
                finalReward += bonus;
                currentSeason.claimed += bonus;
            }
            
            // Mint reward tokens
            skillToken.mint(user, finalReward);
            
            emit AchievementUnlocked(user, achievementId, finalReward);
        }
    }
    
    /**
     * @dev Register referral relationship
     */
    function registerReferral(address referee, address referrer) external {
        require(referralProgram.isActive, "Referral program not active");
        require(referee != referrer, "Cannot refer yourself");
        require(userAchievements[referee].referrer == address(0), "Already has referrer");
        require(referrer != address(0), "Invalid referrer");
        
        userAchievements[referee].referrer = referrer;
    }
    
    /**
     * @dev Process referral rewards (called by escrow on first project completion)
     */
    function processReferralReward(address user, uint256 projectValue) external onlyEscrow {
        if (!referralProgram.isActive || projectValue < referralProgram.minProjectValue) {
            return;
        }
        
        address referrer = userAchievements[user].referrer;
        if (referrer == address(0)) {
            return;
        }
        
        // Check if this is the user's first completed project
        (,, uint256 completedProjects,,) = escrow.userReputations(user);
        if (completedProjects != 1) {
            return;
        }
        
        // Reward referrer and referee
        userAchievements[referrer].referralCount++;
        userAchievements[referrer].referralRewards += referralProgram.referrerReward;
        userAchievements[user].totalRewardsEarned += referralProgram.refereeReward;
        
        skillToken.mint(referrer, referralProgram.referrerReward);
        skillToken.mint(user, referralProgram.refereeReward);
        
        emit ReferralReward(
            referrer,
            user,
            referralProgram.referrerReward,
            referralProgram.refereeReward
        );
    }
    
    /**
     * @dev Start seasonal reward campaign
     */
    function startSeasonalReward(
        uint256 duration,
        uint256 multiplier,
        uint256 totalPool
    ) external onlyOwner {
        require(multiplier >= 10000, "Multiplier must be at least 1x");
        require(totalPool > 0, "Pool must be greater than 0");
        
        currentSeason = SeasonalReward({
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            multiplier: multiplier,
            totalPool: totalPool,
            claimed: 0,
            isActive: true
        });
        
        // Transfer pool tokens to contract
        skillToken.safeTransferFrom(msg.sender, address(this), totalPool);
    }
    
    /**
     * @dev End seasonal reward campaign
     */
    function endSeasonalReward() external onlyOwner {
        require(currentSeason.isActive, "No active season");
        
        currentSeason.isActive = false;
        
        // Return unclaimed tokens
        uint256 unclaimed = currentSeason.totalPool - currentSeason.claimed;
        if (unclaimed > 0) {
            skillToken.safeTransfer(owner(), unclaimed);
        }
    }
    
    /**
     * @dev Get user's achievement progress
     */
    function getUserProgress(address user, uint256 achievementId) external view returns (uint256) {
        return userProgress[user][achievementId];
    }
    
    /**
     * @dev Check if user has claimed achievement
     */
    function hasClaimedAchievement(address user, uint256 achievementId) external view returns (bool) {
        return userAchievements[user].claimed[achievementId];
    }
    
    /**
     * @dev Get user's total rewards earned
     */
    function getUserTotalRewards(address user) external view returns (uint256) {
        return userAchievements[user].totalRewardsEarned;
    }
    
    /**
     * @dev Get user's referral stats
     */
    function getUserReferralStats(address user) external view returns (
        uint256 referralCount,
        uint256 referralRewards,
        address referrer
    ) {
        UserAchievements storage userAch = userAchievements[user];
        return (
            userAch.referralCount,
            userAch.referralRewards,
            userAch.referrer
        );
    }
    
    /**
     * @dev Get all achievements
     */
    function getAllAchievements() external view returns (Achievement[] memory) {
        Achievement[] memory allAchievements = new Achievement[](achievementCounter);
        for (uint256 i = 1; i <= achievementCounter; i++) {
            allAchievements[i-1] = achievements[i];
        }
        return allAchievements;
    }
    
    /**
     * @dev Admin functions
     */
    function createAchievement(
        AchievementType _type,
        string memory _name,
        string memory _description,
        uint256 _rewardAmount,
        uint256 _threshold
    ) external onlyOwner {
        _createAchievement(_type, _name, _description, _rewardAmount, _threshold, true);
    }
    
    function updateAchievement(
        uint256 achievementId,
        uint256 _rewardAmount,
        uint256 _threshold,
        bool _isActive
    ) external onlyOwner {
        Achievement storage achievement = achievements[achievementId];
        achievement.rewardAmount = _rewardAmount;
        achievement.threshold = _threshold;
        achievement.isActive = _isActive;
    }
    
    function updateReferralProgram(
        uint256 _referrerReward,
        uint256 _refereeReward,
        uint256 _minProjectValue,
        bool _isActive
    ) external onlyOwner {
        referralProgram.referrerReward = _referrerReward;
        referralProgram.refereeReward = _refereeReward;
        referralProgram.minProjectValue = _minProjectValue;
        referralProgram.isActive = _isActive;
    }
    
    /**
     * @dev Emergency withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        skillToken.safeTransfer(owner(), amount);
    }
}