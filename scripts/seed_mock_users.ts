
import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models/User";
import { getMockUsersList } from "../src/middleware/customClerkMw";

async function seedMockUsers() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri, {
    dbName: "dialist_development"
  });
  
  const mockUsers = getMockUsersList();
  console.log(`Found ${mockUsers.length} mock users to seed.`);

  for (const mock of mockUsers) {
    const claims = mock.claims;
    const email = `mock_${mock.id}@example.com`;
    
    // Default values based on mock data
    const userData = {
      external_id: mock.id,
      email: email,
      display_name: claims.display_name || mock.name,
      first_name: mock.name.split(' ')[0],
      last_name: mock.name.split(' ').slice(1).join(' ') || '',
      profile_image_url: claims.display_avatar,
      onboarding_status: claims.onboarding_status || 'completed',
      metadata: claims,
      
      // Map other claims
      marketplace_published: !!claims.onboarding_state && claims.onboarding_state === 'APPROVED',
      networks_accessed: !!claims.networks_accessed,
      
      // Default empty arrays/objects if needed
      saved_listings: [],
      recent_searches: []
    };

    try {
      // Upsert user
      const result = await User.findOneAndUpdate(
        { external_id: mock.id },
        { $set: userData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✅ Seeded user: ${mock.name} (${mock.id}) -> ${result._id}`);
    } catch (err) {
      console.error(`❌ Failed to seed user ${mock.name}:`, err);
    }
  }

  console.log("Seeding complete.");
  await mongoose.disconnect();
}

seedMockUsers().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
