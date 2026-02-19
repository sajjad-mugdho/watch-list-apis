
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5050/api/v1';

// TOKENS PROVIDED BY USER
const SELLER_TOKEN = "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE1MzAwMTEsImlhdCI6MTc3MTQzMDAxMSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjJhNmY1OWY0MzY3ZTE5NjViMjUyIiwibmJmIjoxNzcxNDI5OTgxLCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.n8KDsqmucdqQye21fqf_re3AoFMMyvyZZbwUjWJFvHMG6Bm0Yp0BMMG3lcZMiXnrc_QkxydI6lqvcCdoHXxa1i6LGLYuJoiu5pAHs9_dUW1fV2mRlsLMa4tJTtROtr8PAgamnhxlB_nijDzPT1DAjwAxbp11G0YNNM7wIwUOPd7OiTG8BWJCyFm4ovGKc6LncN9OUl2irqt_lBbImdwS_v_ASgdu2rMEkhyggE6qERzfLe_odQEwgaTBdPbByJSVm7yU6qkfzt2DbURFVeNUJ2Hn0N6vLRWXfSCzJ0XJOVnrhFY9MTs03ghF1PCySNHowmlGhqbZ0WvWZJbeM91u_w";

const BUYER_TOKEN = "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE1MzAwNTUsImlhdCI6MTc3MTQzMDA1NSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjA4MWQyMDI4Yzc1YmE5MzUxMWVhIiwibmJmIjoxNzcxNDMwMDI1LCJzdWIiOiJ1c2VyXzM2T0tweUxaTXJmNFhZOHRJRHVoUktqSjZUayJ9.P7VbCTH9-PALb2MMn1BJB8keBNLMMxhRdhVHF8NwcojL7UCcXhYpcyPDz8dahABJQqwP2zVNzRzg2LYqj4ho6pd671KjYjWFZI6M6NYZT0IxFI8zj5Yk0eYxzqeczZ3RnTGF2pA8ZVuNtm2jLKbzlkMLNiYBxAUzyzLUt9F-XtLQ-y7SV2WTxhlQ7eh7j0kbQ9_QdWxH4bR6PkfyjSMvaRqjBfXZGHgdbrBUGEH4dIUbu59AjbsnCCgCn7VY9bpqXBcSaSq-UueMSgqMzQtnpN1slVW60hhKv1YQZFkE3CfL1SZ3f3pEGeQpVt0icHAiWbrW91_cUtP9IivX-rFecw";

// Configuration for Axios
const sellerClient = axios.create({
  baseURL: API_URL,
  headers: { Authorization: `Bearer ${SELLER_TOKEN}` }
});

const buyerClient = axios.create({
  baseURL: API_URL,
  headers: { Authorization: `Bearer ${BUYER_TOKEN}` }
});

