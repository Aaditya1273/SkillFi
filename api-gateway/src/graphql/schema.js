const { makeExecutableSchema } = require('@graphql-tools/schema');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs, mergeResolvers } = require('@graphql-tools/merge');
const path = require('path');

// Load type definitions
const typeDefsArray = loadFilesSync(path.join(__dirname, 'typeDefs'), {
  extensions: ['graphql', 'gql']
});

// Load resolvers
const resolversArray = loadFilesSync(path.join(__dirname, 'resolvers'), {
  extensions: ['js']
});

// Merge type definitions and resolvers
const typeDefs = mergeTypeDefs(typeDefsArray);
const resolvers = mergeResolvers(resolversArray);

// Create executable schema
const createGraphQLSchema = () => {
  return makeExecutableSchema({
    typeDefs,
    resolvers
  });
};

module.exports = { createGraphQLSchema };