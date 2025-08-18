// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SkillToken.sol";

/**
 * @title SkillFiStaking
 * @dev Staking contract for SKILL tokens with governance voting power and rewards
 */
contract SkillFiStaking is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    SkillToken public immutable skillToken;
    
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastRewardClaim;
        uint256 lockPeriod; // in seconds
        bool isLocked;
    }
    
    struct RewardPool {
        uint256 totalRewards;
        uint256 rewardRate; // rewards per second per token
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }
    
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    
    RewardPool public rewardPool;
    
    uint256 public totalStaked;
    uint256 public constant MIN_STAKE_AMOUNT = 100 * 10**18; // 100 SKILL
    uint256 public constant MAX_LOCK_PERIOD = 365 days; // 1 year
    uint256 public constant BASE_REWARD_RATE = 1e16; // Base rate: 0.01 SKILL per second per token
    
    // Lock period multipliers (basis points)
    mapping(uint256 => uint256) public lockMultipliers;
    
    event Staked(address indexed user, uint256 amount, uint256 lockPeriod);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardAdded(uint256 reward);
    
    modifier updateReward(address account) {
        rewardPool.rewardPerTokenStored = rewardPerToken();
        rewardPool.lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPool.rewardPerTokenStored;
        }
        _;
    }
    
    constructor(address _skillToken) {
        skillToken = SkillToken(_skillToken);
        
        // Initialize lock multipliers (basis points)
        lockMultipliers[0] = 10000;      // No lock: 1x
        lockMultipliers[30 days] = 11000;   // 30 days: 1.1x
        lockMultipliers[90 days] = 12500;   // 90 days: 1.25x
        lockMultipliers[180 days] = 15000;  // 180 days: 1.5x
        lockMultipliers[365 days] = 20000;  // 365 days: 2x
        
        rewardPool.lastUpdateTime = block.timestamp;
        rewardPool.rewardRate = BASE_REWARD_RATE;
    }
    
    /**
     * @dev Stake SKILL tokens with optional lock period
     */
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount >= MIN_STAKE_AMOUNT, "Amount below minimum");
        require(lockPeriod <= MAX_LOCK_PERIOD, "Lock period too long");
        require(lockMultipliers[lockPeriod] > 0, "Invalid lock period");
        
        StakeInfo storage userStake = stakes[msg.sender];
        require(!userStake.isLocked || block.timestamp >= userStake.stakedAt + userStake.lockPeriod, "Tokens still locked");
        
        skillToken.safeTransferFrom(msg.sender, address(this), amount);
        
        userStake.amount += amount;
        userStake.stakedAt = block.timestamp;
        userStake.lastRewardClaim = block.timestamp;
        userStake.lockPeriod = lockPeriod;
        userStake.isLocked = lockPeriod > 0;
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, lockPeriod);
    }
    
    /**
     * @dev Unstake SKILL tokens
     */
    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient staked amount");
        require(!userStake.isLocked || block.timestamp >= userStake.stakedAt + userStake.lockPeriod, "Tokens still locked");
        
        userStake.amount -= amount;
        totalStaked -= amount;
        
        skillToken.safeTransfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim staking rewards
     */
    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        
        rewards[msg.sender] = 0;
        stakes[msg.sender].lastRewardClaim = block.timestamp;
        
        // Apply lock multiplier
        StakeInfo memory userStake = stakes[msg.sender];
        uint256 multiplier = lockMultipliers[userStake.lockPeriod];
        reward = (reward * multiplier) / 10000;
        
        // Mint reward tokens
        skillToken.mint(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    /**
     * @dev Get current reward per token
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPool.rewardPerTokenStored;
        }
        
        return rewardPool.rewardPerTokenStored + 
               (((block.timestamp - rewardPool.lastUpdateTime) * rewardPool.rewardRate * 1e18) / totalStaked);
    }
    
    /**
     * @dev Get earned rewards for an account
     */
    function earned(address account) public view returns (uint256) {
        StakeInfo memory userStake = stakes[account];
        return ((userStake.amount * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) + rewards[account];
    }
    
    /**
     * @dev Get effective voting power (includes lock multiplier)
     */
    function getVotingPower(address account) external view returns (uint256) {
        StakeInfo memory userStake = stakes[account];
        if (userStake.amount == 0) return 0;
        
        uint256 multiplier = lockMultipliers[userStake.lockPeriod];
        return (userStake.amount * multiplier) / 10000;
    }
    
    /**
     * @dev Check if user's tokens are locked
     */
    function isLocked(address account) external view returns (bool) {
        StakeInfo memory userStake = stakes[account];
        return userStake.isLocked && block.timestamp < userStake.stakedAt + userStake.lockPeriod;
    }
    
    /**
     * @dev Get time until unlock
     */
    function timeUntilUnlock(address account) external view returns (uint256) {
        StakeInfo memory userStake = stakes[account];
        if (!userStake.isLocked) return 0;
        
        uint256 unlockTime = userStake.stakedAt + userStake.lockPeriod;
        if (block.timestamp >= unlockTime) return 0;
        
        return unlockTime - block.timestamp;
    }
    
    /**
     * @dev Add rewards to the pool (only owner)
     */
    function addReward(uint256 reward) external onlyOwner updateReward(address(0)) {
        skillToken.safeTransferFrom(msg.sender, address(this), reward);
        rewardPool.totalRewards += reward;
        
        emit RewardAdded(reward);
    }
    
    /**
     * @dev Update reward rate (only owner)
     */
    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) {
        rewardPool.rewardRate = _rewardRate;
    }
    
    /**
     * @dev Set lock multiplier (only owner)
     */
    function setLockMultiplier(uint256 lockPeriod, uint256 multiplier) external onlyOwner {
        require(multiplier >= 10000, "Multiplier must be at least 1x");
        require(multiplier <= 30000, "Multiplier too high");
        lockMultipliers[lockPeriod] = multiplier;
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
     * @dev Emergency withdraw (only owner, when paused)
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = skillToken.balanceOf(address(this));
        skillToken.safeTransfer(owner(), balance);
    }
}