// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./SkillToken.sol";

/**
 * @title SkillFiDAO
 * @dev Governance contract for SkillFi platform decisions and dispute resolution
 */
contract SkillFiDAO is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // Dispute resolution
    struct Dispute {
        uint256 projectId;
        address client;
        address freelancer;
        uint256 amount;
        string reason;
        uint256 createdAt;
        bool resolved;
        address winner;
        uint256 votingDeadline;
    }
    
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnDispute;
    mapping(uint256 => uint256) public disputeClientVotes;
    mapping(uint256 => uint256) public disputeFreelancerVotes;
    
    uint256 public disputeCounter;
    uint256 public constant DISPUTE_VOTING_PERIOD = 3 days;
    uint256 public constant MIN_DISPUTE_STAKE = 1000 * 10**18; // 1000 SKILL tokens
    
    address public marketplaceContract;
    
    event DisputeCreated(
        uint256 indexed disputeId,
        uint256 indexed projectId,
        address indexed client,
        address freelancer,
        uint256 amount
    );
    
    event DisputeVote(
        uint256 indexed disputeId,
        address indexed voter,
        bool supportsClient,
        uint256 votingPower
    );
    
    event DisputeResolved(
        uint256 indexed disputeId,
        address indexed winner,
        uint256 clientVotes,
        uint256 freelancerVotes
    );
    
    modifier onlyMarketplace() {
        require(msg.sender == marketplaceContract, "Only marketplace can call");
        _;
    }
    
    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("SkillFiDAO")
        GovernorSettings(1, /* 1 block */ 50400, /* 1 week */ 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        GovernorTimelockControl(_timelock)
    {}
    
    /**
     * @dev Set marketplace contract address
     */
    function setMarketplaceContract(address _marketplace) external onlyGovernance {
        marketplaceContract = _marketplace;
    }
    
    /**
     * @dev Create a dispute for DAO resolution
     */
    function createDispute(
        uint256 projectId,
        address client,
        address freelancer,
        uint256 amount,
        string memory reason
    ) external onlyMarketplace returns (uint256) {
        disputeCounter++;
        uint256 disputeId = disputeCounter;
        
        disputes[disputeId] = Dispute({
            projectId: projectId,
            client: client,
            freelancer: freelancer,
            amount: amount,
            reason: reason,
            createdAt: block.timestamp,
            resolved: false,
            winner: address(0),
            votingDeadline: block.timestamp + DISPUTE_VOTING_PERIOD
        });
        
        emit DisputeCreated(disputeId, projectId, client, freelancer, amount);
        return disputeId;
    }
    
    /**
     * @dev Vote on a dispute (requires SKILL token stake)
     */
    function voteOnDispute(
        uint256 disputeId,
        bool supportsClient
    ) external {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "Dispute already resolved");
        require(block.timestamp <= dispute.votingDeadline, "Voting period ended");
        require(!hasVotedOnDispute[disputeId][msg.sender], "Already voted");
        
        // Check voter has minimum stake
        uint256 votingPower = IVotes(token).getVotes(msg.sender);
        require(votingPower >= MIN_DISPUTE_STAKE, "Insufficient voting power");
        
        hasVotedOnDispute[disputeId][msg.sender] = true;
        
        if (supportsClient) {
            disputeClientVotes[disputeId] += votingPower;
        } else {
            disputeFreelancerVotes[disputeId] += votingPower;
        }
        
        emit DisputeVote(disputeId, msg.sender, supportsClient, votingPower);
    }
    
    /**
     * @dev Resolve dispute based on votes
     */
    function resolveDispute(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "Dispute already resolved");
        require(block.timestamp > dispute.votingDeadline, "Voting period not ended");
        
        uint256 clientVotes = disputeClientVotes[disputeId];
        uint256 freelancerVotes = disputeFreelancerVotes[disputeId];
        
        // Determine winner
        address winner;
        if (clientVotes > freelancerVotes) {
            winner = dispute.client;
        } else if (freelancerVotes > clientVotes) {
            winner = dispute.freelancer;
        } else {
            // Tie - split the funds
            winner = address(0);
        }
        
        dispute.resolved = true;
        dispute.winner = winner;
        
        emit DisputeResolved(disputeId, winner, clientVotes, freelancerVotes);
    }
    
    /**
     * @dev Get dispute details
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }
    
    /**
     * @dev Get dispute vote counts
     */
    function getDisputeVotes(uint256 disputeId) external view returns (uint256 clientVotes, uint256 freelancerVotes) {
        return (disputeClientVotes[disputeId], disputeFreelancerVotes[disputeId]);
    }
    
    // Override required functions
    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }
    
    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }
    
    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }
    
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
    
    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }
    
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }
    
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }
    
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }
    
    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}