# 🔄 Dialist Database Migration Guide

This guide explains how to migrate your current MongoDB data to a new database provided by the client, ensuring all your recent changes (Chat, Listings, etc.) are preserved.

---

## 🛠️ Step 1: Export Current Data (Backup)

You need to create a "dump" of your current local or staging database.

1. Open your terminal.
2. Run the following command (assuming your current DB is local):
   ```bash
   mongodump --uri="YOUR_CURRENT_MONGODB_URI" --out="./dialist_backup"
   ```
   *Replace `YOUR_CURRENT_MONGODB_URI` with the URI currently in your `.env` file.*

---

## 🚀 Step 2: Import to New Database

Now, push that data to the client's new database.

1. Get the **New MongoDB URI** from your client.
2. Run the restore command:
   ```bash
   mongorestore --uri="NEW_CLIENT_MONGODB_URI" ./dialist_backup
   ```
   *Replace `NEW_CLIENT_MONGODB_URI` with the new connection string.*

---

## 📝 Step 3: Update Environment Variables

Once the data is moved, you need to tell the API to look at the new location.

1. Open your `.env` file in the root directory.
2. Modify the `MONGODB_URI` line:
   ```env
   # OLD: MONGODB_URI=mongodb://localhost:27017/dialist
   MONGODB_URI=mongodb+srv://user:password@new-cluster.mongodb.net/dialist_new
   ```
3. Restart your server: `npm run dev`

---

## ⚠️ Important Considerations

### 1. GetStream Data
Remember that **GetStream** is an external service. 
- Your **Messages, Channels, and Users** that live inside Stream's dashboard won't move. 
- However, because we save a "Copy" of everything in MongoDB, your Chat history will appear in the new DB as long as you follow Steps 1 & 2.
- **Critical**: Ensure the `GETSTREAM_API_KEY` in your `.env` remains the same, otherwise the IDs in the new DB won't match the IDs in Stream.

### 2. User Authentication (Clerk)
Since we use **Clerk**, the `external_id` (e.g., `user_2N...`) in the database must match the user currently logged into the frontend. 
- If the client is using a **new Clerk Instance**, you will need to re-link or re-onboard users.
- If the client is using the **same Clerk Instance**, the migration will be seamless.

---

## ✅ Step 4: Verification Checklist

After migration, check these things in the new environment:
- [ ] **Auth**: Can you log in? 
- [ ] **Listings**: Do the old listings show up?
- [ ] **Chat**: Can you see previous messages in the `/chat` dashboard?
- [ ] **Inquiry**: Can you start a *new* inquiry? (Verifies that DB writes are working).

---

**Pro Tip:** Always keep the `./dialist_backup` folder safe until you've confirmed the new database is 100% working! 🛡️
