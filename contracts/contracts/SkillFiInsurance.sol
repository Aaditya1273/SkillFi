// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SkillToken.sol";

/**
 * @title SkillFiInsurance
 * @dev Insurance pool for protecting clients and freelancers against project failures
 */
contract SkillFiInsurance is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    SkillToken public immutable skillToken;
    
    enum ClaimStatus {
        Pending,     // 0 - Claim submitted, under review
        Approved,    // 1 - Claim approved, payout pending
        Rejected,    // 2 - Claim rejected
        Paid,        // 3 - Claim paid out
        Disputed     // 4 - Claim disputed, needs resolution
    }
    
    enum InsuranceType {
        ProjectCompletion,  // 0 - Protects client if freelancer doesn't deliver
        PaymentProtection,  // 1 - Protects freelancer if client doesn't pay
        QualityAssurance,   // 2 - Protects against poor quality work
        TimelineProtection  // 3 - Protects against missed deadlines
    }
    
    struct InsurancePolicy {
        uint256 id;
        uint256 projectId;
        address policyholder;
        InsuranceType insuranceType;
        uint256 coverageAmount;
        uint256 premium;
        uint256 deductible;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool hasClaimed;
    }
    
    struct InsuranceClaim {
        uint256 id;
        uint256 policyId;
        address claimant;
        ClaimStatus status;
        uint256 claimAmount;
        string evidence;
        string reason;
        uint256 submittedAt;
        uint256 reviewedAt;
        address reviewer;
        string reviewNotes;
    }
    
    struct InsurancePool {
        uint256 totalFunds;
        uint256 totalClaims;
        uint256 totalPremiums;
        uint256 reserveRatio; // Percentage of funds to keep in reserve
        uint256 maxCoveragePerPolicy;
        uint256 maxTotalCoverage;
    }
    
    mapping(uint256 => InsurancePolicy) public policies;
    mapping(uint256 => InsuranceClaim) public claims;
    mapping(address => uint256[]) public userPolicies;
    mapping(address => uint256[]) public userClaims;
    mapping(uint256 => uint256[]) public projectPolicies; // projectId => policyIds
    
    InsurancePool public insurancePool;
    
    uint256 public policyCounter;
    uint256 public claimCounter;
    
    // Premium rates (basis points) for different insurance types
    mapping(InsuranceType => uint256) public premiumRates;
    
    // Authorized reviewers for claims
    mapping(address => bool) public authorizedReviewers;
    
    // Risk assessment factors
    mapping(address => uint256) public userRiskScores; // 0-1000, lower is better
    mapping(string => uint256) public skillRiskScores; // skill => risk score
    
    uint256 public constant MAX_RISK_SCORE = 1000;
    uint256 public constant BASE_PREMIUM_RATE = 500; // 5%
    uint256 public constant MAX_COVERAGE_RATIO = 8000; // 80% of project value
    uint256 public constant RESERVE_RATIO = 2000; // 20% reserve
    
    event PolicyCreated(
        uint256 indexed policyId,
        uint256 indexed projectId,
        address indexed policyholder,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 premium
    );
    
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 claimAmount,
        string reason
    );
    
    event ClaimReviewed(
        uint256 indexed claimId,
        ClaimStatus status,
        address indexed reviewer,
        string notes
    );
    
    event ClaimPaid(
        uint256 indexed claimId,
        address indexed claimant,
        uint256 amount
    );
    
    event PremiumPaid(
        uint256 indexed policyId,
        address indexed policyholder,
        uint256 amount
    );
    
    event PoolFunded(address indexed funder, uint256 amount);
    
    modifier onlyReviewer() {
        require(authorizedReviewers[msg.sender] || msg.sender == owner(), "Not authorized reviewer");
        _;
    }
    
    modifier validPolicy(uint256 policyId) {
        require(policies[policyId].id != 0, "Policy does not exist");
        _;
    }
    
    modifier validClaim(uint256 claimId) {
        require(claims[claimId].id != 0, "Claim does not exist");
        _;
    }
    
    constructor(address _skillToken) {
        skillToken = SkillToken(_skillToken);
        
        // Initialize premium rates (basis points)
        premiumRates[InsuranceType.ProjectCompletion] = 300; // 3%
        premiumRates[InsuranceType.PaymentProtection] = 200; // 2%
        premiumRates[InsuranceType.QualityAssurance] = 400; // 4%
        premiumRates[InsuranceType.TimelineProtection] = 250; // 2.5%
        
        // Initialize insurance pool
        insurancePool.reserveRatio = RESERVE_RATIO;
        insurancePool.maxCoveragePerPolicy = 100000 * 10**18; // 100k SKILL
        insurancePool.maxTotalCoverage = 10000000 * 10**18; // 10M SKILL
    }
    
    /**
     * @dev Create insurance policy for a project
     */
    function createPolicy(
        uint256 projectId,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(coverageAmount > 0, "Coverage amount must be greater than 0");
        require(coverageAmount <= insurancePool.maxCoveragePerPolicy, "Coverage exceeds maximum");
        require(duration > 0 && duration <= 365 days, "Invalid duration");
        
        // Calculate premium based on risk factors
        uint256 premium = _calculatePremium(msg.sender, insuranceType, coverageAmount, duration);
        
        // Check if pool can cover this policy
        require(
            insurancePool.totalClaims + coverageAmount <= insurancePool.maxTotalCoverage,
            "Exceeds pool capacity"
        );
        
        // Transfer premium
        skillToken.safeTransferFrom(msg.sender, address(this), premium);
        
        policyCounter++;
        uint256 policyId = policyCounter;
        
        policies[policyId] = InsurancePolicy({
            id: policyId,
            projectId: projectId,
            policyholder: msg.sender,
            insuranceType: insuranceType,
            coverageAmount: coverageAmount,
            premium: premium,
            deductible: _calculateDeductible(coverageAmount),
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            isActive: true,
            hasClaimed: false
        });
        
        userPolicies[msg.sender].push(policyId);
        projectPolicies[projectId].push(policyId);
        
        // Update pool
        insurancePool.totalPremiums += premium;
        insurancePool.totalFunds += premium;
        
        emit PolicyCreated(policyId, projectId, msg.sender, insuranceType, coverageAmount, premium);
        emit PremiumPaid(policyId, msg.sender, premium);
        
        return policyId;
    }
    
    /**
     * @dev Submit insurance claim
     */
    function submitClaim(
        uint256 policyId,
        uint256 claimAmount,
        string memory evidence,
        string memory reason
    ) external validPolicy(policyId) nonReentrant returns (uint256) {
        InsurancePolicy storage policy = policies[policyId];
        
        require(policy.policyholder == msg.sender, "Not policy holder");
        require(policy.isActive, "Policy not active");
        require(block.timestamp <= policy.endTime, "Policy expired");
        require(!policy.hasClaimed, "Already claimed");
        require(claimAmount <= policy.coverageAmount, "Claim exceeds coverage");
        require(claimAmount > policy.deductible, "Claim below deductible");
        
        claimCounter++;
        uint256 claimId = claimCounter;
        
        claims[claimId] = InsuranceClaim({
            id: claimId,
            policyId: policyId,
            claimant: msg.sender,
            status: ClaimStatus.Pending,
            claimAmount: claimAmount,
            evidence: evidence,
            reason: reason,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            reviewer: address(0),
            reviewNotes: ""
        });
        
        userClaims[msg.sender].push(claimId);
        policy.hasClaimed = true;
        
        emit ClaimSubmitted(claimId, policyId, msg.sender, claimAmount, reason);
        
        return claimId;
    }
    
    /**
     * @dev Review insurance claim
     */
    function reviewClaim(
        uint256 claimId,
        ClaimStatus decision,
        string memory notes
    ) external validClaim(claimId) onlyReviewer {
        InsuranceClaim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.Pending, "Claim already reviewed");
        require(
            decision == ClaimStatus.Approved || decision == ClaimStatus.Rejected,
            "Invalid decision"
        );
        
        claim.status = decision;
        claim.reviewedAt = block.timestamp;
        claim.reviewer = msg.sender;
        claim.reviewNotes = notes;
        
        emit ClaimReviewed(claimId, decision, msg.sender, notes);
        
        // If approved, process payout
        if (decision == ClaimStatus.Approved) {
            _processPayout(claimId);
        }
    }
    
    /**
     * @dev Process approved claim payout
     */
    function _processPayout(uint256 claimId) internal {
        InsuranceClaim storage claim = claims[claimId];
        InsurancePolicy storage policy = policies[claim.policyId];
        
        require(claim.status == ClaimStatus.Approved, "Claim not approved");
        
        uint256 payoutAmount = claim.claimAmount - policy.deductible;
        require(insurancePool.totalFunds >= payoutAmount, "Insufficient pool funds");
        
        // Update pool
        insurancePool.totalFunds -= payoutAmount;
        insurancePool.totalClaims += payoutAmount;
        
        // Transfer payout
        skillToken.safeTransfer(claim.claimant, payoutAmount);
        
        claim.status = ClaimStatus.Paid;
        
        emit ClaimPaid(claimId, claim.claimant, payoutAmount);
    }
    
    /**
     * @dev Calculate premium based on risk factors
     */
    function _calculatePremium(
        address user,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 duration
    ) internal view returns (uint256) {
        uint256 basePremium = (coverageAmount * premiumRates[insuranceType]) / 10000;
        
        // Apply risk multiplier
        uint256 userRisk = userRiskScores[user];
        if (userRisk == 0) userRisk = 500; // Default medium risk
        
        uint256 riskMultiplier = 5000 + (userRisk * 5000) / MAX_RISK_SCORE; // 0.5x to 1.5x
        uint256 adjustedPremium = (basePremium * riskMultiplier) / 10000;
        
        // Apply duration multiplier
        uint256 durationMultiplier = (duration * 10000) / 365 days; // Pro-rated for duration
        adjustedPremium = (adjustedPremium * durationMultiplier) / 10000;
        
        return adjustedPremium;
    }
    
    /**
     * @dev Calculate deductible (10% of coverage amount)
     */
    function _calculateDeductible(uint256 coverageAmount) internal pure returns (uint256) {
        return (coverageAmount * 1000) / 10000; // 10%
    }
    
    /**
     * @dev Fund insurance pool
     */
    function fundPool(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        skillToken.safeTransferFrom(msg.sender, address(this), amount);
        insurancePool.totalFunds += amount;
        
        emit PoolFunded(msg.sender, amount);
    }
    
    /**
     * @dev Update user risk score
     */
    function updateUserRiskScore(address user, uint256 riskScore) external onlyOwner {
        require(riskScore <= MAX_RISK_SCORE, "Risk score too high");
        userRiskScores[user] = riskScore;
    }
    
    /**
     * @dev Update skill risk score
     */
    function updateSkillRiskScore(string memory skill, uint256 riskScore) external onlyOwner {
        require(riskScore <= MAX_RISK_SCORE, "Risk score too high");
        skillRiskScores[skill] = riskScore;
    }
    
    /**
     * @dev Update premium rate for insurance type
     */
    function updatePremiumRate(InsuranceType insuranceType, uint256 rate) external onlyOwner {
        require(rate <= 2000, "Rate too high"); // Max 20%
        premiumRates[insuranceType] = rate;
    }
    
    /**
     * @dev Add authorized reviewer
     */
    function addReviewer(address reviewer) external onlyOwner {
        authorizedReviewers[reviewer] = true;
    }
    
    /**
     * @dev Remove authorized reviewer
     */
    function removeReviewer(address reviewer) external onlyOwner {
        authorizedReviewers[reviewer] = false;
    }
    
    /**
     * @dev Get user's policies
     */
    function getUserPolicies(address user) external view returns (uint256[] memory) {
        return userPolicies[user];
    }
    
    /**
     * @dev Get user's claims
     */
    function getUserClaims(address user) external view returns (uint256[] memory) {
        return userClaims[user];
    }
    
    /**
     * @dev Get project's policies
     */
    function getProjectPolicies(uint256 projectId) external view returns (uint256[] memory) {
        return projectPolicies[projectId];
    }
    
    /**
     * @dev Get pool utilization ratio
     */
    function getPoolUtilization() external view returns (uint256) {
        if (insurancePool.totalFunds == 0) return 0;
        return (insurancePool.totalClaims * 10000) / insurancePool.totalFunds;
    }
    
    /**
     * @dev Check if pool can cover new policy
     */
    function canCoverPolicy(uint256 coverageAmount) external view returns (bool) {
        return insurancePool.totalClaims + coverageAmount <= insurancePool.maxTotalCoverage;
    }
    
    /**
     * @dev Get premium quote
     */
    function getPremiumQuote(
        address user,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 duration
    ) external view returns (uint256) {
        return _calculatePremium(user, insuranceType, coverageAmount, duration);
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
     * @dev Emergency withdraw (only when paused)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner whenPaused {
        require(amount <= insurancePool.totalFunds, "Insufficient funds");
        skillToken.safeTransfer(owner(), amount);
        insurancePool.totalFunds -= amount;
    }
    
    /**
     * @dev Update pool parameters
     */
    function updatePoolParameters(
        uint256 _maxCoveragePerPolicy,
        uint256 _maxTotalCoverage,
        uint256 _reserveRatio
    ) external onlyOwner {
        require(_reserveRatio <= 5000, "Reserve ratio too high"); // Max 50%
        
        insurancePool.maxCoveragePerPolicy = _maxCoveragePerPolicy;
        insurancePool.maxTotalCoverage = _maxTotalCoverage;
        insurancePool.reserveRatio = _reserveRatio;
    }
}