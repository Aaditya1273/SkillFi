// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SkillFiMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _projectIds;
    Counters.Counter private _proposalIds;
    
    struct Project {
        uint256 id;
        address client;
        string title;
        string description;
        uint256 budget;
        uint256 deadline;
        ProjectStatus status;
        address assignedFreelancer;
        uint256 createdAt;
        string[] skills;
    }
    
    struct Proposal {
        uint256 id;
        uint256 projectId;
        address freelancer;
        uint256 bidAmount;
        string description;
        uint256 deliveryTime;
        ProposalStatus status;
        uint256 createdAt;
    }
    
    enum ProjectStatus {
        Open,
        InProgress,
        Completed,
        Cancelled,
        Disputed
    }
    
    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected
    }
    
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => uint256[]) public projectProposals;
    mapping(address => uint256[]) public userProjects;
    mapping(address => uint256[]) public userProposals;
    
    uint256 public platformFee = 250; // 2.5%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed client,
        string title,
        uint256 budget
    );
    
    event ProposalSubmitted(
        uint256 indexed proposalId,
        uint256 indexed projectId,
        address indexed freelancer,
        uint256 bidAmount
    );
    
    event ProposalAccepted(
        uint256 indexed proposalId,
        uint256 indexed projectId,
        address indexed freelancer
    );
    
    event ProjectCompleted(
        uint256 indexed projectId,
        address indexed freelancer,
        uint256 amount
    );
    
    constructor() {}
    
    function createProject(
        string memory _title,
        string memory _description,
        uint256 _deadline,
        string[] memory _skills
    ) external payable nonReentrant {
        require(msg.value > 0, "Budget must be greater than 0");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        
        _projectIds.increment();
        uint256 projectId = _projectIds.current();
        
        projects[projectId] = Project({
            id: projectId,
            client: msg.sender,
            title: _title,
            description: _description,
            budget: msg.value,
            deadline: _deadline,
            status: ProjectStatus.Open,
            assignedFreelancer: address(0),
            createdAt: block.timestamp,
            skills: _skills
        });
        
        userProjects[msg.sender].push(projectId);
        
        emit ProjectCreated(projectId, msg.sender, _title, msg.value);
    }
    
    function submitProposal(
        uint256 _projectId,
        uint256 _bidAmount,
        string memory _description,
        uint256 _deliveryTime
    ) external {
        require(projects[_projectId].id != 0, "Project does not exist");
        require(projects[_projectId].status == ProjectStatus.Open, "Project not open");
        require(projects[_projectId].client != msg.sender, "Cannot bid on own project");
        require(_bidAmount > 0, "Bid amount must be greater than 0");
        
        _proposalIds.increment();
        uint256 proposalId = _proposalIds.current();
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            projectId: _projectId,
            freelancer: msg.sender,
            bidAmount: _bidAmount,
            description: _description,
            deliveryTime: _deliveryTime,
            status: ProposalStatus.Pending,
            createdAt: block.timestamp
        });
        
        projectProposals[_projectId].push(proposalId);
        userProposals[msg.sender].push(proposalId);
        
        emit ProposalSubmitted(proposalId, _projectId, msg.sender, _bidAmount);
    }
    
    function acceptProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        Project storage project = projects[proposal.projectId];
        
        require(project.client == msg.sender, "Only client can accept proposals");
        require(project.status == ProjectStatus.Open, "Project not open");
        require(proposal.status == ProposalStatus.Pending, "Proposal not pending");
        
        proposal.status = ProposalStatus.Accepted;
        project.status = ProjectStatus.InProgress;
        project.assignedFreelancer = proposal.freelancer;
        
        // Reject all other proposals
        uint256[] memory projectProposalIds = projectProposals[proposal.projectId];
        for (uint256 i = 0; i < projectProposalIds.length; i++) {
            if (projectProposalIds[i] != _proposalId) {
                proposals[projectProposalIds[i]].status = ProposalStatus.Rejected;
            }
        }
        
        emit ProposalAccepted(_proposalId, proposal.projectId, proposal.freelancer);
    }
    
    function completeProject(uint256 _projectId) external nonReentrant {
        Project storage project = projects[_projectId];
        
        require(project.client == msg.sender, "Only client can complete project");
        require(project.status == ProjectStatus.InProgress, "Project not in progress");
        require(project.assignedFreelancer != address(0), "No freelancer assigned");
        
        project.status = ProjectStatus.Completed;
        
        uint256 platformFeeAmount = (project.budget * platformFee) / FEE_DENOMINATOR;
        uint256 freelancerAmount = project.budget - platformFeeAmount;
        
        // Transfer payment to freelancer
        (bool success, ) = project.assignedFreelancer.call{value: freelancerAmount}("");
        require(success, "Payment to freelancer failed");
        
        emit ProjectCompleted(_projectId, project.assignedFreelancer, freelancerAmount);
    }
    
    function cancelProject(uint256 _projectId) external nonReentrant {
        Project storage project = projects[_projectId];
        
        require(project.client == msg.sender, "Only client can cancel project");
        require(
            project.status == ProjectStatus.Open || project.status == ProjectStatus.InProgress,
            "Cannot cancel completed project"
        );
        
        project.status = ProjectStatus.Cancelled;
        
        // Refund client
        (bool success, ) = project.client.call{value: project.budget}("");
        require(success, "Refund failed");
    }
    
    function getProject(uint256 _projectId) external view returns (Project memory) {
        return projects[_projectId];
    }
    
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        return proposals[_proposalId];
    }
    
    function getProjectProposals(uint256 _projectId) external view returns (uint256[] memory) {
        return projectProposals[_projectId];
    }
    
    function getUserProjects(address _user) external view returns (uint256[] memory) {
        return userProjects[_user];
    }
    
    function getUserProposals(address _user) external view returns (uint256[] memory) {
        return userProposals[_user];
    }
    
    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%");
        platformFee = _fee;
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}