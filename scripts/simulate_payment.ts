
import mongoose from 'mongoose';
import { config } from '../src/config';
import { Order } from '../src/models/Order';
import { MarketplaceListing } from '../src/models/Listings';

const ORDER_ID = '6995c345e6e15298ece63235';

async function simulatePayment() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri, { dbName: 'dialist_development' });
    console.log('Connected.');

    const order = await Order.findById(ORDER_ID);
    if (!order) {
      console.error('Order not found!');
      process.exit(1);
    }

    console.log(`Found order: ${order._id} (Status: ${order.status})`);

    // if (order.status === 'paid') {
    //   console.log('Order is already paid.');
    //   process.exit(0);
    // }

    console.log('Updating order status to PAID...');
    
    order.status = 'paid';
    order.finix_payment_instrument_id = 'PI_mock_instrument_id';
    order.finix_authorization_id = 'TR_mock_auth_id';
    order.finix_transaction_id = 'TR_mock_txn_id';
    order.paid_at = new Date();
    
    // Fix seller_id to match mock user 'merchant_approved'
    order.seller_id = new mongoose.Types.ObjectId('ddd333333333333333333333');
    
    await order.save();
    
    console.log('Order updated successfully.');

    // Also update listing status to sold?
    // In `processPayment`, it doesn't seem to immediately mark listing as sold/archived, 
    // but usually that happens on capture or completion. 
    // However, for "paid", it usually means the transaction is secure.
    // Let's check if there's a listener or if I should update listing too.
    // For now, I'll just update the order. 

    process.exit(0);
  } catch (error) {
    console.error('Error simulating payment:', error);
    process.exit(1);
  }
}

simulatePayment();