async function runTest() {
  console.log('🧪 Starting "Day in the Life" Manual Test Script');
  
  try {
    // ---------------------------------------------------------
    // PHASE 1: Validating the Actors
    // ---------------------------------------------------------
    console.log('\n--- Phase 1: Validating Actors ---');
    
    // Step 1.1: Verify Seller
    console.log('Validating Seller...');
    const sellerProfile = await sellerClient.get('/user/profile');
    const sellerId = sellerProfile.data.data._id;
    console.log(`✅ Seller Validated: ${sellerId} (Merchant: ${sellerProfile.data.data.isMerchant || 'Unknown/Check DB'})`);
    
    // Step 1.2: Verify Buyer
    console.log('Validating Buyer...');
    const buyerProfile = await buyerClient.get('/user/profile');
    const buyerId = buyerProfile.data.data._id;
    console.log(`✅ Buyer Validated: ${buyerId}`);

    // ---------------------------------------------------------
    // PHASE 2: Seller Lists a Watch
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Listing a Watch ---');
    
    // We need a watch ID first, assuming we can pick one or create raw listing data
    // The guide says body has "brand", "model" etc. 
    // BUT the API usually requires a "watch" ID from the catalog for the standardized data.
    // Let's check if we can list without a watch ID or if we need to fetch one.
    // Looking at the provided POST /listings body in the prompt:
    /*
      {
        "brand": "Omega",
        ...
      }
    */
    // Wait, the prompted body doesn't show `watch_id`. It just shows raw fields.
    // Let's try following the prompt exactly. 
    // However, previous tests showed `watch` (ID) as required in `createListingSchema`. 
    // Let's create a minimal valid watch first or pick one from DB if needed.
    // ACTUALLY, I will try to fetch a watch first to be safe, like in test_trust_flow.ts
    // If that fails, I'll try the raw body.
    
    let watchId;
    try {
        const watchesRes = await sellerClient.get('/watches?limit=1');
        if (watchesRes.data.data.length > 0) {
            watchId = watchesRes.data.data[0]._id;
            console.log(`Using existing Watch ID: ${watchId}`);
        }
    } catch (e) {
        console.warn('Could not fetch watches, proceeding with raw body (might fail if schema requires watch_id)');
    }

    const listingBody = {
      watch: watchId, // Include this if we found one
      brand: "Omega",
      model: "Speedmaster 321",
      reference: "311.30.40.30.01.001",
      price: 1450000,
      currency: "USD",
      condition: "new",
      year: 2022,
      contents: "box_papers",
      ships_from: {
        country: "US",
        state: "NY",
        city: "New York"
      },
      shipping: [{ region: "US", shippingIncluded: true, shippingCost: 0 }],
      images: [
        "https://example.com/speedmaster1.jpg",
        "https://example.com/speedmaster2.jpg",
        "https://example.com/speedmaster3.jpg"
      ],
      thumbnail: "https://example.com/speedmaster1.jpg",
      allow_offers: true
    };

    console.log('Creating Listing...');
    const createRes = await sellerClient.post('/marketplace/listings', listingBody);
    const listingId = createRes.data.data._id;
    console.log(`✅ Listing Created (Draft): ${listingId}`);

    console.log('Publishing Listing...');
    await sellerClient.post(`/marketplace/listings/${listingId}/publish`);
    console.log('✅ Listing Published');

    // ---------------------------------------------------------
    // PHASE 3: Negotiation
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Negotiation ---');
    
    // Step 3.2: Make Offer
    console.log('Buyer making offer (13k)...');
    const offerRes = await buyerClient.post(`/marketplace/listings/${listingId}/offers`, {
        amount: 1300000,
        message: "I can do 13k right now."
    });
    const offerId1 = offerRes.data.data.offer._id;
    console.log(`✅ Offer Sent: ${offerId1}`);

    // Step 3.3/3.4: Seller Counters
    console.log('Seller countering (14k)...');
    // Note: The prompt says "Seller Receives Offer", then "Seller Counters". 
    // We need to use the Offer ID.
    const counterRes = await sellerClient.post(`/marketplace/offers/${offerId1}/counter`, {
        amount: 1400000,
        message: "Too low. 14k is my floor."
    });
    // The counter creates a NEW offer ID usually, or updates? 
    // The prompt says "Note: This creates a NEW Offer ID".
    // Let's check the response.
    const offerId2 = counterRes.data.data._id; 
    console.log(`✅ Counter Offer Sent: ${offerId2}`);

    // Step 3.5: Buyer Accepts
    console.log('Buyer accepting counter...');
    await buyerClient.post(`/marketplace/offers/${offerId2}/accept`, {});
    console.log('✅ Counter Accepted');

    // ---------------------------------------------------------
    // PHASE 4: Transaction & Payment
    // ---------------------------------------------------------
    console.log('\n--- Phase 4: Transaction ---');
    
    // Step 4.1: Reserve
    console.log('Reserving Order...');
    const reserveRes = await buyerClient.post('/marketplace/orders/reserve', {
       listing_id: listingId 
    });
    const orderId = reserveRes.data.data.order_id;
    const fraudSessionId = reserveRes.data.data.fraud_session_id;
    console.log(`✅ Order Reserved: ${orderId}`);

    // Step 4.3: Execute Payment
    console.log('Executing Payment...');
    await buyerClient.post(`/marketplace/orders/${orderId}/payment`, {
        payment_token: "tok_visa_US",
        idempotency_id: `pay-${Date.now()}`,
        postal_code: "90210",
        fraud_session_id: fraudSessionId
    });
    console.log('✅ Payment Successful');

    // ---------------------------------------------------------
    // PHASE 5: Completion
    // ---------------------------------------------------------
    console.log('\n--- Phase 5: Completion ---');

    // Step 5.1: Tracking
    console.log('Adding Tracking...');
    await sellerClient.post(`/marketplace/orders/${orderId}/tracking`, {
        carrier: "FedEx",
        tracking_number: "1234567890"
    });
    console.log('✅ Tracking Added');

    // Step 5.2: Review
    // Wait, order must be delivered? Or can we review immediately?
    // Usually need 'delivered' status. Let's try to confirm delivery first if possible, 
    // or just try review and catch error.
    // The `test_trust_flow.ts` did `confirm-delivery`. Let's do that too.
    
    console.log('Confirming Delivery (Buyer)...');
    await buyerClient.post(`/marketplace/orders/${orderId}/confirm-delivery`, {});
    console.log('✅ Delivery Confirmed');

    console.log('Leaving Review...');
    await buyerClient.post('/reviews', {
        order_id: orderId,
        rating: 5,
        comment: "Smooth transaction, love the watch!"
    });
    console.log('✅ Review Created');

    console.log('\n🎉 MANUAL TEST SCRIPT COMPLETED SUCCESSFULLY!');

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

runTest();
