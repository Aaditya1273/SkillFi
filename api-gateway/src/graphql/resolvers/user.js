const User = require('../../models/User');
const FreelancerProfile = require('../../models/FreelancerProfile');
const ClientProfile = require('../../models/ClientProfile');
const { AuthenticationError, ForbiddenError, UserInputError } = require('apollo-server-express');
const { uploadToS3 } = require('../../services/fileUpload');
const sharp = require('sharp');
const logger = require('../../utils/logger');

const userResolvers = {
  Query: {
    me: async (parent, args, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      return await User.findById(user.id)
        .populate('freelancerProfile')
        .populate('clientProfile');
    },

    user: async (parent, { id }) => {
      const user = await User.findById(id)
        .select('-email -password')
        .populate('freelancerProfile')
        .populate('clientProfile');

      if (!user) {
        throw new UserInputError('User not found');
      }

      return user;
    },

    users: async (parent, args) => {
      const {
        search,
        skills,
        category,
        experienceLevel,
        minRate,
        maxRate,
        location,
        page = 1,
        limit = 20
      } = args;

      const query = { isActive: true };
      
      // Build search criteria
      if (skills && skills.length > 0) {
        query['freelancerProfile.skills.name'] = { $in: skills };
      }

      if (category) {
        query['freelancerProfile.categories'] = category;
      }

      if (experienceLevel) {
        query['freelancerProfile.experienceLevel'] = experienceLevel;
      }

      if (minRate || maxRate) {
        query['freelancerProfile.hourlyRate'] = {};
        if (minRate) query['freelancerProfile.hourlyRate'].$gte = minRate;
        if (maxRate) query['freelancerProfile.hourlyRate'].$lte = maxRate;
      }

      if (location) {
        query.$or = [
          { 'location.country': new RegExp(location, 'i') },
          { 'location.city': new RegExp(location, 'i') }
        ];
      }

      if (search) {
        query.$text = { $search: search };
      }

      const skip = (page - 1) * limit;

      const [users, totalCount] = await Promise.all([
        User.find(query)
          .populate('freelancerProfile')
          .populate('clientProfile')
          .sort(search ? { score: { $meta: 'textScore' } } : { reputation: -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(query)
      ]);

      const edges = users.map((user, index) => ({
        node: user,
        cursor: Buffer.from(`${skip + index}`).toString('base64')
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + limit < totalCount,
          hasPreviousPage: page > 1,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount
      };
    },

    freelancers: async (parent, args) => {
      const {
        skills,
        category,
        experienceLevel,
        minRate,
        maxRate,
        location,
        availability,
        page = 1,
        limit = 20
      } = args;

      const query = { isActive: true };

      if (skills && skills.length > 0) {
        query['skills.name'] = { $in: skills };
      }

      if (category) {
        query.categories = category;
      }

      if (experienceLevel) {
        query.experienceLevel = experienceLevel;
      }

      if (minRate || maxRate) {
        query.hourlyRate = {};
        if (minRate) query.hourlyRate.$gte = minRate;
        if (maxRate) query.hourlyRate.$lte = maxRate;
      }

      if (availability !== undefined) {
        query.isAvailable = availability;
      }

      const skip = (page - 1) * limit;

      const [freelancers, totalCount] = await Promise.all([
        FreelancerProfile.find(query)
          .populate('userId', 'firstName lastName avatar reputation')
          .sort({ reputation: -1, completedProjects: -1 })
          .skip(skip)
          .limit(limit),
        FreelancerProfile.countDocuments(query)
      ]);

      const edges = freelancers.map((freelancer, index) => ({
        node: freelancer,
        cursor: Buffer.from(`${skip + index}`).toString('base64')
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + limit < totalCount,
          hasPreviousPage: page > 1,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount
      };
    }
  },

  Mutation: {
    updateProfile: async (parent, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      const updatedUser = await User.findByIdAndUpdate(
        user.id,
        { $set: input },
        { new: true, runValidators: true }
      ).populate('freelancerProfile').populate('clientProfile');

      return updatedUser;
    },

    updateFreelancerProfile: async (parent, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      const profileData = {
        ...input,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`.trim()
      };

      const profile = await FreelancerProfile.findOneAndUpdate(
        { userId: user.id },
        profileData,
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      );

      // Update user type
      await User.findByIdAndUpdate(user.id, {
        $addToSet: { userType: 'freelancer' }
      });

      return profile;
    },

    updateClientProfile: async (parent, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      const profile = await ClientProfile.findOneAndUpdate(
        { userId: user.id },
        { ...input, userId: user.id },
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      );

      // Update user type
      await User.findByIdAndUpdate(user.id, {
        $addToSet: { userType: 'client' }
      });

      return profile;
    },

    updateUserSettings: async (parent, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      const updates = {};
      if (input.notifications) {
        updates.notifications = input.notifications;
      }
      if (input.preferences) {
        updates.preferences = input.preferences;
      }

      const updatedUser = await User.findByIdAndUpdate(
        user.id,
        { $set: updates },
        { new: true }
      ).populate('freelancerProfile').populate('clientProfile');

      return updatedUser;
    },

    connectWallet: async (parent, { walletAddress, signature }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Verify wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        throw new UserInputError('Invalid wallet address format');
      }

      // Check if wallet is already connected to another user
      const existingUser = await User.findOne({ 
        walletAddress,
        _id: { $ne: user.id }
      });

      if (existingUser) {
        throw new UserInputError('Wallet address already connected to another account');
      }

      // TODO: Verify signature
      // const isValidSignature = await verifyWalletSignature(walletAddress, signature, user.id);
      // if (!isValidSignature) {
      //   throw new UserInputError('Invalid signature');
      // }

      const updatedUser = await User.findByIdAndUpdate(
        user.id,
        { walletAddress },
        { new: true }
      ).populate('freelancerProfile').populate('clientProfile');

      return updatedUser;
    },

    uploadAvatar: async (parent, { file }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      try {
        const { createReadStream, mimetype } = await file;
        
        if (!mimetype.startsWith('image/')) {
          throw new UserInputError('File must be an image');
        }

        const stream = createReadStream();
        const chunks = [];
        
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);

        // Process image with Sharp
        const processedImage = await sharp(buffer)
          .resize(300, 300, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 90 })
          .toBuffer();

        // Upload to S3
        const filename = `avatars/${user.id}-${Date.now()}.jpg`;
        const avatarUrl = await uploadToS3(processedImage, filename, 'image/jpeg');

        // Update user avatar
        const updatedUser = await User.findByIdAndUpdate(
          user.id,
          { avatar: avatarUrl },
          { new: true }
        ).populate('freelancerProfile').populate('clientProfile');

        return updatedUser;
      } catch (error) {
        logger.error('Error uploading avatar:', error);
        throw new Error('Failed to upload avatar');
      }
    }
  },

  User: {
    fullName: (user) => {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
    },

    freelancerProfile: async (user) => {
      if (user.freelancerProfile) return user.freelancerProfile;
      return await FreelancerProfile.findOne({ userId: user._id });
    },

    clientProfile: async (user) => {
      if (user.clientProfile) return user.clientProfile;
      return await ClientProfile.findOne({ userId: user._id });
    }
  },

  FreelancerProfile: {
    userId: (profile) => profile.userId
  },

  ClientProfile: {
    userId: (profile) => profile.userId
  }
};

module.exports = userResolvers;