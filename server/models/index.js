/**
 * Models Index
 * Export all Mongoose models from a single location
 */

const User = require('./User');
const Category = require('./Category');
const Quiz = require('./Quiz');
const Question = require('./Question');
const Result = require('./Result');

module.exports = {
    User,
    Category,
    Quiz,
    Question,
    Result
};
