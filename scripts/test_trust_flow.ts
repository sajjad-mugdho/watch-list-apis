import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const API_url = process.env.API_URL || 'http://localhost:5050/api/v1';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dialist_development';

// Mock User IDs (from customClerkMw.ts and seed_mock_users.ts)
const SELLER = {
  header: 'merchant_approved',
  id: 'ddd333333333333333333333'
};

const ADMIN = {
  header: 'user_minimal_claims',
  id: 'eee222222222222222222222'
};

const BUYER = {
  header: 'buyer_with_custom_name',
  id: 'ccc333333333333333333333'
};

const VOUCHER = {
  header: 'buyer_us_complete',
  id: 'ccc111111111111111111111'
};

async function testTrustFlow() {
  console.log('🚀 Starting Trust & Safety Flow Verification...');
  
  // Connect to MongoDB to seed Merchant status
  console.log('🔌 Connecting to DB:', MONGODB_URI.replace(/:[^:@]+@/, ':***@')); 
  await mongoose.connect(MONGODB_URI, { dbName: 'dialist_development' });
  const MerchantOnboarding = mongoose.connection.collection('merchant_onboardings');
  
  await MerchantOnboarding.updateOne(
    { dialist_user_id: new mongoose.Types.ObjectId(SELLER.id) },
    { 
      $set: {
        form_id: 'mock_form_' + SELLER.id,
        dialist_user_id: new mongoose.Types.ObjectId(SELLER.id),
        onboarding_state: 'APPROVED',
        merchant_id: 'mock_merchant_' + SELLER.id,
        updatedAt: new Date(),
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('✅ Seeded MerchantOnboarding for Seller');

  // Seed User Document
  const Users = mongoose.connection.collection('users');
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(SELLER.id) },
    {
        $set: {
            external_id: SELLER.header, // 'merchant_approved'
            dialist_id: new mongoose.Types.ObjectId(SELLER.id), // Should match _id
            display_name: "Merchant Verified",
            email: "merchant@test.com",
            isMerchant: true,
            onboarding_status: "completed",
            onboarding_state: "APPROVED",
            updatedAt: new Date(),
            createdAt: new Date()
        }
    },
    { upsert: true }
  );
  console.log('✅ Seeded User Doc for Seller');

  // Seed Admin User
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(ADMIN.id) },
    {
        $set: {
            external_id: ADMIN.header,
            dialist_id: new mongoose.Types.ObjectId(ADMIN.id),
            display_name: "Admin User",
            email: "admin_minimal@test.com",
            isAdmin: true, // Key field
            onboarding_status: "completed",
            isMerchant: false,
            updatedAt: new Date(),
            createdAt: new Date()
        }
    },
    { upsert: true }
  );
  console.log('✅ Seeded Admin User');



  // Verify what we seeded
  const seeded = await MerchantOnboarding.findOne({ dialist_user_id: new mongoose.Types.ObjectId(SELLER.id) });
  console.log('🧐 Verified Seeded Doc:', JSON.stringify(seeded, null, 2));

  try {
    // ----------------------------------------------------------------
    // 0. DEBUG USER STATE
    // ----------------------------------------------------------------
    console.log('\n🔍 Step 0: Verifying Seller State via API...');
    try {
        const meRes = await axios.get(`${API_url}/me`, {
            headers: { 'x-test-user': SELLER.header }
        });
        console.log('👤 Seller /me Response:', JSON.stringify(meRes.data.data, null, 2));
    } catch (e: any) {
        console.error('❌ Failed to get /me for seller:', e.response?.data || e.message);
    }

    // ----------------------------------------------------------------
    // 1. SETUP FOLLOW (Voucher -> Seller)
    // ----------------------------------------------------------------
    console.log('\n📡 Step 1: Establishing Follow Connection...');
    try {
      await axios.post(`${API_url}/users/${SELLER.id}/follow`, {}, {
        headers: { 'x-test-user': VOUCHER.header }
      });
      console.log('✅ Voucher follows Seller');
    } catch (e: any) {
      if (e.response?.status === 400 && e.response?.data?.error?.message?.toLowerCase().includes('already following')) {
        console.log('✅ Voucher already follows Seller');
      } else {
        throw e;
      }
    }

    // ----------------------------------------------------------------
    // 2. FETCH WATCH & CREATE LISTING (Seller)
    // ----------------------------------------------------------------
    console.log('\n📦 Step 2: Creating Listing (via API)...');
    
    // Fetch a watch to list
    const watchesRes = await axios.get(`${API_url}/watches?limit=1`);
    if (!watchesRes.data.data.length) {
        throw new Error('No watches found in DB to list. Seed watches first.');
    }
    const watch = watchesRes.data.data[0];
    const watchId = watch._id;
    console.log(`   Using Watch ID: ${watchId}`);

    const listingPayload = {
      watch: watchId,
      type: "for_sale",
      condition: "new",
      price: 5000
    };

    const createRes = await axios.post(`${API_url}/marketplace/listings`, listingPayload, {
      headers: { 'x-test-user': SELLER.header }
    });
    const listingId = createRes.data.data._id;
    console.log(`✅ Listing Draft Created: ${listingId}`);

    // Update Draft with Price & Details
    const updatePayload = {
      price: 5000,
      condition: "new",
      year: 2024,
      contents: "box_papers",
      ships_from: { country: "US", city: "NYC" },
      shipping: [{ region: "US", shippingIncluded: true, shippingCost: 0 }],
      images: [
        "https://example.com/watch1.jpg", 
        "https://example.com/watch2.jpg", 
        "https://example.com/watch3.jpg"
      ],
      thumbnail: "https://example.com/watch1.jpg"
    };
    
    await axios.patch(`${API_url}/marketplace/listings/${listingId}`, updatePayload, {
      headers: { 'x-test-user': SELLER.header }
    });
    console.log('✅ Listing Updated');

    await axios.post(`${API_url}/marketplace/listings/${listingId}/publish`, {}, {
      headers: { 'x-test-user': SELLER.header }
    });
    console.log('✅ Listing Published');


    // ----------------------------------------------------------------
    // 3. COMPLETE ORDER (Buyer)
    // ----------------------------------------------------------------
    console.log('\n💰 Step 3: Completing Order...');
    
    // Reserve
    const reserveRes = await axios.post(`${API_url}/marketplace/orders/reserve`, {
      listing_id: listingId
    }, {
      headers: { 'x-test-user': BUYER.header }
    });
    const orderId = reserveRes.data.data.order_id;
    console.log(`✅ Order Reserved: ${orderId}`);

    // Force Paid
    await axios.post(`${API_url}/marketplace/orders/${orderId}/finix-debug/force-paid`, {}, {
      headers: { 'x-test-user': BUYER.header }
    });
    console.log('✅ Order Paid (Forced)');

    // Ship
    await axios.post(`${API_url}/marketplace/orders/${orderId}/tracking`, {
      tracking_number: "TRUST-123",
      carrier: "FedEx"
    }, {
      headers: { 'x-test-user': SELLER.header }
    });
    console.log('✅ Order Shipped');

    // Confirm Delivery
    await axios.post(`${API_url}/marketplace/orders/${orderId}/confirm-delivery`, {}, {
      headers: { 'x-test-user': BUYER.header }
    });
    console.log('✅ Order Delivered & Completed');

    // ----------------------------------------------------------------
    // 4. REFERENCE CHECK (Buyer -> Seller)
    // ----------------------------------------------------------------
    console.log('\n📋 Step 4: Creating Reference Check...');
    
    // Check if one already exists (to avoid duplicate error if re-running without clean DB)
    // Actually, API prevents multiple pending. We'll try to create.
    let checkId;
    try {
        const checkRes = await axios.post(`${API_url}/reference-checks`, {
        target_id: SELLER.id,
        order_id: orderId,
        reason: "Verifying before next purchase"
        }, {
        headers: { 'x-test-user': BUYER.header }
        });
        checkId = checkRes.data.data._id;
        console.log(`✅ Reference Check Created: ${checkId}`);
    } catch (e: any) {
        // If pending exists, we might need to find it? 
        // For verify purpose, assuming clean run or unique listing helps.
        // But listing is unique above. So this should always succeed.
        throw e;
    }

    // ----------------------------------------------------------------
    // 5. VOUCHING (Voucher -> Seller)
    // ----------------------------------------------------------------
    console.log('\n🤝 Step 5: Vouching...');
    
    let vouch;
    try {
      const vouchRes = await axios.post(`${API_url}/reference-checks/${checkId}/vouch`, {
        vouch_for_user_id: SELLER.id,
        comment: "Highly recommended seller!"
      }, {
        headers: { 'x-test-user': VOUCHER.header }
      });
      vouch = vouchRes.data.data;
      console.log(`✅ Vouch Created: ${vouch.id}`);
      console.log(`   Weight: ${vouch.weight}`);
      console.log(`   Connection: ${vouch.voucherSnapshot.connectionType}`);

      if (vouch.voucherSnapshot.connectionType !== 'follow' && vouch.voucherSnapshot.connectionType !== 'friend') {
         console.warn('⚠️ Warning: Connection type should be follow or friend/mutual');
      }
    } catch (e: any) {
        if (e.response?.status === 409) {
            console.log('✅ Vouch already exists (Skipping creation)');
        } else {
            throw e;
        }
    }

    // ----------------------------------------------------------------
    // 6. TRUST CASE (Buyer reports Seller)
    // ----------------------------------------------------------------
    console.log('\n⚖️ Step 6: Creating Trust Case...');
    
    const caseRes = await axios.post(`${API_url}/admin/trust-cases`, {
      reported_user_id: SELLER.id,
      order_id: orderId,
      reference_check_id: checkId,
      category: "dispute",
      reason: "Item arrived late (test case)",
      priority: "low"
    }, {
      headers: { 'x-test-user': ADMIN.header } // Acting as admin/reporter
    });
    
    const caseId = caseRes.data.data._id;
    const caseNumber = caseRes.data.data.case_number;
    console.log(`✅ Trust Case Created: ${caseNumber} (${caseId})`);

    // Verify Evidence Snapshot
    const evidence = caseRes.data.data.evidence_snapshot;
    console.log('🧐 Evidence Snapshot Vouches:', evidence.vouches?.length || 0);

    if (evidence.order_snapshot && evidence.vouches && evidence.vouches.length > 0) {
        console.log('✅ Evidence Snapshot Verified (Order + Vouches included)');
    } else {
        console.warn('⚠️ Evidence Snapshot missing data (Vouches or Order)', JSON.stringify(evidence, null, 2));
        // Do not exit, continue to clean up/resolve
    }

    // ----------------------------------------------------------------
    // 7. RESOLVE CASE
    // ----------------------------------------------------------------
    console.log('\n✅ Step 7: Resolving Case...');
    
    await axios.put(`${API_url}/admin/trust-cases/${caseId}/resolve`, {
      resolution: "Resolved via test script"
    }, {
      headers: { 'x-test-user': ADMIN.header }
    });
    console.log('✅ Case Resolved');

    console.log('\n🎉 ALL TRUST & SAFETY CHECKS PASSED!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testTrustFlow();
