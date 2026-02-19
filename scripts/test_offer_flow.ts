
import mongoose from 'mongoose';
import { config } from '../src/config';
import { MarketplaceListing } from '../src/models/Listings';
import { MarketplaceListingChannel } from '../src/models/MarketplaceListingChannel';
import { Offer } from '../src/models/Offer';
import { User } from '../src/models/User';
import axios from 'axios';

// IDs
const LISTING_ID = '6995c01de6e15298ece63152';
const BUYER_ID = 'ccc111111111111111111111'; // buyer_us_complete
const SELLER_ID = 'ddd333333333333333333333'; // merchant_approved

const API_URL = 'http://localhost:5050/api/v1';

async function testOfferFlow() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri, { dbName: 'dialist_development' });
    console.log('Connected.');

    // 0. Ensure Listing is owned by our Mock Seller (so we can counter)
    await MarketplaceListing.updateOne(
      { _id: LISTING_ID }, 
      { dialist_id: SELLER_ID, 'author._id': SELLER_ID }
    );
    console.log(`Updated listing ${LISTING_ID} to be owned by ${SELLER_ID}`);

    // 1. Cleanup previous offers/channels for this listing/buyer
    // We want a clean slate
    await MarketplaceListingChannel.deleteMany({ listing_id: LISTING_ID, buyer_id: BUYER_ID });
    await Offer.deleteMany({ listing_id: LISTING_ID, buyer_id: BUYER_ID });
    console.log('Cleaned up previous test data.');

    // 2. Send Offer (Buyer)
    console.log('Sending Offer...');
    const offerPayload = {
      amount: 4500, // Less than 5000 price
      message: 'Can you do 4500?'
    };
    
    // Using axios with manual headers to simulate Clerk auth
    // Wait, axios calls the running server.
    // Headers: x-test-user: buyer_us_complete
    
    const sendRes = await axios.post(`${API_URL}/marketplace/listings/${LISTING_ID}/offers`, offerPayload, {
      headers: { 'x-test-user': 'buyer_us_complete' }
    });
    
    console.log('Offer Sent. Response:', sendRes.data.data._id);
    const channel = sendRes.data.data;
    const lastOffer = channel.last_offer;
    
    if (!lastOffer || !lastOffer._id) {
      throw new Error('Last offer ID missing in response!');
    }
    
    console.log('Offer ID:', lastOffer._id);
    
    // 3. Counter Offer (Seller)
    console.log('Countering Offer...');
    const counterPayload = {
      amount: 4800,
      message: 'Meet me at 4800?'
    };
    
    // Using Offer ID (V2 route)
    // Route: POST /marketplace/offers/:id/counter
    const counterRes = await axios.post(`${API_URL}/marketplace/offers/${lastOffer._id}/counter`, counterPayload, {
      headers: { 'x-test-user': 'merchant_approved' }
    });
    
    console.log('Counter Sent. Response:', counterRes.data.data.offer.state); // Expecting Offer object
    
    // 4. Accept Counter (Buyer)
    console.log('Accepting Counter...');
    // The response from counter is { offer, revision } wrapped in data
    const counteredOfferId = counterRes.data.data.offer._id;
    
    const acceptRes = await axios.post(`${API_URL}/marketplace/offers/${counteredOfferId}/accept`, {}, {
      headers: { 'x-test-user': 'buyer_us_complete' }
    });
    
    console.log('Counter Accepted. Order ID:', acceptRes.data.order_id);
    
    console.log('✅ Flow Test Complete!');
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

testOfferFlow();
