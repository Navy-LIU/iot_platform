const express = require('express');
const { User } = require('../models');
const { createError } = require('../utils');
const { asyncHandler } = require('../middleware');

const router = express.Router();

/**
 * @route   GET /api/user/profile/:id
 * @desc    Get user profile by ID
 * @access  Public
 */
router.get('/profile/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate ID
  const userId = parseInt(id);
  if (isNaN(userId) || userId < 1) {
    throw createError.badRequest('Invalid user ID');
  }

  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw createError.userNotFound(userId);
  }

  res.json({
    success: true,
    message: 'User profile retrieved successfully',
    data: {
      user: user.toPublicJSON()
    }
  });
}));

/**
 * @route   PUT /api/user/profile/:id
 * @desc    Update user profile by ID
 * @access  Public
 */
router.put('/profile/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  // Validate ID
  const userId = parseInt(id);
  if (isNaN(userId) || userId < 1) {
    throw createError.badRequest('Invalid user ID');
  }

  // Validate input
  if (!email) {
    throw createError.missingFields(['email']);
  }

  // Validate email format
  if (!User.isValidEmail(email)) {
    throw createError.invalidEmail(email);
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw createError.userNotFound(userId);
  }

  // Check if email is already taken by another user
  if (email.toLowerCase() !== user.email.toLowerCase()) {
    const existingUser = await User.findByEmail(email);
    if (existingUser && existingUser.id !== user.id) {
      throw createError.userAlreadyExists(email);
    }
  }

  try {
    // Update user
    await user.update({ email: email.toLowerCase().trim() });

    // Log profile update
    console.log(`✅ User profile updated: ${user.email} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    // Handle database errors
    if (error.message && error.message.includes('already exists')) {
      throw createError.userAlreadyExists(email);
    }
    
    throw error;
  }
}));

/**
 * @route   GET /api/user/:id
 * @desc    Get user by ID (public profile)
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate ID
  const userId = parseInt(id);
  if (isNaN(userId) || userId < 1) {
    throw createError.badRequest('Invalid user ID');
  }

  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw createError.userNotFound(userId);
  }

  res.json({
    success: true,
    message: 'User profile retrieved successfully',
    data: {
      user: user.toPublicJSON()
    }
  });
}));

/**
 * @route   DELETE /api/user/profile/:id
 * @desc    Delete user account by ID
 * @access  Public
 */
router.delete('/profile/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { confirmPassword } = req.body;

  // Validate ID
  const userId = parseInt(id);
  if (isNaN(userId) || userId < 1) {
    throw createError.badRequest('Invalid user ID');
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw createError.userNotFound(userId);
  }

  // Require password confirmation for account deletion
  if (!confirmPassword) {
    throw createError.missingFields(['confirmPassword']);
  }

  // Verify password
  const isPasswordValid = await user.verifyPassword(confirmPassword);
  if (!isPasswordValid) {
    throw createError.authenticationFailed('Invalid password confirmation');
  }

  try {
    // Delete user account
    await user.delete();

    // Log account deletion
    console.log(`🗑️  User account deleted: ${user.email} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    throw createError.internalError('Failed to delete account');
  }
}));

/**
 * @route   POST /api/user/change-password/:id
 * @desc    Change user password by ID
 * @access  Public
 */
router.post('/change-password/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  // Validate ID
  const userId = parseInt(id);
  if (isNaN(userId) || userId < 1) {
    throw createError.badRequest('Invalid user ID');
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw createError.userNotFound(userId);
  }

  // Validate required fields
  if (!currentPassword || !newPassword) {
    throw createError.missingFields(['currentPassword', 'newPassword']);
  }

  // Validate new password confirmation
  if (confirmNewPassword && newPassword !== confirmNewPassword) {
    throw createError.validationFailed('New passwords do not match', ['confirmNewPassword']);
  }

  // Verify current password
  const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw createError.authenticationFailed('Current password is incorrect');
  }

  // Validate new password strength
  if (!User.isValidPassword(newPassword)) {
    throw createError.invalidPassword('New password must be at least 6 characters long');
  }

  // Check if new password is different from current
  const isSamePassword = await user.verifyPassword(newPassword);
  if (isSamePassword) {
    throw createError.validationFailed('New password must be different from current password');
  }

  try {
    // Update password
    await user.updatePassword(newPassword);

    // Log password change
    console.log(`🔐 Password changed for user: ${user.email} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    throw createError.internalError('Failed to change password');
  }
}));

/**
 * @route   GET /api/user/stats/:id
 * @desc    Get user statistics by ID
 * @access  Public
 */
router.get('/stats/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate ID
  const userId = parseInt(id);
  if (isNaN(userId) || userId < 1) {
    throw createError.badRequest('Invalid user ID');
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw createError.userNotFound(userId);
  }

  // Calculate account age
  const accountAge = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

  res.json({
    success: true,
    message: 'User statistics retrieved successfully',
    data: {
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        accountAgeDays: accountAge
      }
    }
  });
}));

module.exports = router;