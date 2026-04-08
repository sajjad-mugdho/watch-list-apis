# Finix Merchant Onboarding

## Overview

This document describes the Finix merchant onboarding flow implemented in Phase 1.

## Architecture

```
User → API → Finix API → Hosted Form → User Completes → Finix Webhook → Queue → Worker → Database Update
```

## API Endpoints

### **POST /api/v1/marketplace/merchant/onboard**

Creates a Finix hosted onboarding form for merchant registration.

**Authentication:** Required (Bearer token or x-test-user header)

**Request Body:**

```json
{
  "business_name": "My Watch Business",
  "max_transaction_amount": 50000
}
```

**Response:**

```json
{
  "data": {
    "onboarding_url": "https://onboarding.finix.com/form/ONF_xxx",
    "form_id": "ONF_xxx",
    "expires_at": "2025-11-14T10:24:03.000Z",
    "merchant": {
      "finix_form_id": "ONF_xxx",
      "status": "PROVISIONING"
    }
  }
}
```

### **GET /api/v1/marketplace/merchant/status**

Retrieves current merchant onboarding status.

**Authentication:** Required

**Response:**

```json
{
  "data": {
    "status": "APPROVED",
    "merchant_external_id": "MU_xxx",
    "verification": "APPROVED",
    "finix_form_id": "ONF_xxx",
    "verified_at": "2025-11-08T15:30:00.000Z"
  }
}
```

## Webhook Processing

### **POST /api/v1/webhooks/finix**

Receives webhook events from Finix.

**Authentication:** Basic Auth (FINIX_WEBHOOK_USERNAME:FINIX_WEBHOOK_PASSWORD)

**Security:**

- HMAC-SHA256 signature verification (optional)
- Basic authentication (required)

**Event Types:**

- `onboarding_form.created`
- `onboarding_form.updated`
- `merchant.created`
- `merchant.updated`

**Webhook Payload Example:**

```json
{
  "entity": "onboarding_form",
  "type": "updated",
  "_embedded": {
    "onboarding_forms": [
      {
        "id": "ONF_xxx",
        "status": "APPROVED",
        "merchant_id": "MU_xxx",
        "tags": {
          "dialist_user_id": "507f1f77bcf86cd799439011"
        }
      }
    ]
  }
}
```

## Database Schema

### **User.merchant**

```typescript
merchant?: {
  merchant_status: "PROVISIONING" | "UPDATE_REQUESTED" | "REJECTED" | "APPROVED";
  merchant_verification: "PENDING" | "SUCCEEDED" | "FAILED";
  merchant_external_id: string;
  finix_form_id?: string;
  merchant_verified_at?: Date;
}
```

### **WebhookEvent**

```typescript
{
  eventId: string;           // Unique event identifier
  provider: "finix" | "clerk";
  type: string;              // e.g., "onboarding_form.updated"
  payload: any;              // Raw webhook payload
  status: "received" | "processing" | "processed" | "failed";
  processedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Local Development

### **1. Environment Setup**

```bash
# Required environment variables
FINIX_USERNAME=your_finix_username
FINIX_PASSWORD=your_finix_password
FINIX_BASE_URL=https://finix.sandbox-payments-api.com

FINIX_WEBHOOK_USERNAME=dev-finix2-webhook-basic
FINIX_WEBHOOK_PASSWORD=syvBy2-mowqez-xozcuw

MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://localhost:6379
```

### **2. Start Services**

```bash
# Start MongoDB (if local)
mongod

# Start Redis
redis-server

# Start API server
npm run dev
```

### **3. Expose Webhook Endpoint**

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 5050
```

**Configure Finix Webhook:**

1. Go to Finix Dashboard → Webhooks
2. Add new webhook URL: `https://your-ngrok-url.ngrok-free.app/api/v1/webhooks/finix`
3. Set authentication: Basic Auth with credentials from env

### **4. Testing**

**Mock User Testing:**

```bash
# Check onboarding status
curl -H "x-test-user: user_31al2rRj39h6oLfkMMa0d0XXlsT" \
     http://localhost:5050/api/v1/onboarding/status

# Initiate merchant onboarding
curl -X POST \
  -H "x-test-user: user_31al2rRj39h6oLfkMMa0d0XXlsT" \
  -H "Content-Type: application/json" \
  -d '{"business_name": "Test Business", "max_transaction_amount": 50000}' \
  http://localhost:5050/api/v1/marketplace/merchant/onboard

# Check merchant status
curl -H "x-test-user: user_31al2rRj39h6oLfkMMa0d0XXlsT" \
     http://localhost:5050/api/v1/marketplace/merchant/status
```

**Simulate Finix Webhook:**

```bash
curl -X POST http://localhost:5050/api/v1/webhooks/finix \
  -u "dev-finix2-webhook-basic:syvBy2-mowqez-xozcuw" \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "onboarding_form",
    "type": "updated",
    "_embedded": {
      "onboarding_forms": [{
        "id": "ONF_test",
        "status": "APPROVED",
        "merchant_id": "MU_test",
        "tags": {"dialist_user_id": "USER_ID_HERE"}
      }]
    }
  }'
```

## Production Deployment

### **Environment Configuration**

- Update `FINIX_BASE_URL` to production endpoint
- Use production Finix credentials
- Configure production MongoDB cluster
- Set up production Redis instance
- Update webhook URL in Finix production dashboard

### **Monitoring**

- Monitor webhook processing queue
- Set up alerts for failed webhook processing
- Track merchant approval rates
- Monitor Finix API response times

## Security Considerations

1. **Webhook Verification:**

   - HMAC signature validation
   - Basic authentication
   - IP whitelist (optional)

2. **Data Protection:**

   - PII masking in logs
   - Secure credential storage
   - TLS for all API calls

3. **Idempotency:**
   - Event ID deduplication
   - Safe retry logic
   - Transaction consistency

## Troubleshooting

### **Webhook Not Processing**

- Check ngrok is running and accessible
- Verify webhook credentials in Finix dashboard
- Check Redis connection for queue
- Review server logs for errors

### **Merchant Status Not Updating**

- Verify webhook signature/auth
- Check `webhook_events` collection for failed events
- Inspect queue for stuck jobs
- Review worker logs

### **Test User Issues**

- Ensure `NODE_ENV=development`
- Verify mock user exists in `customClerkMw.ts`
- Restart server after adding mock users

## References

- [Finix API Documentation](https://docs.finix.com/)
- [Clerk Documentation](https://clerk.com/docs)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
