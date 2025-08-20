const System = require("../models/System");

/**
 * Updates the followers count in the system based on actual copy trading users
 * @returns {Promise<number>} The updated followers count
 */
const updateFollowersCount = async () => {
  try {
    // Count users with status "COPYING"
    const User = require("../models/User");
    const activeFollowers = await User.countDocuments({ status: "COPYING" });
    
    // Update the system document with the new count
    await System.findOneAndUpdate(
      { admin: true },
      { followers: activeFollowers },
      { new: true }
    );
    
    // Update global variable for immediate use
    if (global.masterDetails) {
      global.masterDetails.followers = activeFollowers;
    }
    
    console.log(`Followers count updated: ${activeFollowers}`);
    return activeFollowers;
  } catch (error) {
    console.error("Error updating followers count:", error);
    return 0;
  }
};

module.exports = updateFollowersCount;
