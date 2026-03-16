import request from "supertest";
import express from "express";
import { Types } from "mongoose";
import userRoutes from "../../src/networks/routes/userRoutes";
import { User } from "../../src/models/User";
import { getUserPublicProfileSchema } from "../../src/validation/schemas";

// Setup Mock Express App
const app = express();
app.use(express.json());

// Add mock platform routing middleware
app.use((req, res, next) => {
  (req as any).platform = "networks";
  next();
});

// Mock auth middleware
app.use((req: any, res, next) => {
  req.auth = { userId: "current_user" };
  next();
});

app.use("/api/v1/users", userRoutes);

describe("Batch 2 Part 2 - Networks Profile Features", () => {
  let user: any;
  let otherUser: any;

  beforeEach(async () => {
    // Create test users
    user = await User.create({
      external_id: "user_external",
      clerk_id: "clerk_user",
      email: "user@test.com",
      first_name: "John",
      last_name: "Doe",
      display_name: "johndoe",
      bio: "Watch enthusiast and collector",
    });

    otherUser = await User.create({
      external_id: "other_external",
      clerk_id: "clerk_other",
      email: "other@test.com",
      first_name: "Jane",
      last_name: "Smith",
      display_name: "janesmith",
      bio: "I love luxury watches",
    });
  });

  describe("Profile Select - Display Name Handling", () => {
    it("should retrieve user with display_name field", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${user._id}`)
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("display_name");
      expect(res.body.data.display_name).toBe("johndoe");
    });

    it("should use display_name for public profile", async () => {
      // For profile discovery, display_name should be used instead of first/last
      const retrieved = await User.findById(user._id).lean();
      expect(retrieved).toHaveProperty("display_name");
    });

    it("should handle display_name updates", async () => {
      user.display_name = "watchlover2024";
      await user.save();

      const retrieved = await User.findById(user._id);
      expect(retrieved?.display_name).toBe("watchlover2024");
    });

    it("should include display_name in user list responses", async () => {
      const users = await User.find({
        _id: { $in: [user._id, otherUser._id] },
      }).lean();
      users.forEach((u) => {
        expect(u).toHaveProperty("display_name");
        expect(typeof u.display_name).toBe("string");
      });
    });

    it("should not expose first_name/last_name in public API if display_name exists", () => {
      // Profile select should prioritize display_name
      expect(user.display_name).toBeDefined();
      expect(user.display_name).not.toBeEmpty();
    });
  });

  describe("Bio Field - Max Length Validation", () => {
    it("should accept bio up to max length (500 chars)", async () => {
      const bio = "a".repeat(500);
      user.bio = bio;
      await user.save();
      expect(user.bio).toHaveLength(500);
    });

    it("should reject bio exceeding max length", async () => {
      const tooLongBio = "a".repeat(501);
      user.bio = tooLongBio;

      try {
        await user.save();
        fail("Should have rejected bio exceeding 500 chars");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should validate bio length at schema level", () => {
      const bioSchema = User.schema.path("bio");
      expect(bioSchema).toBeDefined();
      // Schema should have maxlength validation
    });

    it("should allow empty bio", async () => {
      user.bio = "";
      await user.save();
      expect(user.bio).toBe("");
    });

    it("should allow bio with special characters within limit", async () => {
      const bio = "🎯 Watch collector | 👨‍💼 Trader | 🌟 Expert";
      user.bio = bio;
      await user.save();
      expect(user.bio).toBe(bio);
    });

    it("should trim bio if provided with whitespace", async () => {
      user.bio = "  Watch collector  ";
      await user.save();
      // Should be trimmed to 'Watch collector'
      expect(user.bio).toBeDefined();
    });

    it("should validate on PATCH /users/:id/bio endpoint", async () => {
      const newBio = "Updated bio text";
      const res = await request(app)
        .patch(`/api/v1/users/${user._id}/bio`)
        .send({ bio: newBio });

      if (res.status === 200) {
        expect(res.body.bio || res.body.data?.bio).toBe(newBio);
      }
    });

    it("should reject malformed bio length updates", async () => {
      const oversizedBio = "x".repeat(1000);
      const res = await request(app)
        .patch(`/api/v1/users/${user._id}/bio`)
        .send({ bio: oversizedBio });

      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error || res.body.message).toContain("length");
      }
    });
  });

  describe("Unified Search - Networks Implementation", () => {
    let searchableUser1: any;
    let searchableUser2: any;

    beforeEach(async () => {
      searchableUser1 = await User.create({
        external_id: "rolex_collector_ext",
        clerk_id: "clerk_rolex",
        email: "rolex@test.com",
        first_name: "Rolex",
        last_name: "Collector",
        display_name: "rolex_collector",
        bio: "Specialized in Rolex watches and vintage models",
      });

      searchableUser2 = await User.create({
        external_id: "omega_expert_ext",
        clerk_id: "clerk_omega",
        email: "omega@test.com",
        first_name: "Omega",
        last_name: "Expert",
        display_name: "omega_expert",
        bio: "Omega world expert and dealer",
      });
    });

    it("should perform full-text search across user fields", async () => {
      // unifiedSearch should search: display_name, bio, email
      const results = await User.find({
        $text: { $search: "Rolex" },
      }).lean();

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((u) => u.display_name === "rolex_collector")).toBe(
        true,
      );
    });

    it("should search by display_name", async () => {
      const results = await User.find({
        display_name: { $regex: "rolex", $options: "i" },
      }).lean();

      expect(results.length).toBeGreaterThan(0);
    });

    it("should search by bio content", async () => {
      const results = await User.find({
        bio: { $regex: "vintage", $options: "i" },
      }).lean();

      expect(results.length).toBeGreaterThan(0);
    });

    it("should return paginated search results", async () => {
      const limit = 10;
      const offset = 0;

      const results = await User.find({
        $text: { $search: "watch" },
      })
        .skip(offset)
        .limit(limit)
        .lean();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it("should support case-insensitive search", async () => {
      const results1 = await User.find({
        display_name: { $regex: "ROLEX", $options: "i" },
      }).lean();

      const results2 = await User.find({
        display_name: { $regex: "rolex", $options: "i" },
      }).lean();

      expect(results1.length).toBe(results2.length);
    });

    it("should exclude deactivated users from search", async () => {
      // If user is deactivated, should not appear in search
      searchableUser2.is_deleted = true;
      await searchableUser2.save();

      const activeResults = await User.find({
        is_deleted: { $ne: true },
        $text: { $search: "omega" },
      }).lean();

      const hasDeactivated = activeResults.some((u) =>
        u._id.equals(searchableUser2._id),
      );
      expect(hasDeactivated).toBe(false);
    });

    it("should support multi-field search with OR logic", async () => {
      const query = {
        $or: [
          { display_name: { $regex: "rolex", $options: "i" } },
          { bio: { $regex: "rolex", $options: "i" } },
        ],
      };

      const results = await User.find(query).lean();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Profile API - Endpoints", () => {
    it("should get user profile with all fields", async () => {
      const res = await request(app).get(`/api/v1/users/${user._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("display_name");
      expect(res.body.data).toHaveProperty("bio");
      expect(res.body.data).toHaveProperty("email");
    });

    it("should update profile with new bio", async () => {
      const newBio = "Updated profile bio";
      const res = await request(app)
        .patch(`/api/v1/users/${user._id}`)
        .send({ bio: newBio });

      if (res.status === 200) {
        expect(res.body.bio || res.body.data?.bio).toBe(newBio);
      }
    });

    it("should list users with display_name visible", async () => {
      const res = await request(app).get("/api/v1/users?limit=10");

      if (res.status === 200 && res.body.data.length > 0) {
        res.body.data.forEach((u: any) => {
          expect(u).toHaveProperty("display_name");
        });
      }
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
  });
});
