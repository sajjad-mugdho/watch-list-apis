import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dialist API",
      version: "1.0.0",
      description: `API for Dialist marketplace and networks platforms

## Finix Sandbox Certification

This API implements all 10 Finix sandbox certification requirements:

### 1. Hosted Onboarding Forms ✅
- **POST /api/v1/marketplace/merchant/onboard** - Creates Finix-hosted merchant onboarding form
- **POST /api/v1/marketplace/merchant/onboard/refresh-link** - Refreshes expired onboarding link
- Requires \`idempotency_id\` to prevent duplicate form creation
- Returns onboarding_url valid for 30 days

### 2. Successful Transaction Example ✅
- **POST /api/v1/marketplace/orders/{id}/payment** - Process token-based payment
- Requires payment_token from Finix.js CardTokenForm or BankTokenForm
- Requires postal_code for AVS verification
- Pass fraud_session_id from reserve step for fraud tracking
- Use idempotency_id to prevent duplicate charges

### 3. Failed Transaction Example ✅
- Payment failures are handled through proper error responses
- AVS mismatches, insufficient funds, and other failures return error codes
- See API error handling documentation

### 4. Successful Refund Example ✅
- **POST /api/v1/marketplace/orders/{id}/refund** after successful payment
- Creates Finix transfer reversal
- Requires unique \`idempotency_id\` per refund

### 5. Address Verification (AVS) ✅
- **postal_code** required in all payment requests
- Backend validates format with \`validateAndFormatPostalCode\`
- Finix performs AVS checks; NO_MATCH fails transaction
- Frontend uses Finix.js CardTokenForm with \`showAddress: true\`

### 6. Idempotency Requests ✅
- All write operations accept \`idempotency_id\` parameter
- Passed as \`Finix-Idempotency-Key\` header to Finix API
- Prevents duplicate: tokenization, payments, refunds, onboarding
- Use UUID format (crypto.randomUUID)

### 7. Fraud Session ID ✅
- Generated in **POST /api/v1/marketplace/orders/reserve** as \`fraud_session_id\`
- Format: \`fs_\${crypto.randomBytes(16).toString("hex")}\`
- Pass through tokenization and payment for fraud tracking
- Optional but recommended parameter

### 8. Finix Tokenization Forms (PCI Compliance) ✅
- **POST /api/v1/marketplace/orders/{id}/tokenize** returns Finix config
- Frontend initializes \`Finix.CardTokenForm\` with iframe isolation
- Tokenizes card data without backend touching PAN
- Returns payment_token for secure payment processing

### 9. Webhooks for Events ✅
- **POST /api/v1/marketplace/webhooks/finix** handles Finix webhook events
- Implements HMAC-SHA256 signature verification with \`crypto.timingSafeEqual\`
- Events: merchant.onboarding.updated, dispute.created, transfer.succeeded, verification.updated
- All events logged to FinixWebhookEvent collection

### 10. ACH Authorization Language ✅
- ACH authorization language displayed in frontend demo UI
- Includes required WEB debit authorization text
- Confirmation language for customer records per NACHA rules
`,
    },
    servers: [
      {
        url: "http://localhost:5050",
        description: "Development server",
      },
      {
        url: "https://dialist.ngrok.dev",
        description: "Staging server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Clerk JWT token for production authentication",
        },
        basicAuth: {
          type: "http",
          scheme: "basic",
          description: "Basic authentication for webhook endpoints",
        },
        mockUser: {
          type: "apiKey",
          in: "header",
          name: "x-test-user",
          description: `**Mock User Authentication (Development/Test Only)**

Use this to test API endpoints without real authentication.

**Available Mock Users:**
- \`buyer_us_complete\` - Fully onboarded US buyer (can purchase)
- \`merchant_approved\` - Approved merchant (can sell)
- \`new_user_us\` - Fresh user (test onboarding flow)
- \`merchant_pending\` - Merchant onboarding started
- \`merchant_provisioning\` - Merchant awaiting verification
- \`merchant_rejected\` - Rejected merchant application
- \`onboarding_step2_displayname\` - Mid-onboarding user

**Debug Endpoint:** \`GET /api/v1/debug/mock-users\` - See all available mock users

**Note:** This only works in development/test environments. Production ignores this header.`,
        },
      },
      headers: {
        IdempotencyKey: {
          description:
            "Optional idempotency key to prevent duplicate operations. Required for transactional operations.",
          schema: { type: "string" },
        },
      },
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            data: {
              description: "Response data",
            },
            requestId: {
              type: "string",
              description: "Request ID for tracking",
            },
            _metadata: {
              type: "object",
              description: "Additional metadata",
            },
          },
          required: ["data", "requestId"],
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                },
                code: {
                  type: "string",
                },
                details: {
                  type: "object",
                },
              },
              required: ["message"],
            },
            requestId: {
              type: "string",
            },
          },
          required: ["error", "requestId"],
        },
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "MongoDB ObjectId",
            },
            external_id: {
              type: "string",
              description: "Clerk user ID",
            },
            first_name: {
              type: "string",
            },
            last_name: {
              type: "string",
            },
            email: {
              type: "string",
              format: "email",
            },
            display_name: {
              type: "string",
              nullable: true,
            },
            avatar: {
              type: "string",
              nullable: true,
            },
            location: {
              $ref: "#/components/schemas/UserLocation",
            },
            onboarding_status: {
              type: "string",
              enum: ["incomplete", "completed"],
            },
            onboarding_state: {
              type: "string",
              enum: [
                "PROVISIONING",
                "UPDATE_REQUESTED",
                "REJECTED",
                "APPROVED",
              ],
              nullable: true,
              description:
                "Merchant onboarding status (not platform onboarding)",
            },
            marketplace_published: {
              type: "boolean",
            },
            networks_published: {
              type: "boolean",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["_id", "external_id", "email", "onboarding_status"],
        },
        UserLocation: {
          type: "object",
          properties: {
            country: {
              type: "string",
              enum: ["US", "CA"],
              description: "Country code",
            },
            region: {
              type: "string",
              description: "State or Province",
            },
            city: {
              type: "string",
              description: "City name",
            },
            postal_code: {
              type: "string",
              description: "ZIP or postal code",
            },
            line1: {
              type: "string",
              description: "Street address",
            },
            line2: {
              type: "string",
              description: "Apartment, suite, unit, building, floor, etc.",
            },
            time_zone: {
              type: "string",
              description: "IANA timezone identifier",
            },
          },
        },
        Watch: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            brand: {
              type: "string",
            },
            model: {
              type: "string",
            },
            reference: {
              type: "string",
            },
            diameter: {
              type: "string",
            },
            bezel: {
              type: "string",
            },
            materials: {
              type: "string",
            },
            bracelet: {
              type: "string",
            },
            color: {
              type: "string",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["_id", "brand", "model", "reference", "diameter"],
        },
        ImageMetadata: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "S3 object key",
              example: "listings/507f1f77bcf86cd799439011/abc123-image1.webp",
            },
            url: {
              type: "string",
              description: "Public URL of the image",
              example:
                "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/507f1f77bcf86cd799439011/abc123-image1.webp",
            },
            thumbnailKey: {
              type: "string",
              description: "S3 object key for thumbnail",
              example:
                "listings/507f1f77bcf86cd799439011/thumb_abc123-image1.webp",
            },
            thumbnailUrl: {
              type: "string",
              description: "Public URL of the thumbnail",
              example:
                "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/507f1f77bcf86cd799439011/thumb_abc123-image1.webp",
            },
            size: {
              type: "number",
              description: "File size in bytes",
              example: 245678,
            },
            width: {
              type: "number",
              description: "Image width in pixels",
              example: 2048,
            },
            height: {
              type: "number",
              description: "Image height in pixels",
              example: 1536,
            },
            mimeType: {
              type: "string",
              description: "MIME type of the image",
              example: "image/webp",
            },
            uploadedAt: {
              type: "string",
              format: "date-time",
              description: "Upload timestamp",
            },
          },
          required: [
            "key",
            "url",
            "size",
            "width",
            "height",
            "mimeType",
            "uploadedAt",
          ],
        },
        Listing: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            dialist_id: {
              type: "string",
            },
            clerk_id: {
              type: "string",
            },
            watch_id: {
              type: "string",
            },
            status: {
              type: "string",
              enum: ["draft", "active", "reserved", "sold"],
            },
            title: {
              type: "string",
            },
            subtitle: {
              type: "string",
            },
            brand: {
              type: "string",
            },
            model: {
              type: "string",
            },
            reference: {
              type: "string",
            },
            diameter: {
              type: "string",
            },
            bezel: {
              type: "string",
            },
            materials: {
              type: "string",
            },
            bracelet: {
              type: "string",
            },
            color: {
              type: "string",
            },
            author: {
              $ref: "#/components/schemas/ListingAuthor",
            },
            ships_from: {
              $ref: "#/components/schemas/ShipsFrom",
            },
            shipping: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ShippingOption",
              },
            },
            price: {
              type: "number",
            },
            condition: {
              type: "string",
              enum: ["new", "like-new", "good", "fair", "poor"],
            },
            year: {
              type: "number",
            },
            contents: {
              type: "string",
              enum: ["box_papers", "box", "papers", "watch"],
            },
            thumbnail: {
              type: "string",
              format: "uri",
            },
            images: {
              type: "array",
              items: {
                type: "string",
                format: "uri",
              },
            },
            allow_offers: {
              type: "boolean",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: [
            "_id",
            "dialist_id",
            "clerk_id",
            "watch_id",
            "status",
            "brand",
            "model",
            "reference",
            "author",
            "ships_from",
          ],
        },
        ListingAuthor: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            name: {
              type: "string",
            },
            avatar: {
              type: "string",
            },
            location: {
              type: "string",
            },
          },
          required: ["_id", "name"],
        },
        ShipsFrom: {
          type: "object",
          properties: {
            country: {
              type: "string",
            },
            state: {
              type: "string",
            },
            city: {
              type: "string",
            },
          },
          required: ["country"],
        },
        ShippingOption: {
          type: "object",
          properties: {
            region: {
              type: "string",
              enum: ["US", "CA"],
            },
            shippingIncluded: {
              type: "boolean",
            },
            shippingCost: {
              type: "number",
            },
          },
          required: ["region", "shippingIncluded", "shippingCost"],
        },
        MarketplaceChannel: {
          type: "object",
          description:
            "Marketplace chat channel (unique per listing/buyer/seller)",
          properties: {
            _id: { type: "string" },
            listing_id: { type: "string" },
            buyer_id: { type: "string" },
            seller_id: { type: "string" },
            getstream_channel_id: { type: "string" },
            status: { type: "string", enum: ["open", "archived"] },
            listing_snapshot: { type: "object" },
            buyer_snapshot: { type: "object" },
            seller_snapshot: { type: "object" },
            last_offer: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        NetworkChannel: {
          type: "object",
          description: "Networks chat channel (unique per user pair)",
          properties: {
            _id: { type: "string" },
            buyer_id: { type: "string" },
            seller_id: { type: "string" },
            getstream_channel_id: { type: "string" },
            status: { type: "string", enum: ["open", "archived"] },
            buyer_snapshot: { type: "object" },
            seller_snapshot: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        MerchantOnboardRequest: {
          type: "object",
          description:
            "Request body for creating a merchant onboarding session",
          properties: {
            idempotency_id: {
              type: "string",
              description:
                "Idempotency key to ensure onboarding form creations are idempotent",
              example: "onboard-abcdef-123456",
            },
            business_name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description:
                "Legal business name to prefill in Finix form. If not provided, falls back to user's business_info.business_name, then display_name.",
              example: "My Watch Business",
            },
            max_transaction_amount: {
              type: "number",
              minimum: 1,
              maximum: 1000000,
              default: 1000000,
              description:
                "Maximum transaction amount for the merchant (in cents)",
              example: 50000,
            },
            return_url: {
              type: "string",
              format: "uri",
              description: "URL to redirect to after onboarding completion",
              example: "https://myapp.com/onboarding-complete",
            },
          },
          required: ["idempotency_id"],
        },
        MerchantOnboardResponse: {
          type: "object",
          properties: {
            onboarding_url: {
              type: "string",
              format: "uri",
            },
            form_id: {
              type: "string",
            },
            expires_at: {
              type: "string",
              format: "date-time",
            },
            existing_form: {
              type: "boolean",
              description:
                "Whether this is an existing form with a new/existing link",
            },
          },
          required: ["onboarding_url", "form_id", "expires_at"],
        },
        MerchantOnboarding: {
          type: "object",
          description:
            "Merchant onboarding record tracking Finix form completion and merchant approval status",
          properties: {
            _id: {
              type: "string",
              description: "MongoDB ObjectId",
            },
            dialist_user_id: {
              type: "string",
              description: "Reference to User._id",
            },
            form_id: {
              type: "string",
              description: "Finix onboarding form ID",
              example: "obf_abc123xyz",
            },
            identity_id: {
              type: "string",
              nullable: true,
              description:
                "Finix identity ID (set after form completed by merchant)",
              example: "ID_abc123xyz",
            },
            merchant_id: {
              type: "string",
              nullable: true,
              description:
                "Finix merchant ID (set after merchant provisioning)",
              example: "MU_abc123xyz",
            },
            verification_id: {
              type: "string",
              nullable: true,
              description: "Finix verification ID",
              example: "VI_abc123xyz",
            },
            onboarding_state: {
              type: "string",
              enum: [
                "PENDING",
                "PROVISIONING",
                "APPROVED",
                "REJECTED",
                "UPDATE_REQUESTED",
              ],
              description:
                "Current onboarding status - PENDING: form not completed, PROVISIONING: form completed awaiting approval, APPROVED: merchant approved, REJECTED: merchant rejected, UPDATE_REQUESTED: additional info needed",
            },
            verification_state: {
              type: "string",
              enum: ["PENDING", "SUCCEEDED", "FAILED"],
              nullable: true,
              description: "KYC/KYB verification status from Finix",
            },
            last_form_link: {
              type: "string",
              format: "uri",
              nullable: true,
              description: "Most recent form link URL",
            },
            last_form_link_expires_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Expiration timestamp for form link",
            },
            onboarded_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Timestamp when merchant completed onboarding form",
            },
            verified_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Timestamp when merchant verification succeeded",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Record creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
          required: [
            "_id",
            "dialist_user_id",
            "form_id",
            "onboarding_state",
            "createdAt",
            "updatedAt",
          ],
        },
        MerchantStatusResponse: {
          type: "object",
          description:
            "Merchant onboarding status response (returned by GET /marketplace/merchant/status)",
          properties: {
            is_merchant: {
              type: "boolean",
              description:
                "Whether user is an approved merchant (onboarding_state === APPROVED)",
            },
            status: {
              type: "string",
              enum: [
                "NOT_STARTED",
                "PENDING",
                "PROVISIONING",
                "APPROVED",
                "REJECTED",
                "UPDATE_REQUESTED",
              ],
              description:
                "Merchant onboarding status - NOT_STARTED: no onboarding initiated",
            },
            identity_id: {
              type: "string",
              nullable: true,
              description: "Finix identity ID (null if form not completed)",
            },
            merchant_id: {
              type: "string",
              nullable: true,
              description: "Finix merchant ID (null if not yet provisioned)",
            },
            form_id: {
              type: "string",
              nullable: true,
              description: "Finix onboarding form ID (null if not started)",
            },
            onboarding_state: {
              type: "string",
              enum: [
                "PENDING",
                "PROVISIONING",
                "APPROVED",
                "REJECTED",
                "UPDATE_REQUESTED",
              ],
              nullable: true,
              description: "Current onboarding state",
            },
            verification_state: {
              type: "string",
              enum: ["PENDING", "SUCCEEDED", "FAILED"],
              nullable: true,
              description: "Verification status",
            },
            onboarded_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "When form was completed",
            },
            verified_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "When verification succeeded",
            },
          },
          required: ["is_merchant", "status"],
        },
        ValidatedUserClaims: {
          type: "object",
          description:
            "Validated user claims from DB (source of truth for client bootstrap)",
          properties: {
            userId: {
              type: "string",
              description: "Clerk user ID (external_id)",
            },
            dialist_id: {
              type: "string",
              description: "MongoDB user ID",
            },
            onboarding_status: {
              type: "string",
              enum: ["incomplete", "completed"],
              description: "Platform onboarding status",
            },
            onboarding_state: {
              type: "string",
              enum: ["PENDING", "PROVISIONING", "APPROVED", "REJECTED"],
              description: "Merchant onboarding state (if applicable)",
            },
            isMerchant: {
              type: "boolean",
              description: "True if merchant onboarding approved",
            },
            display_name: {
              type: "string",
              description: "User's display name",
            },
            location_country: {
              type: "string",
              enum: ["US", "CA"],
              description: "User's country",
            },
            networks_accessed: {
              type: "boolean",
              description: "True if user has accessed networks platform",
            },
          },
          required: ["userId", "dialist_id", "onboarding_status", "isMerchant"],
          example: {
            userId: "user_abc123",
            dialist_id: "677a2222222222222222bbb2",
            onboarding_status: "completed",
            display_name: "John Buyer",
            location_country: "US",
            isMerchant: false,
            networks_accessed: false,
          },
        },
        OnboardingStatus: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["incomplete", "completed"],
            },
            version: {
              type: "string",
            },
            steps: {
              type: "object",
              properties: {
                location: {
                  type: "object",
                  properties: {
                    country: {
                      type: "string",
                      enum: ["CA", "US"],
                      description: "Country code",
                    },
                    region: {
                      type: "string",
                      description: "State or Province",
                    },
                    city: {
                      type: "string",
                      description: "City name",
                    },
                    postal_code: {
                      type: "string",
                      description: "ZIP or postal code",
                    },
                    line1: {
                      type: "string",
                      description: "Street address",
                    },
                    line2: {
                      type: "string",
                      description: "Apartment, suite, etc.",
                    },
                    updated_at: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
                business_info: {
                  type: "object",
                  description: "Business information for merchant verification",
                  properties: {
                    business_name: {
                      type: "string",
                      description: "Legal business name",
                    },
                    business_type: {
                      type: "string",
                      description: "Business entity type",
                      enum: [
                        "INDIVIDUAL_SOLE_PROPRIETORSHIP",
                        "LIMITED_LIABILITY_COMPANY",
                        "CORPORATION",
                        "PARTNERSHIP",
                        "ASSOCIATION_ESTATE_TRUST",
                        "TAX_EXEMPT_ORGANIZATION",
                        "INTERNATIONAL_ORGANIZATION",
                        "GOVERNMENT_AGENCY",
                      ],
                    },
                    business_phone: {
                      type: "string",
                      description: "Business phone number",
                    },
                    website: {
                      type: "string",
                      format: "uri",
                      description: "Business website URL",
                    },
                    updated_at: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
                personal_info: {
                  type: "object",
                  description: "Personal information for identity verification",
                  properties: {
                    date_of_birth: {
                      type: "object",
                      description: "Date of birth",
                      properties: {
                        year: {
                          type: "integer",
                          minimum: 1900,
                          maximum: 2025,
                        },
                        month: {
                          type: "integer",
                          minimum: 1,
                          maximum: 12,
                        },
                        day: {
                          type: "integer",
                          minimum: 1,
                          maximum: 31,
                        },
                      },
                    },
                    title: {
                      type: "string",
                      description: "Job title (e.g., Owner, CEO, Manager)",
                    },
                    updated_at: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
                display_name: {
                  type: "object",
                  properties: {
                    confirmed: {
                      type: "boolean",
                    },
                    value: {
                      type: "string",
                    },
                    user_provided: {
                      type: "boolean",
                    },
                    updated_at: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
                avatar: {
                  type: "object",
                  properties: {
                    confirmed: {
                      type: "boolean",
                    },
                    url: {
                      type: "string",
                    },
                    user_provided: {
                      type: "boolean",
                    },
                    updated_at: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
                acknowledgements: {
                  type: "object",
                  properties: {
                    tos: {
                      type: "boolean",
                    },
                    privacy: {
                      type: "boolean",
                    },
                    rules: {
                      type: "boolean",
                    },
                    updated_at: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
            progress: {
              type: "object",
              properties: {
                is_finished: {
                  type: "boolean",
                },
                completed_steps: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                next_step: {
                  type: "string",
                },
              },
            },
          },
          required: ["status", "version", "steps", "progress"],
        },
        UpdateBusinessInfoRequest: {
          type: "object",
          description: "Update business information for merchant onboarding",
          properties: {
            business_name: {
              type: "string",
              description: "Legal business name",
              example: "Acme Watch Company LLC",
            },
            business_type: {
              type: "string",
              description: "Business entity type",
              enum: [
                "INDIVIDUAL_SOLE_PROPRIETORSHIP",
                "LIMITED_LIABILITY_COMPANY",
                "CORPORATION",
                "PARTNERSHIP",
                "ASSOCIATION_ESTATE_TRUST",
                "TAX_EXEMPT_ORGANIZATION",
                "INTERNATIONAL_ORGANIZATION",
                "GOVERNMENT_AGENCY",
              ],
              example: "LIMITED_LIABILITY_COMPANY",
            },
            business_phone: {
              type: "string",
              description: "Business phone number (10 digits for US/CA)",
              example: "4155551234",
            },
            website: {
              type: "string",
              format: "uri",
              description: "Business website URL",
              example: "https://www.acmewatches.com",
            },
          },
        },
        UpdatePersonalInfoRequest: {
          type: "object",
          description: "Update personal information for identity verification",
          properties: {
            date_of_birth: {
              type: "object",
              description: "Date of birth (must be 18+ for merchant accounts)",
              properties: {
                year: {
                  type: "integer",
                  minimum: 1900,
                  maximum: 2007,
                  example: 1985,
                },
                month: {
                  type: "integer",
                  minimum: 1,
                  maximum: 12,
                  example: 6,
                },
                day: {
                  type: "integer",
                  minimum: 1,
                  maximum: 31,
                  example: 15,
                },
              },
              required: ["year", "month", "day"],
            },
            title: {
              type: "string",
              description: "Job title or role",
              example: "Owner",
            },
          },
        },
        UpdateLocationRequest: {
          type: "object",
          description: "Update complete address information",
          properties: {
            country: {
              type: "string",
              enum: ["US", "CA"],
              description: "Country code",
            },
            region: {
              type: "string",
              description: "State (US) or Province (CA)",
              example: "WA",
            },
            city: {
              type: "string",
              description: "City name",
              example: "Seattle",
            },
            postal_code: {
              type: "string",
              description: "ZIP code (US) or postal code (CA)",
              example: "98101",
            },
            line1: {
              type: "string",
              description: "Street address",
              example: "123 Main St",
            },
            line2: {
              type: "string",
              description: "Apartment, suite, unit, building, floor, etc.",
              example: "Apt 4B",
            },
          },
          required: ["country", "region", "postal_code"],
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "healthy",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            uptime: {
              type: "number",
            },
            memory: {
              type: "object",
              properties: {
                used: {
                  type: "number",
                },
                total: {
                  type: "number",
                },
                external: {
                  type: "number",
                },
              },
            },
            system: {
              type: "object",
              properties: {
                platform: {
                  type: "string",
                },
                nodeVersion: {
                  type: "string",
                },
                pid: {
                  type: "number",
                },
              },
            },
            requestId: {
              type: "string",
            },
          },
          required: [
            "status",
            "timestamp",
            "uptime",
            "memory",
            "system",
            "requestId",
          ],
        },
        PaginationMetadata: {
          type: "object",
          properties: {
            count: {
              type: "number",
            },
            total: {
              type: "number",
            },
            page: {
              type: "number",
            },
            limit: {
              type: "number",
            },
            pages: {
              type: "number",
            },
          },
        },
        InventoryMetadata: {
          allOf: [
            { $ref: "#/components/schemas/PaginationMetadata" },
            {
              type: "object",
              properties: {
                groups: {
                  type: "object",
                  properties: {
                    draft: {
                      type: "number",
                    },
                    active: {
                      type: "number",
                    },
                    reserved: {
                      type: "number",
                    },
                    sold: {
                      type: "number",
                    },
                  },
                },
                filters: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                    },
                  },
                },
              },
            },
          ],
        },
        WebhookEvent: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            type: {
              type: "string",
            },
            entity: {
              type: "string",
            },
            occurred_at: {
              type: "string",
            },
            _embedded: {
              type: "object",
            },
          },
        },
        // Favorites should ONLY apply to Listings (for-sale and WTB)
        // Users can toggle between "For Sale" and "WTB" views in the UI
        Favorite: {
          type: "object",
          description:
            "User favorite for listings. Platform-scoped (Marketplace vs Networks). WTB favorites are Networks-only.",
          properties: {
            _id: { type: "string" },
            user_id: { type: "string" },
            item_id: {
              type: "string",
              description: "ID of the favorited listing",
            },
            item_type: {
              type: "string",
              enum: ["for_sale", "wtb"],
              description:
                "Type of listing: for_sale or wtb (WTB is Networks-only)",
            },
            platform: {
              type: "string",
              enum: ["marketplace", "networks"],
              description: "Platform scope (WTB only available on networks)",
            },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["_id", "user_id", "item_id", "item_type", "platform"],
        },
        ISO: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user_id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["active", "fulfilled", "closed"] },
            urgency: { type: "string", enum: ["low", "medium", "high"] },
            is_public: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["_id", "user_id", "title", "status"],
        },
        Subscription: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user_id: { type: "string" },
            tier: {
              type: "string",
              enum: ["free", "basic", "premium", "enterprise"],
            },
            status: {
              type: "string",
              enum: ["active", "past_due", "canceled", "incomplete"],
            },
            expires_at: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["_id", "user_id", "tier", "status"],
        },
        Order: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              example: "673f123abc456def78901234",
            },
            listing_id: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
            },
            buyer_id: {
              type: "string",
              example: "507f1f77bcf86cd799439013",
            },
            seller_id: {
              type: "string",
              example: "507f1f77bcf86cd799439014",
            },
            amount: {
              type: "number",
              example: 12500,
            },
            currency: {
              type: "string",
              enum: ["USD", "CAD"],
              description:
                "Currency code - USD for US buyers, CAD for Canadian buyers",
              example: "USD",
            },
            status: {
              type: "string",
              enum: [
                "reserved",
                "pending",
                "processing",
                "authorized",
                "paid",
                "shipped",
                "delivered",
                "completed",
                "cancelled",
                "expired",
                "refunded",
              ],
              example: "reserved",
            },
            reserved_at: {
              type: "string",
              format: "date-time",
            },
            reservation_expires_at: {
              type: "string",
              format: "date-time",
            },
            fraud_session_id: {
              type: "string",
              example: "fs_a1b2c3d4e5f6789012345678",
            },
            finix_buyer_identity_id: {
              type: "string",
              nullable: true,
              description: "Finix buyer identity ID",
              example: "ID_buyer_abc123",
            },
            finix_payment_instrument_id: {
              type: "string",
              nullable: true,
              description: "Finix payment instrument ID",
              example: "PI_abc123",
            },
            finix_authorization_id: {
              type: "string",
              nullable: true,
              description: "Finix authorization ID",
              example: "AU_abc123",
            },
            finix_transaction_id: {
              type: "string",
              nullable: true,
              description: "Finix transaction/transfer ID",
              example: "TR_abc123",
            },
            payment_method: {
              type: "string",
              enum: ["card", "bank", "token", null],
              nullable: true,
              description: "Payment method used (card, bank/ACH, or tokenized)",
              example: "card",
            },
            dispute_id: {
              type: "string",
              nullable: true,
              description: "Finix dispute ID if a chargeback was filed",
              example: "DI_abc123",
            },
            dispute_state: {
              type: "string",
              enum: ["INQUIRY", "PENDING", "WON", "LOST", null],
              nullable: true,
              description: "Current dispute state",
            },
            dispute_reason: {
              type: "string",
              nullable: true,
              description: "Reason for the dispute",
            },
            dispute_amount: {
              type: "number",
              nullable: true,
              description: "Disputed amount in cents",
            },
            listing_snapshot: {
              type: "object",
              description: "Snapshot of listing at purchase time",
              properties: {
                brand: {
                  type: "string",
                  example: "Rolex",
                },
                model: {
                  type: "string",
                  example: "Submariner",
                },
                reference: {
                  type: "string",
                  example: "116610LN",
                },
                condition: {
                  type: "string",
                  example: "Excellent",
                },
                price: {
                  type: "number",
                  example: 12500,
                },
                images: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  example: ["https://cdn.dialist.com/listings/image1.webp"],
                },
                thumbnail: {
                  type: "string",
                  nullable: true,
                  example: "https://cdn.dialist.com/listings/thumb.webp",
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        // Payment Request Schemas for Finix Certification
        TokenizeRequest: {
          type: "object",
          description:
            "Request body for tokenization form configuration. Supports prefill customization.",
          required: ["idempotency_id"],
          properties: {
            idempotency_id: {
              type: "string",
              description: "Idempotency key to create Finix buyer identity",
              example: "buyer-abc123",
            },
            // Personal info prefill (override user profile)
            first_name: {
              type: "string",
              description: "Override first name from user profile",
              example: "John",
            },
            last_name: {
              type: "string",
              description: "Override last name from user profile",
              example: "Doe",
            },
            email: {
              type: "string",
              format: "email",
              description: "Override email from user profile",
              example: "john.doe@example.com",
            },
            phone: {
              type: "string",
              description: "Override phone from user profile",
              example: "4155551234",
            },
            // Address prefill
            address_line1: {
              type: "string",
              description: "Billing address line 1 (street address)",
              example: "123 Market St",
            },
            address_line2: {
              type: "string",
              description: "Billing address line 2 (apt, suite)",
              example: "Apt 200",
            },
            city: {
              type: "string",
              description: "Billing city",
              example: "San Francisco",
            },
            region: {
              type: "string",
              description: "State / Province code",
              example: "CA",
            },
            postal_code: {
              type: "string",
              description:
                "Billing postal code (ZIP for US, postal code for CA)",
              example: "94114",
            },
            country: {
              type: "string",
              enum: ["USA", "CAN"],
              description: "Country code (USA or CAN)",
              example: "USA",
            },
            // Currency override
            currency: {
              type: "string",
              enum: ["USD", "CAD"],
              description:
                "Currency override (auto-detected from buyer location if not specified)",
              example: "USD",
            },
            // Payment type hint
            payment_type: {
              type: "string",
              enum: ["card", "bank"],
              description: "Hint for payment instrument type",
              example: "card",
            },
          },
        },
        TokenizeResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              properties: {
                order_id: {
                  type: "string",
                  description: "Order ID",
                  example: "507f1f77bcf86cd799439012",
                },
                application_id: {
                  type: "string",
                  description:
                    "Finix Application ID (US or CA based on currency)",
                  example: "AP_us_1234567890abcdef",
                },
                buyer_identity_id: {
                  type: "string",
                  description: "Finix Buyer Identity ID with full profile",
                  example: "ID_buyer_abc123",
                },
                fraud_session_id: {
                  type: "string",
                  description: "Fraud detection session ID",
                  example: "fs_a1b2c3d4e5f6789012345678",
                },
                amount: {
                  type: "number",
                  description: "Order amount in cents",
                  example: 1250000,
                },
                currency: {
                  type: "string",
                  enum: ["USD", "CAD"],
                  description: "Currency code",
                  example: "USD",
                },
                require_address: {
                  type: "boolean",
                  description: "Whether address is required for AVS",
                  example: true,
                },
                payment_types: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Supported payment instrument types",
                  example: ["card", "bank"],
                },
                prefill_customizable: {
                  type: "boolean",
                  description: "Whether client can override profile data",
                  example: true,
                },
              },
            },
          },
        },
        BankPaymentInstrument: {
          type: "object",
          description: "Bank account for ACH (US) or EFT (Canada) transfers",
          required: ["account_number"],
          properties: {
            account_number: {
              type: "string",
              description: "Bank account number",
              example: "0000000016",
            },
            bank_code: {
              type: "string",
              description: "Routing number (required for US/ACH)",
              example: "122105278",
            },
            institution_number: {
              type: "string",
              description: "Institution number (required for Canada/EFT)",
              example: "001",
            },
            transit_number: {
              type: "string",
              description: "Transit number (required for Canada/EFT)",
              example: "00012",
            },
            account_type: {
              type: "string",
              enum: ["CHECKING", "SAVINGS", "CORPORATE"],
              description: "Bank account type",
              example: "CHECKING",
            },
            name: {
              type: "string",
              description: "Account holder name",
              example: "John Doe",
            },
            country: {
              type: "string",
              enum: ["USA", "CAN"],
              description: "Bank country",
              example: "USA",
            },
            currency: {
              type: "string",
              enum: ["USD", "CAD"],
              description: "Currency for transactions",
              example: "USD",
            },
          },
        },
        CardPaymentInstrument: {
          type: "object",
          description:
            "Card data for sandbox testing (use tokenization in production)",
          required: ["number", "exp_month", "exp_year", "cvv"],
          properties: {
            number: {
              type: "string",
              description: "Card number (16 digits)",
              example: "4895142232120006",
            },
            exp_month: {
              type: "string",
              description: "Expiration month (2 digits)",
              example: "12",
            },
            exp_year: {
              type: "string",
              description: "Expiration year (4 digits)",
              example: "2029",
            },
            cvv: {
              type: "string",
              description: "Card CVV (3-4 digits)",
              example: "123",
            },
            name: {
              type: "string",
              description: "Cardholder name",
              example: "Test Buyer",
            },
          },
        },
        PaymentResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              properties: {
                order_id: {
                  type: "string",
                  example: "507f1f77bcf86cd799439012",
                },
                status: {
                  type: "string",
                  enum: ["processing", "paid"],
                  example: "processing",
                },
                payment_details: {
                  type: "object",
                  properties: {
                    instrument_type: {
                      type: "string",
                      enum: ["PAYMENT_CARD", "BANK_ACCOUNT"],
                      example: "PAYMENT_CARD",
                    },
                    payment_method: {
                      type: "string",
                      enum: ["card", "bank", "token"],
                      example: "card",
                    },
                    card_type: {
                      type: "string",
                      example: "VISA",
                    },
                    last_four: {
                      type: "string",
                      example: "0006",
                    },
                    brand: {
                      type: "string",
                      example: "VISA",
                    },
                    currency: {
                      type: "string",
                      enum: ["USD", "CAD"],
                      example: "USD",
                    },
                  },
                },
                message: {
                  type: "string",
                  example:
                    "Payment is processing. You'll receive confirmation shortly.",
                },
                ach_authorization: {
                  type: "object",
                  nullable: true,
                  description:
                    "ACH/EFT authorization details (only for bank payments)",
                  properties: {
                    authorized: {
                      type: "boolean",
                      example: true,
                    },
                    authorization_text: {
                      type: "string",
                      description: "NACHA-compliant authorization text",
                      example:
                        "I authorize Dialist to electronically debit my account...",
                    },
                    amount: {
                      type: "number",
                      example: 1250000,
                    },
                    currency: {
                      type: "string",
                      example: "USD",
                    },
                  },
                },
              },
            },
          },
        },
        /**
         * Payment Error Response
         * FINIX CERTIFICATION: Returns detailed failure information for declined payments
         */
        PaymentErrorResponse: {
          type: "object",
          description: "Payment failure response with Finix failure codes",
          properties: {
            error: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "User-friendly error message",
                  example:
                    "Your card was declined. Please try a different payment method.",
                },
                code: {
                  type: "string",
                  description: "Error code",
                  example: "PAYMENT_FAILED",
                },
                failure_code: {
                  type: "string",
                  description: "Finix failure code",
                  enum: [
                    "GENERIC_DECLINE",
                    "INSUFFICIENT_FUNDS",
                    "CARD_NOT_SUPPORTED",
                    "EXPIRED_CARD",
                    "INVALID_CARD_NUMBER",
                    "INVALID_CVV",
                    "CVV_MISMATCH",
                    "AVS_MISMATCH",
                    "FRAUD_DETECTED",
                    "LOST_OR_STOLEN_CARD",
                    "DO_NOT_HONOR",
                    "RESTRICTED_CARD",
                    "EXCEEDS_LIMIT",
                    "INVALID_ACCOUNT_NUMBER",
                    "INVALID_ROUTING_NUMBER",
                    "ACCOUNT_CLOSED",
                    "RETURN_NSF",
                    "RETURN_UNAUTHORIZED",
                    "PROCESSING_ERROR",
                    "SERVICE_UNAVAILABLE",
                    "TIMEOUT",
                  ],
                  example: "GENERIC_DECLINE",
                },
                failure_message: {
                  type: "string",
                  description: "Detailed failure message from Finix",
                  example: "Transaction declined by the processor",
                },
                avs_result: {
                  type: "string",
                  description: "Address verification result",
                  enum: ["MATCHED", "NO_MATCH", "NOT_CHECKED", "UNKNOWN"],
                  nullable: true,
                  example: "NO_MATCH",
                },
                cvv_result: {
                  type: "string",
                  description: "CVV verification result",
                  enum: ["MATCHED", "UNMATCHED", "NOT_CHECKED", "UNKNOWN"],
                  nullable: true,
                  example: "UNMATCHED",
                },
                details: {
                  type: "object",
                  description: "Additional error details",
                  properties: {
                    authorization_id: {
                      type: "string",
                      nullable: true,
                    },
                    payment_instrument_id: {
                      type: "string",
                      nullable: true,
                    },
                    transfer_id: {
                      type: "string",
                      nullable: true,
                    },
                  },
                },
              },
            },
            requestId: {
              type: "string",
              description: "Request ID for debugging",
              example: "req_abc123",
            },
          },
        },
        DisputeResponse: {
          type: "object",
          description:
            "Dispute details for an order (Finix certification requirement)",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              properties: {
                has_dispute: {
                  type: "boolean",
                  description: "Whether the order has a dispute",
                  example: true,
                },
                order_id: {
                  type: "string",
                  example: "507f1f77bcf86cd799439012",
                },
                dispute_id: {
                  type: "string",
                  nullable: true,
                  example: "DI_abc123",
                },
                dispute_state: {
                  type: "string",
                  enum: ["INQUIRY", "PENDING", "WON", "LOST"],
                  nullable: true,
                  example: "PENDING",
                },
                dispute_reason: {
                  type: "string",
                  nullable: true,
                  example: "FRAUD",
                },
                dispute_amount: {
                  type: "number",
                  nullable: true,
                  description: "Disputed amount in cents",
                  example: 1250000,
                },
                respond_by: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                  description: "Deadline to respond to dispute",
                },
                created_at: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                },
              },
            },
          },
        },
        RefundRequest: {
          type: "object",
          description: "Refund Request for buyer-initiated refund workflow",
          properties: {
            _id: {
              type: "string",
              description: "RefundRequest ID",
              example: "674a1234abcd5678ef901234",
            },
            order_id: {
              type: "string",
              description: "Associated Order ID",
              example: "507f1f77bcf86cd799439012",
            },
            buyer_id: {
              type: "string",
              description: "Buyer who requested the refund",
            },
            seller_id: {
              type: "string",
              description: "Seller who approves/denies the refund",
            },
            requested_amount: {
              type: "number",
              description: "Refund amount in cents",
              example: 1250000,
            },
            original_transfer_amount: {
              type: "number",
              description: "Original payment amount in cents",
              example: 1250000,
            },
            currency: {
              type: "string",
              example: "USD",
            },
            buyer_reason: {
              type: "string",
              description: "Buyer's reason for requesting refund",
              example:
                "Item not as described - watch has scratches not shown in photos",
            },
            status: {
              type: "string",
              description: "Current status of the refund request",
              enum: [
                "pending",
                "return_requested",
                "return_received",
                "approved",
                "executed",
                "denied",
                "cancelled",
              ],
              example: "pending",
            },
            product_returned: {
              type: "boolean",
              description: "Whether buyer has returned the product",
              example: false,
            },
            product_return_confirmed: {
              type: "boolean",
              description: "Whether seller confirmed product receipt",
              example: false,
            },
            return_tracking_number: {
              type: "string",
              nullable: true,
              description: "Return shipment tracking number",
              example: "1Z999AA10123456784",
            },
            seller_response_reason: {
              type: "string",
              nullable: true,
              description: "Seller's reason for approval/denial",
            },
            approved_by: {
              type: "string",
              nullable: true,
              description: "User ID who approved the refund",
            },
            approved_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            denied_by: {
              type: "string",
              nullable: true,
              description: "User ID who denied the refund",
            },
            denied_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            finix_reversal_id: {
              type: "string",
              nullable: true,
              description: "Finix reversal ID after refund executed",
              example: "RV_abc123xyz",
            },
            finix_reversal_state: {
              type: "string",
              nullable: true,
              example: "SUCCEEDED",
            },
            finix_transfer_id: {
              type: "string",
              description: "Original Finix transfer ID",
              example: "TR_original123",
            },
            executed_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            idempotency_id: {
              type: "string",
              description: "Unique idempotency key",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        // ===== NEW: Chat Message Schema =====
        ChatMessage: {
          type: "object",
          description: "Chat message stored in backend with GetStream sync",
          properties: {
            _id: {
              type: "string",
              description: "MongoDB ObjectId",
            },
            stream_channel_id: {
              type: "string",
              description: "GetStream channel ID",
            },
            stream_message_id: {
              type: "string",
              description: "GetStream message ID",
            },
            text: {
              type: "string",
              description: "Message content",
            },
            sender_id: {
              type: "string",
              description: "Sender's MongoDB user ID",
            },
            sender_clerk_id: {
              type: "string",
              description: "Sender's Clerk ID",
            },
            type: {
              type: "string",
              enum: [
                "regular",
                "inquiry",
                "offer",
                "counter_offer",
                "offer_accepted",
                "offer_rejected",
                "order_created",
                "system",
              ],
              description: "Message type",
            },
            status: {
              type: "string",
              enum: ["pending", "sent", "delivered", "failed", "deleted"],
              description: "Delivery status",
            },
            attachments: {
              type: "array",
              items: {
                type: "object",
              },
            },
            read_by: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user_id: { type: "string" },
                  read_at: { type: "string", format: "date-time" },
                },
              },
            },
            reactions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user_id: { type: "string" },
                  type: { type: "string" },
                  created_at: { type: "string", format: "date-time" },
                },
              },
            },
            edited_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            original_text: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["_id", "stream_channel_id", "text", "sender_id"],
        },
        // ===== NEW: Notification Schema =====
        Notification: {
          type: "object",
          description: "In-app notification for users",
          properties: {
            _id: {
              type: "string",
              description: "MongoDB ObjectId",
            },
            user_id: {
              type: "string",
              description: "Recipient user ID",
            },
            type: {
              type: "string",
              enum: [
                "iso_match",
                "reference_check_request",
                "reference_check_response",
                "offer_received",
                "offer_accepted",
                "offer_rejected",
                "counter_offer",
                "order_update",
                "new_follower",
                "new_message",
                "listing_sold",
                "system",
              ],
              description: "Notification type",
            },
            title: {
              type: "string",
              description: "Notification title",
            },
            body: {
              type: "string",
              description: "Notification body text",
            },
            data: {
              type: "object",
              description: "Additional data (listing_id, order_id, etc.)",
            },
            action_url: {
              type: "string",
              nullable: true,
              description: "Deep link URL",
            },
            is_read: {
              type: "boolean",
              default: false,
            },
            read_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            push_sent: {
              type: "boolean",
              default: false,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["_id", "user_id", "type", "title", "body", "is_read"],
        },
        // ===== NEW: Send Message Request =====
        SendMessageRequest: {
          type: "object",
          description: "Request body for sending a message",
          properties: {
            channel_id: {
              type: "string",
              description: "GetStream channel ID",
            },
            text: {
              type: "string",
              description: "Message content",
            },
            type: {
              type: "string",
              enum: ["regular", "inquiry", "offer", "counter_offer"],
              default: "regular",
            },
            attachments: {
              type: "array",
              items: {
                type: "object",
              },
            },
            custom_data: {
              type: "object",
              description: "Additional custom data",
            },
            parent_id: {
              type: "string",
              nullable: true,
              description: "Parent message ID for threading",
            },
          },
          required: ["channel_id", "text"],
        },
        TrustCase: {
          type: "object",
          properties: {
            _id: { type: "string" },
            case_number: { type: "string" },
            reporter_user_id: { type: "string" },
            reported_user_id: { type: "string" },
            status: {
              type: "string",
              enum: [
                "OPEN",
                "INVESTIGATING",
                "ESCALATED",
                "RESOLVED",
                "CLOSED",
              ],
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            category: {
              type: "string",
              enum: ["fraud", "dispute", "safety", "abuse", "other"],
            },
            reason: { type: "string" },
            assigned_to: { type: "string", nullable: true },
            notes: {
              type: "array",
              items: { $ref: "#/components/schemas/TrustCaseNote" },
            },
            evidence_snapshot: { type: "object" },
            resolution: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        TrustCaseNote: {
          type: "object",
          properties: {
            author_id: { type: "string" },
            content: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ReservationTerms: {
          type: "object",
          properties: {
            _id: { type: "string" },
            version: { type: "string", example: "2026.02.10" },
            content: { type: "string" },
            content_hash: { type: "string" },
            effective_date: { type: "string", format: "date-time" },
            is_current: { type: "boolean" },
            is_archived: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        EnrichedConversation: {
          type: "object",
          properties: {
            getstream_channel_id: { type: "string" },
            platform: { type: "string", enum: ["marketplace", "networks"] },
            parties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  avatar: { type: "string", nullable: true },
                },
              },
            },
            business_context: {
              type: "object",
              properties: {
                listing: { type: "object", nullable: true },
                last_offer: {
                  $ref: "#/components/schemas/Offer",
                  nullable: true,
                },
                order: { $ref: "#/components/schemas/Order", nullable: true },
              },
            },
          },
        },
        Offer: {
          type: "object",
          properties: {
            _id: { type: "string" },
            listing_id: { type: "string" },
            buyer_id: { type: "string" },
            seller_id: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string", enum: ["USD", "CAD"] },
            status: {
              type: "string",
              enum: [
                "pending",
                "accepted",
                "declined",
                "countered",
                "expired",
                "cancelled",
              ],
            },
            current_revision_id: { type: "string" },
            revisions: {
              type: "array",
              items: { $ref: "#/components/schemas/OfferRevision" },
            },
            expires_at: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        OfferRevision: {
          type: "object",
          properties: {
            _id: { type: "string" },
            offer_id: { type: "string" },
            revision_number: { type: "integer" },
            amount: { type: "number" },
            currency: { type: "string" },
            made_by: { type: "string" },
            reservation_terms_id: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        NetworkListing: {
          type: "object",
          description: "Networks marketplace listing",
          properties: {
            _id: { type: "string" },
            dialist_id: { type: "string" },
            clerk_id: { type: "string" },
            watch_id: { type: "string" },
            status: {
              type: "string",
              enum: ["draft", "active", "reserved", "sold"],
              description: "Listing status",
            },
            type: {
              type: "string",
              enum: ["for_sale", "wanted"],
              default: "for_sale",
            },
            title: { type: "string" },
            description: { type: "string" },
            brand: { type: "string" },
            model: { type: "string" },
            reference: { type: "string" },
            year: { type: "integer" },
            condition: {
              type: "string",
              enum: ["Excellent", "Good", "Fair", "Needs Service", "For Parts"],
            },
            price: { type: "number" },
            currency: { type: "string", default: "USD" },
            allow_offers: { type: "boolean", default: true },
            author: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                avatar: { type: "string" },
              },
            },
            ships_from: {
              type: "object",
              properties: {
                country: { type: "string" },
                state: { type: "string" },
                city: { type: "string" },
              },
            },
            images: {
              type: "array",
              items: { type: "string", format: "uri" },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: [
            "_id",
            "dialist_id",
            "clerk_id",
            "watch_id",
            "status",
            "brand",
            "model",
            "author",
            "ships_from",
          ],
        },
        NetworkChatMessage: {
          type: "object",
          description: "Message in networks chat",
          properties: {
            _id: { type: "string" },
            stream_channel_id: { type: "string" },
            stream_message_id: { type: "string" },
            text: { type: "string" },
            type: {
              type: "string",
              enum: [
                "regular",
                "inquiry",
                "offer",
                "counter_offer",
                "offer_accepted",
                "offer_rejected",
                "order_created",
                "order_paid",
                "order_shipped",
                "order_delivered",
                "system",
                "image",
                "file",
                "link",
              ],
            },
            sender_id: { type: "string" },
            sender_clerk_id: { type: "string" },
            attachments: { type: "array" },
            custom_data: { type: "object" },
            status: {
              type: "string",
              enum: ["sent", "delivered", "pending_delivery"],
            },
            read_by: { type: "array" },
            reactions: { type: "object" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        mockUser: [],
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Health check endpoints",
      },
      {
        name: "User",
        description: "Generic user endpoints",
      },
      {
        name: "Marketplace - User",
        description: "Marketplace user management",
      },
      {
        name: "Networks - User",
        description: "Networks user management",
      },
      {
        name: "Marketplace - Merchant",
        description: "Merchant onboarding and management",
      },
      {
        name: "Marketplace - Listings",
        description: "Marketplace listings management",
      },
      {
        name: "Marketplace - Orders",
        description: "Marketplace checkout and order management",
      },
      {
        name: "Networks - Listings",
        description: "Networks listings management",
      },
      {
        name: "Networks - Chat",
        description: "Networks real-time chat and messaging via GetStream",
      },
      {
        name: "Networks - Messages",
        description: "Networks message endpoints - send and retrieve messages",
      },
      {
        name: "Networks - Conversations",
        description: "Networks conversation context and history",
      },
      {
        name: "Networks - Home Feed",
        description: "Networks personalized home feed with recommendations",
      },
      {
        name: "Networks - Offers",
        description: "Networks offers and channels",
      },
      {
        name: "Watches",
        description: "Watch database management",
      },
      {
        name: "Onboarding",
        description: "User onboarding process",
      },
      {
        name: "Webhooks",
        description: "Webhook event handlers",
      },
      {
        name: "Debug",
        description:
          "Debug endpoints (Development/Test only) - Mock user system utilities",
      },
      {
        name: "Chat",
        description:
          "GetStream Chat - Real-time messaging between buyers and sellers",
      },
      {
        name: "Feeds",
        description:
          "GetStream Activity Feeds - Social timeline and activity feeds",
      },
      {
        name: "Networks - Connections",
        description: "Connection requests and accepted network relationships",
      },
      {
        name: "ISO",
        description:
          "ISO (In Search Of) / WTB - User wanted listings for watches",
      },
      {
        name: "ReferenceCheck",
        description:
          "Reference Checks - Community vetting system (Networks only, requires Order)",
      },
      {
        name: "Subscription",
        description: "Subscriptions - Tier management and billing",
      },
      {
        name: "User - Favorites",
        description:
          "User favorites - Platform-scoped saved listings. Marketplace favorites separate from Networks.",
      },
      {
        name: "User - Searches",
        description:
          "User recent searches - Platform-scoped search history with context (for-sale, profiles, wtb-iso)",
      },
      {
        name: "User - Notifications",
        description:
          "User notifications - All current-user notification endpoints",
      },
      {
        name: "Marketplace - Channels",
        description:
          "Marketplace chat channels - Unique per (listing, buyer, seller). Channels as first-class resources.",
      },
      {
        name: "Marketplace - Messages",
        description:
          "Marketplace messages - Sub-resource of channels. Platform context known from route.",
      },
      {
        name: "Networks - Channels",
        description:
          "Networks chat channels - Unique per (user1, user2), bidirectional. Reused across listings.",
      },
      {
        name: "Networks - Messages",
        description:
          "Networks messages - Sub-resource of channels. Platform context known from route.",
      },
      {
        name: "Admin - Trust Cases",
        description: "Admin-only trust case management and resolution.",
      },
      {
        name: "Reservation Terms",
        description: "Versioned legal and reservation terms.",
      },
      {
        name: "Conversations",
        description: "Enriched channel context with business data.",
      },
      {
        name: "Marketplace - Offers",
        description: "Offers and counter-offers for marketplace listings.",
      },
      {
        name: "Analytics",
        description: "In-depth messaging and listing performance analytics.",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts", "./src/handlers/**/*.ts"], // This will be ignored since we're defining everything inline
};

export const swaggerSpec = swaggerJSDoc(options) as any;

// Manually add paths since we're not using file annotations
swaggerSpec.paths = {
  "/api/health": {
    get: {
      tags: ["Health"],
      summary: "Get API health status",
      description:
        "Returns system health metrics including uptime, memory usage, and system information",
      responses: {
        200: {
          description: "API is healthy",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/HealthResponse",
              },
              example: {
                status: "healthy",
                timestamp: "2024-01-01T12:00:00.000Z",
                uptime: 3600,
                memory: {
                  used: 50,
                  total: 100,
                  external: 10,
                },
                system: {
                  platform: "linux",
                  nodeVersion: "v20.0.0",
                  pid: 1234,
                },
                requestId: "req_xyz789",
              },
            },
          },
        },
      },
    },
  },
  "/api/ready": {
    get: {
      tags: ["Health"],
      summary: "Kubernetes readiness check",
      description:
        "Verifies API and database are fully ready to accept traffic",
      responses: {
        200: {
          description: "API is ready",
          content: {
            "application/json": {
              example: {
                status: "ready",
                timestamp: "2024-01-01T12:00:00.000Z",
                checks: {
                  database: { status: "healthy", state: "connected" },
                },
                requestId: "req_xyz789",
              },
            },
          },
        },
        503: { description: "API not ready" },
      },
    },
  },
  // --- Webhooks ---
  "/api/v1/webhooks/getstream": {
    post: {
      tags: ["Webhooks"],
      summary: "GetStream webhook handler",
      description:
        "Receives events from GetStream Cloud for tracking and business logic. Uses async Bull queue processing.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      },
      responses: {
        200: {
          description: "Webhook received",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  jobId: { type: "string" },
                },
              },
            },
          },
        },
        401: { description: "Invalid signature" },
      },
    },
  },

  // --- Conversations ---
  "/api/v1/marketplace/conversations": {
    get: {
      tags: ["Networks - Chat"],
      summary: "Generate WebSocket authentication token",
      description:
        "Creates JWT token for real-time WebSocket connection to GetStream and GetStream API key. User is automatically created in GetStream if not exists.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Token generated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: {
                    type: "string",
                    description: "JWT token for WebSocket authentication",
                  },
                  userId: {
                    type: "string",
                    description: "User ID for GetStream",
                  },
                  apiKey: {
                    type: "string",
                    description: "GetStream API key",
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/chat/channels": {
    get: {
      tags: ["Networks - Chat"],
      summary: "List user's chat channels",
      description:
        "Get all channels the authenticated user is a member of, paginated. Includes listing metadata, member info, and unread counts.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20, maximum: 50 },
          description: "Items per page",
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
          description: "Pagination offset",
        },
      ],
      responses: {
        200: {
          description: "Channels listed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  channels: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        type: { type: "string" },
                        cid: { type: "string" },
                        listing_id: { type: "string" },
                        listing_title: { type: "string" },
                        listing_price: { type: "number" },
                        listing_thumbnail: { type: "string" },
                        members: { type: "array", items: { type: "string" } },
                        last_message_at: {
                          type: "string",
                          format: "date-time",
                        },
                        created_at: { type: "string", format: "date-time" },
                        unread_count: { type: "integer" },
                      },
                    },
                  },
                  limit: { type: "integer" },
                  offset: { type: "integer" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/chat/unread": {
    get: {
      tags: ["Networks - Chat"],
      summary: "Get unread message counts",
      description:
        "Returns total unread count and breakdown by channel for authenticated user.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Unread counts",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  total_unread: { type: "integer" },
                  unread_by_channel: { type: "object" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/chat/channel": {
    post: {
      tags: ["Networks - Chat"],
      summary: "Create or retrieve buyer-seller channel",
      description:
        "Creates 1:1 buyer-seller channel if not exists, or returns existing channel. Always returns same channel ID for same user pair.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                listing_id: { type: "string", description: "Listing ID" },
                type: {
                  type: "string",
                  enum: ["messaging", "group"],
                  default: "messaging",
                },
                name: {
                  type: "string",
                  description: "Name for group channels",
                },
                members: {
                  type: "array",
                  items: { type: "string" },
                  description: "Member IDs for group channels",
                },
                image: {
                  type: "string",
                  description: "Channel image URL",
                },
                description: {
                  type: "string",
                  description: "Channel description",
                },
              },
              required: ["listing_id"],
            },
          },
        },
      },
      responses: {
        201: {
          description: "Channel created/retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  channelId: { type: "string" },
                  channel: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string" },
                      members: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "User or listing not found" },
        409: { description: "Channel already exists" },
      },
    },
  },
  "/api/v1/networks/chat/channel/mark-read": {
    post: {
      tags: ["Networks - Chat"],
      summary: "Mark channel as read",
      description: "Mark all messages in a specific channel as read.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                channel_id: { type: "string" },
              },
              required: ["channel_id"],
            },
          },
        },
      },
      responses: {
        200: { description: "Channel marked as read" },
        401: { description: "Unauthorized" },
        403: { description: "Not a member of channel" },
      },
    },
  },

  // --- Messages ---
  "/api/v1/networks/messages/send": {
    post: {
      tags: ["Networks - Messages"],
      summary: "Send message to channel",
      description:
        "Send message to a channel. Backend persists to MongoDB and delivers to GetStream. Must use this endpoint, NOT GetStream SDK sendMessage().",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                channel_id: {
                  type: "string",
                  description: "GetStream channel ID (messaging:...)",
                },
                text: { type: "string" },
                type: {
                  type: "string",
                  enum: [
                    "regular",
                    "inquiry",
                    "offer",
                    "counter_offer",
                    "offer_accepted",
                    "offer_rejected",
                    "order_created",
                    "order_paid",
                    "order_shipped",
                    "order_delivered",
                    "system",
                    "image",
                    "file",
                    "link",
                  ],
                  default: "regular",
                },
                attachments: {
                  type: "array",
                  items: { type: "object" },
                },
                custom_data: { type: "object" },
                parent_id: {
                  type: "string",
                  description: "For threading",
                },
              },
              required: ["channel_id"],
            },
          },
        },
      },
      responses: {
        201: {
          description: "Message sent successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  stream_message_id: { type: "string" },
                  text: { type: "string" },
                  type: { type: "string" },
                  sender_id: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                  status: {
                    type: "string",
                    enum: ["sent", "delivered", "pending_delivery"],
                  },
                },
              },
            },
          },
        },
        400: { description: "Invalid request or channel closed" },
        401: { description: "Unauthorized" },
        403: { description: "Not a member of channel" },
      },
    },
  },
  "/api/v1/networks/messages/chats": {
    get: {
      tags: ["Networks - Messages"],
      summary: "List conversations (alias for /conversations)",
      description: "Get user's conversations with enriched context",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Conversations listed" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/chats/search": {
    get: {
      tags: ["Networks - Messages"],
      summary: "Search conversations",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          required: true,
          description: "Search query",
        },
      ],
      responses: {
        200: { description: "Search results" },
        400: { description: "Query required" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/{chatId}/history": {
    get: {
      tags: ["Networks - Messages"],
      summary: "Get message history for conversation",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "chatId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Message history" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/channel/{channelId}": {
    get: {
      tags: ["Networks - Messages"],
      summary: "Get messages from channel",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "channelId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20, maximum: 100 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "Messages and metadata",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  messages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        channel_id: { type: "string" },
                        user_id: { type: "string" },
                        text: { type: "string" },
                        type: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                        read_by: { type: "array" },
                        reactions: { type: "object" },
                      },
                    },
                  },
                  has_more: { type: "boolean" },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/{id}": {
    put: {
      tags: ["Networks - Messages"],
      summary: "Edit message",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                text: { type: "string" },
                attachments: { type: "array" },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Message updated" },
        400: { description: "Cannot edit messages older than 24 hours" },
        401: { description: "Unauthorized" },
        403: { description: "Can only edit own messages" },
      },
    },
    delete: {
      tags: ["Networks - Messages"],
      summary: "Delete message (soft delete)",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: { description: "Message deleted" },
        401: { description: "Unauthorized" },
        403: { description: "Can only delete own messages" },
      },
    },
  },
  "/api/v1/networks/messages/{id}/read": {
    post: {
      tags: ["Networks - Messages"],
      summary: "Mark message as read",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: { description: "Message marked as read" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/channel/{channelId}/read-all": {
    post: {
      tags: ["Networks - Messages"],
      summary: "Mark all channel messages as read",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "channelId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description: "Messages marked as read",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  marked_as_read: { type: "integer" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/{id}/react": {
    post: {
      tags: ["Networks - Messages"],
      summary: "Add emoji reaction to message",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["like", "love", "laugh", "wow", "sad", "angry"],
                },
              },
              required: ["type"],
            },
          },
        },
      },
      responses: {
        200: { description: "Reaction added" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/messages/channel/{channelId}/archive": {
    post: {
      tags: ["Networks - Messages"],
      summary: "Archive channel",
      description: "Hide channel from user's channel list",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "channelId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: { description: "Channel archived" },
        401: { description: "Unauthorized" },
      },
    },
  },

  // =========================================================================
  // NETWORKS - CONVERSATIONS
  // =========================================================================

  "/api/v1/networks/conversations": {
    get: {
      tags: ["Networks - Conversations"],
      summary: "List all conversations",
      description:
        "Get conversations with enriched context including listing info and recent messages",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "type",
          in: "query",
          schema: {
            type: "string",
            enum: ["all", "unread", "active"],
            default: "all",
          },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "Conversations listed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        channel_id: { type: "string" },
                        listing_id: { type: "string" },
                        listing_title: { type: "string" },
                        last_message: { type: "object" },
                        unread_count: { type: "integer" },
                        members: { type: "integer" },
                        created_at: { type: "string", format: "date-time" },
                      },
                    },
                  },
                  _metadata: {
                    type: "object",
                    properties: {
                      limit: { type: "integer" },
                      offset: { type: "integer" },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/conversations/search": {
    get: {
      tags: ["Networks - Conversations"],
      summary: "Search conversations",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          required: true,
          description: "Search query",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        200: { description: "Search results" },
        400: { description: "Query parameter required" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/conversations/{id}": {
    get: {
      tags: ["Networks - Conversations"],
      summary: "Get conversation context",
      description:
        "Get detailed conversation with listing info, participants, recent messages, offers, and orders",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description: "Conversation context",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  conversation: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      listing: { type: "object" },
                      participants: { type: "array" },
                      status: { type: "string" },
                    },
                  },
                  recent_messages: { type: "array" },
                  offers: { type: "array" },
                  orders: { type: "array" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "Conversation not found" },
      },
    },
  },
  "/api/v1/networks/conversations/{id}/media": {
    get: {
      tags: ["Networks - Conversations"],
      summary: "Get shared media in conversation",
      description: "Retrieve images, files, and links shared in a conversation",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "type",
          in: "query",
          schema: {
            type: "string",
            enum: ["media", "files", "links", "all"],
            default: "all",
          },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Shared media" },
        401: { description: "Unauthorized" },
      },
    },
  },

  // =========================================================================
  // NETWORKS - LISTINGS
  // =========================================================================

  "/api/v1/networks/listings": {
    get: {
      tags: ["Networks - Listings"],
      summary: "Get public listings with filtering & search",
      description:
        "Search and filter listings by brand, category, condition, price, year, etc. Supports pagination and sorting.",
      parameters: [
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          description: "Search query (brand, model, reference)",
        },
        {
          name: "brand",
          in: "query",
          schema: { type: "string" },
        },
        {
          name: "category",
          in: "query",
          schema: { type: "string" },
        },
        {
          name: "condition",
          in: "query",
          schema: {
            type: "string",
            enum: ["Excellent", "Good", "Fair", "Needs Service", "For Parts"],
          },
        },
        {
          name: "contents",
          in: "query",
          schema: { type: "string" },
        },
        {
          name: "year_min",
          in: "query",
          schema: { type: "integer" },
        },
        {
          name: "year_max",
          in: "query",
          schema: { type: "integer" },
        },
        {
          name: "min_price",
          in: "query",
          schema: { type: "number" },
        },
        {
          name: "max_price",
          in: "query",
          schema: { type: "number" },
        },
        {
          name: "allow_offers",
          in: "query",
          schema: { type: "boolean" },
          description: "Filter by whether seller accepts offers",
        },
        {
          name: "sort_by",
          in: "query",
          schema: {
            type: "string",
            enum: ["newest", "price_asc", "price_desc", "relevance"],
            default: "newest",
          },
        },
        {
          name: "sort_order",
          in: "query",
          schema: { type: "string", enum: ["asc", "desc"] },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20, maximum: 100 },
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
        },
      ],
      responses: {
        200: {
          description: "Listings found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/NetworkListing" },
                  },
                  _metadata: {
                    type: "object",
                    properties: {
                      paging: {
                        type: "object",
                        properties: {
                          count: { type: "integer" },
                          total: { type: "integer" },
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          pages: { type: "integer" },
                        },
                      },
                      filters: { type: "object" },
                      sort: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Networks - Listings"],
      summary: "Create new listing (draft)",
      description:
        "Create a new listing in draft status. Must publish separately to make it publicly visible.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                watch: { type: "string", description: "Watch ID" },
                type: {
                  type: "string",
                  enum: ["for_sale", "wanted"],
                  default: "for_sale",
                },
                title: { type: "string" },
                description: { type: "string" },
                condition: {
                  type: "string",
                  enum: [
                    "Excellent",
                    "Good",
                    "Fair",
                    "Needs Service",
                    "For Parts",
                  ],
                },
                price: { type: "number" },
                allow_offers: { type: "boolean", default: true },
                location: { type: "object" },
              },
              required: ["watch"],
            },
          },
        },
      },
      responses: {
        201: { description: "Listing created (draft)" },
        400: { description: "Invalid input or limits exceeded" },
        401: { description: "Unauthorized" },
        404: { description: "Watch not found" },
      },
    },
  },
  "/api/v1/networks/listings/{id}": {
    get: {
      tags: ["Networks - Listings"],
      summary: "Get single listing details",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: { description: "Listing details" },
        404: { description: "Listing not found" },
      },
    },
    patch: {
      tags: ["Networks - Listings"],
      summary: "Update listing (draft only)",
      description:
        "Update draft listing details. Cannot update published listings.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                condition: { type: "string" },
                price: { type: "number" },
                allow_offers: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Listing updated" },
        400: { description: "Cannot update published listing" },
        401: { description: "Unauthorized" },
        404: { description: "Listing not found" },
      },
    },
  },
  "/api/v1/networks/listings/{id}/preview": {
    get: {
      tags: ["Networks - Listings"],
      summary: "Preview listing (author only)",
      description:
        "Get draft listing details for preview. Only accessible by listing author.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: { description: "Preview data" },
        401: { description: "Unauthorized" },
        403: { description: "Only author can preview" },
        404: { description: "Listing not found" },
      },
    },
  },
  "/api/v1/networks/listings/{id}/publish": {
    post: {
      tags: ["Networks - Listings"],
      summary: "Publish listing to make it public",
      description:
        "Transition draft listing to active. Creates chat channel and enables buyer inquiries.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                images: {
                  type: "array",
                  items: { type: "string" },
                  description: "Image IDs to publish with",
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Listing published" },
        400: { description: "Listing incomplete or already published" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/listings/{id}/status": {
    patch: {
      tags: ["Networks - Listings"],
      summary: "Update listing status",
      description:
        "Change listing status (active → reserved/sold, or unpublish)",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: ["draft", "active", "reserved", "sold"],
                },
              },
              required: ["status"],
            },
          },
        },
      },
      responses: {
        200: { description: "Status updated" },
        400: { description: "Invalid status transition" },
        401: { description: "Unauthorized" },
      },
    },
  },

  // --- Marketplace Offers ---
  "/api/v1/marketplace/offers": {
    get: {
      tags: ["Marketplace - Offers"],
      summary: "Get current user's marketplace offers",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "type",
          in: "query",
          schema: { type: "string", enum: ["sent", "received"] },
        },
        { name: "status", in: "query", schema: { type: "string" } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "Offers retrieved",
          content: {
            "application/json": {
              schema: {
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Offer" },
                  },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/offers/{id}": {
    get: {
      tags: ["Marketplace - Offers"],
      summary: "Get specific marketplace offer details",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Offer details retrieved",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Offer" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/offers/{id}/accept": {
    post: {
      tags: ["Marketplace - Offers"],
      summary: "Accept a marketplace offer",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Offer accepted",
          content: {
            "application/json": {
              schema: {
                properties: {
                  success: { type: "boolean" },
                  order_id: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/offers/{id}/reject": {
    post: {
      tags: ["Marketplace - Offers"],
      summary: "Reject a marketplace offer",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Offer rejected" } },
    },
  },
  "/api/v1/marketplace/offers/{id}/counter": {
    post: {
      tags: ["Marketplace - Offers"],
      summary: "Counter a marketplace offer",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Counter offer sent",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Offer" },
            },
          },
        },
      },
    },
  },
  // --- Admin Trust Cases ---
  "/api/v1/admin/trust-cases": {
    get: {
      tags: ["Admin - Trust Cases"],
      summary: "List trust cases with filters",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["OPEN", "INVESTIGATING", "ESCALATED", "RESOLVED", "CLOSED"],
          },
        },
        {
          name: "priority",
          in: "query",
          schema: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
        },
        {
          name: "category",
          in: "query",
          schema: {
            type: "string",
            enum: ["fraud", "dispute", "safety", "abuse", "other"],
          },
        },
        { name: "assigned_to", in: "query", schema: { type: "string" } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "Cases retrieved successfully",
          content: {
            "application/json": {
              schema: {
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TrustCase" },
                  },
                  total: { type: "integer" },
                  limit: { type: "integer" },
                  offset: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Admin - Trust Cases"],
      summary: "Create a new trust case",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reported_user_id", "category", "reason"],
              properties: {
                reported_user_id: { type: "string" },
                order_id: { type: "string" },
                reference_check_id: { type: "string" },
                category: {
                  type: "string",
                  enum: ["fraud", "dispute", "safety", "abuse", "other"],
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high", "critical"],
                  default: "medium",
                },
                reason: { type: "string", minLength: 5 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Case created successfully" },
      },
    },
  },
  "/api/v1/admin/trust-cases/{id}": {
    get: {
      tags: ["Admin - Trust Cases"],
      summary: "Get a specific trust case",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Case retrieved",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TrustCase" },
            },
          },
        },
      },
    },
  },
  "/api/v1/admin/trust-cases/{id}/assign": {
    put: {
      tags: ["Admin - Trust Cases"],
      summary: "Assign a case to an admin",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["assignee_id"],
              properties: { assignee_id: { type: "string" } },
            },
          },
        },
      },
      responses: { 200: { description: "Assigned" } },
    },
  },
  "/api/v1/admin/trust-cases/{id}/note": {
    post: {
      tags: ["Admin - Trust Cases"],
      summary: "Add a note to a case",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["content"],
              properties: { content: { type: "string" } },
            },
          },
        },
      },
      responses: { 200: { description: "Note added" } },
    },
  },
  "/api/v1/admin/trust-cases/{id}/resolve": {
    put: {
      tags: ["Admin - Trust Cases"],
      summary: "Resolve a case",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["resolution"],
              properties: { resolution: { type: "string" } },
            },
          },
        },
      },
      responses: { 200: { description: "Resolved" } },
    },
  },
  "/api/v1/admin/trust-cases/{id}/suspend-user": {
    post: {
      tags: ["Admin - Trust Cases"],
      summary: "Suspend a user as part of a trust case",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["user_id", "duration_days", "reason"],
              properties: {
                user_id: { type: "string" },
                duration_days: { type: "integer" },
                reason: { type: "string" },
              },
            },
          },
        },
      },
      responses: { 200: { description: "User suspended" } },
    },
  },
  "/api/v1/analytics/messages": {
    get: {
      tags: ["Analytics"],
      summary: "Get message analytics",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "startDate",
          in: "query",
          schema: { type: "string", format: "date" },
        },
        {
          name: "endDate",
          in: "query",
          schema: { type: "string", format: "date" },
        },
        { name: "listingId", in: "query", schema: { type: "string" } },
        { name: "userId", in: "query", schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Analytics data",
          content: {
            "application/json": {
              example: {
                total_messages: 1500,
                unique_users: 45,
                messages_by_type: [
                  { _id: "regular", count: 1200 },
                  { _id: "offer", count: 300 },
                ],
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/analytics/listing/{listingId}/messages": {
    get: {
      tags: ["Analytics"],
      summary: "Get messages for a specific listing",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "listingId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 100 },
        },
      ],
      responses: {
        200: {
          description: "List of messages",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ChatMessage" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/user": {
    get: {
      tags: ["Marketplace - User"],
      summary: "Get marketplace user info",
      description: "Returns marketplace-specific user information",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Marketplace user info retrieved",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          platform: {
                            type: "string",
                            example: "marketplace",
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/networks/user": {
    get: {
      tags: ["Networks - User"],
      summary: "Get networks user info",
      description: "Returns networks-specific user information",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Networks user info retrieved",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          platform: {
                            type: "string",
                            example: "networks",
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/networks/user/listings": {
    get: {
      tags: ["Networks - User"],
      summary: "Get user listings inventory",
      description:
        "Returns the authenticated user's listings inventory with pagination and filtering",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["all", "draft", "active", "reserved", "sold"],
            default: "all",
          },
          description: "Filter listings by status",
        },
        {
          name: "limit",
          in: "query",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: "Number of listings to return",
        },
        {
          name: "page",
          in: "query",
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Page number for pagination",
        },
      ],
      responses: {
        200: {
          description: "User listings retrieved successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/Listing",
                        },
                      },
                      _metadata: {
                        $ref: "#/components/schemas/InventoryMetadata",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/merchant/onboard": {
    post: {
      tags: ["Marketplace - Merchant"],
      summary: "Create merchant onboarding session",
      description:
        "Creates a Finix merchant onboarding session and returns the onboarding URL. The form is prefilled with user data including business name (priority: request body > business_info > display_name), personal info, and location details.\\n\\n**[FINIX CERT]** Uses Finix-hosted onboarding forms for compliance. Requires idempotency_id to prevent duplicate form creation. The returned onboarding_url is valid for 30 days; use /refresh-link to generate a new URL after expiration.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/MerchantOnboardRequest",
            },
            example: {
              idempotency_id: "onboard-abc123",
              business_name: "My Watch Business",
              max_transaction_amount: 50000,
              return_url: "https://myapp.com/onboarding-complete",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Onboarding session created successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        $ref: "#/components/schemas/MerchantOnboardResponse",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: {
          description: "Bad request - user already approved merchant",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/merchant/status": {
    get: {
      tags: ["Marketplace - Merchant"],
      summary: "Get merchant status",
      description:
        "Returns the current merchant status for the authenticated user",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Merchant status retrieved successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          is_merchant: {
                            type: "boolean",
                            description:
                              "Whether user has completed merchant onboarding",
                          },
                          identity_id: {
                            type: "string",
                            nullable: true,
                            description:
                              "Finix Identity ID (links all Finix events)",
                          },
                          merchant_id: {
                            type: "string",
                            nullable: true,
                            description: "Finix Merchant ID",
                          },
                          verification_id: {
                            type: "string",
                            nullable: true,
                            description: "Finix Verification resource ID",
                          },
                          onboarding_form_id: {
                            type: "string",
                            nullable: true,
                            description: "Finix Onboarding Form ID",
                          },
                          onboarding_state: {
                            type: "string",
                            nullable: true,
                            enum: [
                              "PROVISIONING",
                              "UPDATE_REQUESTED",
                              "REJECTED",
                              "APPROVED",
                            ],
                            description: "Merchant onboarding status",
                          },
                          verification_state: {
                            type: "string",
                            nullable: true,
                            enum: ["PENDING", "SUCCEEDED", "FAILED"],
                            description: "Merchant verification status",
                          },
                          onboarded_at: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                            description: "When onboarding form was completed",
                          },
                          verified_at: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                            description: "When verification succeeded",
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/merchant/onboard/refresh-link": {
    post: {
      tags: ["Marketplace - Merchant"],
      summary: "Refresh expired onboarding form link",
      description:
        "Creates a new onboarding link for the existing form ID. Requires idempotency_id to prevent duplicate link creation.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["idempotency_id"],
              properties: {
                idempotency_id: {
                  type: "string",
                  description: "Idempotency key for link creation",
                  example: "refresh-onboard-abc123",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Onboarding link refreshed successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [{ $ref: "#/components/schemas/ApiResponse" }],
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/networks/offers": {
    get: {
      tags: ["Networks - Offers"],
      summary: "Get current user's offers",
      description:
        "Returns all offers sent or received by the authenticated user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "type",
          in: "query",
          schema: { type: "string", enum: ["sent", "received"] },
          description: "Filter by sent or received",
        },
        {
          name: "status",
          in: "query",
          schema: { type: "string" },
          description: "Filter by offer status",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "Offers retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Offer" },
                  },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
      },
    },
  },

  "/api/v1/debug/mock-users": {
    get: {
      tags: ["Debug"],
      summary: "List all available mock users",
      description: `**Development/Test Only** - Returns a comprehensive list of all mock users available for testing.

**Usage:**
1. Copy a mock user \`id\` from the response
2. Use it as the value for \`x-test-user\` header in API requests
3. Or use the Swagger "Authorize" button with the mockUser option

**Categories:**
- \`new_user\` - Fresh users with no onboarding
- \`onboarding_in_progress\` - Users at various onboarding steps
- \`buyer\` - Fully onboarded buyers (can purchase)
- \`merchant\` - Merchants in various states (pending, approved, etc.)
- \`edge_case\` - Special testing scenarios

**Note:** This endpoint only works in development/test environments. Returns 404 in production.`,
      responses: {
        200: {
          description: "List of mock users",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    example: "Available mock users for frontend development",
                  },
                  usage: {
                    type: "object",
                    properties: {
                      header: {
                        type: "string",
                        example: "x-test-user",
                      },
                      example: {
                        type: "string",
                        example:
                          'fetch("/api/v1/networks/users/profile", { headers: { "x-test-user": "buyer_us_complete" } })',
                      },
                      note: {
                        type: "string",
                        example:
                          "Mock users are ONLY available in development/test environments",
                      },
                    },
                  },
                  total: {
                    type: "number",
                    example: 18,
                  },
                  categories: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    example: [
                      "new_user",
                      "onboarding_in_progress",
                      "buyer",
                      "merchant",
                      "edge_case",
                    ],
                  },
                  users_by_category: {
                    type: "object",
                    additionalProperties: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string" },
                        },
                      },
                    },
                  },
                  all_users: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          example: "buyer_us_complete",
                        },
                        name: {
                          type: "string",
                          example: "US Buyer (Complete)",
                        },
                        description: {
                          type: "string",
                          example:
                            "Fully onboarded US buyer. Can browse/buy but NOT sell.",
                        },
                        category: {
                          type: "string",
                          example: "buyer",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        404: {
          description: "Not available in production",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    example: "Not Found",
                  },
                  message: {
                    type: "string",
                    example: "Debug endpoints are not available in production",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/debug/mock-users/{id}": {
    get: {
      tags: ["Debug"],
      summary: "Get details for a specific mock user",
      description: `**Development/Test Only** - Returns detailed information about a specific mock user including session claims and expected API behavior.

**Use this to:**
- See what claims a mock user has
- Understand what endpoints they can access
- Get usage examples for testing`,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Mock user ID (e.g., buyer_us_complete)",
          schema: {
            type: "string",
            example: "buyer_us_complete",
          },
        },
      ],
      responses: {
        200: {
          description: "Mock user details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    example: "Mock user details: US Buyer (Complete)",
                  },
                  usage: {
                    type: "object",
                    properties: {
                      header: { type: "string", example: "x-test-user" },
                      value: {
                        type: "string",
                        example: "buyer_us_complete",
                      },
                      example: {
                        type: "string",
                        example:
                          'fetch("/api/v1/networks/users/profile", { headers: { "x-test-user": "buyer_us_complete" } })',
                      },
                    },
                  },
                  user: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      category: { type: "string" },
                    },
                  },
                  session_claims: {
                    type: "object",
                    description:
                      "Claims that will be injected into the session",
                  },
                  expected_behavior: {
                    type: "object",
                    description: "Expected behavior for various API endpoints",
                    additionalProperties: { type: "string" },
                  },
                },
              },
            },
          },
        },
        404: {
          description: "Mock user not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string" },
                  available_ids: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/debug/mock-users/category/{category}": {
    get: {
      tags: ["Debug"],
      summary: "Get mock users by category",
      description: `**Development/Test Only** - Returns all mock users in a specific category.

**Categories:**
- \`new_user\` - Fresh users
- \`onboarding_in_progress\` - Users mid-onboarding
- \`buyer\` - Complete buyers
- \`merchant\` - Merchant states
- \`edge_case\` - Special cases`,
      parameters: [
        {
          name: "category",
          in: "path",
          required: true,
          description: "Category name",
          schema: {
            type: "string",
            enum: [
              "new_user",
              "onboarding_in_progress",
              "buyer",
              "merchant",
              "edge_case",
            ],
            example: "buyer",
          },
        },
      ],
      responses: {
        200: {
          description: "Users in category",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  category: { type: "string" },
                  count: { type: "number" },
                  users: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        404: {
          description: "Invalid category",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string" },
                  valid_categories: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/networks/onboarding/status": {
    get: {
      tags: ["Onboarding"],
      summary: "Get Networks onboarding status",
      description:
        "Returns the current Networks onboarding status and any pre-population hints.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Networks onboarding status retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["incomplete", "completed"],
                      },
                      completed_at: {
                        type: ["string", "null"],
                        format: "date-time",
                      },
                      requires: {
                        type: "array",
                        items: { type: "string" },
                      },
                      pre_populated: {
                        type: ["object", "null"],
                      },
                    },
                  },
                  requestId: { type: "string" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/networks/onboarding/complete": {
    patch: {
      tags: ["Onboarding"],
      summary: "Complete Networks onboarding",
      description:
        "Atomically completes Networks onboarding with profile, location, and avatar.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["profile", "location", "avatar"],
              properties: {
                profile: {
                  type: "object",
                  required: ["first_name", "last_name"],
                  properties: {
                    first_name: { type: "string" },
                    last_name: { type: "string" },
                  },
                },
                location: {
                  type: "object",
                  required: ["country", "region", "currency"],
                  properties: {
                    country: { type: "string", enum: ["CA", "US"] },
                    region: { type: "string" },
                    postal_code: { type: "string" },
                    city: { type: "string" },
                    line1: { type: "string" },
                    line2: { type: "string" },
                    currency: { type: "string", enum: ["USD", "CAD"] },
                  },
                },
                avatar: {
                  type: "object",
                  oneOf: [
                    {
                      type: "object",
                      required: [
                        "type",
                        "monogram_initials",
                        "monogram_color",
                        "monogram_style",
                      ],
                      properties: {
                        type: { type: "string", enum: ["monogram"] },
                        monogram_initials: { type: "string" },
                        monogram_color: { type: "string" },
                        monogram_style: { type: "string" },
                      },
                    },
                    {
                      type: "object",
                      required: ["type", "url"],
                      properties: {
                        type: { type: "string", enum: ["upload"] },
                        url: { type: "string", format: "uri" },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Networks onboarding completed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      onboarding: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["completed"] },
                          completed_at: {
                            type: "string",
                            format: "date-time",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        409: {
          description: "Already completed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/onboarding/status": {
    get: {
      tags: ["Onboarding"],
      summary: "Get Marketplace onboarding status",
      description:
        "Returns current Marketplace onboarding status, requirements, and optional pre-population from Networks.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Marketplace onboarding status retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["incomplete", "completed"],
                      },
                      requires: {
                        type: "array",
                        items: { type: "string" },
                      },
                      pre_populated: {
                        type: ["object", "null"],
                      },
                      user_type: {
                        type: "string",
                        enum: ["buyer", "dealer"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/onboarding/complete": {
    patch: {
      tags: ["Onboarding"],
      summary: "Complete Marketplace onboarding",
      description:
        "Atomically completes Marketplace onboarding. Dealer intent can auto-start merchant onboarding session creation.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: [
                "intent",
                "profile",
                "location",
                "avatar",
                "acknowledgements",
              ],
              properties: {
                intent: { type: "string", enum: ["buyer", "dealer"] },
                profile: {
                  type: "object",
                  required: ["first_name", "last_name"],
                  properties: {
                    first_name: { type: "string" },
                    last_name: { type: "string" },
                  },
                },
                location: {
                  type: "object",
                  required: ["country", "region", "currency"],
                  properties: {
                    country: { type: "string", enum: ["CA", "US"] },
                    region: { type: "string" },
                    postal_code: { type: "string" },
                    city: { type: "string" },
                    line1: { type: "string" },
                    line2: { type: "string" },
                    currency: { type: "string", enum: ["USD", "CAD"] },
                  },
                },
                avatar: {
                  type: "object",
                  required: ["type", "url"],
                  properties: {
                    type: { type: "string", enum: ["upload"] },
                    url: { type: "string", format: "uri" },
                  },
                },
                acknowledgements: {
                  type: "object",
                  required: ["marketplace_tos"],
                  properties: {
                    marketplace_tos: { type: "boolean", enum: [true] },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Marketplace onboarding completed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      marketplace_onboarding: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["completed"] },
                          intent: {
                            type: "string",
                            enum: ["buyer", "dealer"],
                          },
                          user_type: {
                            type: "string",
                            enum: ["buyer", "dealer"],
                          },
                        },
                      },
                      merchant_onboarding: {
                        type: ["object", "null"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        409: {
          description: "Already completed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/webhooks/clerk": {
    post: {
      tags: ["Webhooks"],
      summary: "Clerk webhook",
      description:
        "Handles webhook events from Clerk authentication service. Requires Svix signature headers: svix-id, svix-signature, and svix-timestamp.",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              description: "Clerk webhook payload",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Webhook processed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Bad request - invalid webhook signature",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/webhooks/finix": {
    post: {
      tags: ["Webhooks"],
      summary: "Finix webhook",
      description:
        "Handles webhook events from Finix payment processor.\\n\\n**[FINIX CERT]** Implements webhook signature verification using HMAC-SHA256. The Finix-Signature header is validated using crypto.timingSafeEqual to prevent timing attacks. Events include merchant.onboarding.updated (PROVISIONING, APPROVED, REJECTED), dispute.created, dispute.updated, transfer.succeeded, transfer.failed, and verification.updated. All events are logged to FinixWebhookEvent collection for audit trails.",
      security: [{ basicAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/WebhookEvent",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Webhook processed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  message: {
                    type: "string",
                    example: "Webhook received and enqueued",
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized - invalid webhook signature",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        400: {
          description: "Bad request - invalid webhook signature",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings": {
    get: {
      tags: ["Marketplace - Listings"],
      summary: "Get marketplace listings",
      description:
        "Returns public marketplace listings with filtering, sorting, and pagination",
      parameters: [
        {
          name: "q",
          in: "query",
          schema: {
            type: "string",
            maxLength: 100,
          },
          description: "Search query for brand, model, or reference",
        },
        {
          name: "brand",
          in: "query",
          schema: {
            type: "string",
            maxLength: 50,
          },
          description: "Filter by watch brand",
        },
        {
          name: "condition",
          in: "query",
          schema: {
            type: "string",
            enum: ["new", "like-new", "good", "fair", "poor"],
          },
          description: "Filter by condition",
        },
        {
          name: "min_price",
          in: "query",
          schema: {
            type: "number",
            minimum: 0,
          },
          description: "Minimum price filter",
        },
        {
          name: "max_price",
          in: "query",
          schema: {
            type: "number",
            minimum: 0,
          },
          description: "Maximum price filter",
        },
        {
          name: "sort_by",
          in: "query",
          schema: {
            type: "string",
            enum: ["price", "created", "updated"],
            default: "created",
          },
          description: "Sort field",
        },
        {
          name: "sort_order",
          in: "query",
          schema: {
            type: "string",
            enum: ["asc", "desc"],
            default: "desc",
          },
          description: "Sort order",
        },
        {
          name: "limit",
          in: "query",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: "Number of results per page",
        },
        {
          name: "page",
          in: "query",
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Page number",
        },
      ],
      responses: {
        200: {
          description: "Listings retrieved successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/Listing",
                        },
                      },
                      _metadata: {
                        type: "object",
                        properties: {
                          pagination: {
                            $ref: "#/components/schemas/PaginationMetadata",
                          },
                          filters: {
                            type: "object",
                          },
                          sort: {
                            type: "object",
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Marketplace - Listings"],
      summary: "Create marketplace listing",
      description:
        "Creates a new marketplace listing for the authenticated user. Limits apply based on subscription tier (Free: 10 drafts, Premium: 10 drafts).",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["watch"],
              properties: {
                watch: {
                  type: "string",
                  description: "MongoDB ObjectId of the watch",
                },
              },
            },
            example: {
              watch: "507f1f77bcf86cd799439011",
            },
          },
        },
      },
      responses: {
        201: {
          description: "Listing created successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        $ref: "#/components/schemas/Listing",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}": {
    patch: {
      tags: ["Marketplace - Listings"],
      summary: "Update marketplace listing",
      description:
        "Updates an existing marketplace listing owned by the authenticated user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                subtitle: {
                  type: "string",
                  maxLength: 200,
                },
                price: {
                  type: "number",
                  minimum: 0,
                },
                condition: {
                  type: "string",
                  enum: ["new", "like-new", "good", "fair", "poor"],
                },
                year: {
                  type: "number",
                  minimum: 1900,
                  maximum: 2025,
                },
                contents: {
                  type: "string",
                  enum: ["box_papers", "box", "papers", "watch"],
                },
                images: {
                  type: "array",
                  items: {
                    type: "string",
                    format: "uri",
                  },
                },
                thumbnail: {
                  type: "string",
                  format: "uri",
                },
                shipping: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      region: {
                        type: "string",
                        enum: ["US", "CA"],
                      },
                      shippingIncluded: {
                        type: "boolean",
                      },
                      shippingCost: {
                        type: "number",
                        minimum: 0,
                      },
                    },
                  },
                },
                ships_from: {
                  type: "object",
                  properties: {
                    country: {
                      type: "string",
                      minLength: 2,
                    },
                    state: {
                      type: "string",
                    },
                    city: {
                      type: "string",
                    },
                  },
                },
              },
            },
            example: {
              subtitle: "Beautiful condition with full set",
              price: 2500,
              condition: "like-new",
              year: 2020,
              contents: "box_papers",
              images: ["https://example.com/image1.jpg"],
              thumbnail: "https://example.com/thumbnail.jpg",
              shipping: [
                {
                  region: "US",
                  shippingIncluded: false,
                  shippingCost: 25,
                },
              ],
              ships_from: {
                country: "US",
                state: "NY",
                city: "New York",
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Listing updated successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        $ref: "#/components/schemas/Listing",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - not the owner",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}/publish": {
    post: {
      tags: ["Marketplace - Listings"],
      summary: "Publish marketplace listing",
      description:
        "Publishes a draft marketplace listing, making it active and visible to other users. Active listing limits apply (Free: 25, Premium: 50).",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
      ],
      responses: {
        200: {
          description: "Listing published successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        $ref: "#/components/schemas/Listing",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: {
          description: "Bad request - listing incomplete or already published",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - not the owner",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}/images": {
    post: {
      tags: ["Marketplace - Listings"],
      summary: "Upload images to listing",
      description:
        "Upload 3-10 images to a marketplace listing. Images are automatically optimized and converted to WebP format. Thumbnails are generated automatically. Only draft listings can have images uploaded.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                images: {
                  type: "array",
                  items: {
                    type: "string",
                    format: "binary",
                  },
                  minItems: 3,
                  maxItems: 10,
                  description:
                    "Image files (JPEG, PNG, WebP, GIF). Min 3, max 10 files. Max 10MB per file, 50MB total.",
                },
              },
              required: ["images"],
            },
          },
        },
      },
      responses: {
        200: {
          description: "Images uploaded successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          images: {
                            type: "array",
                            items: {
                              $ref: "#/components/schemas/ImageMetadata",
                            },
                          },
                          count: {
                            type: "number",
                            example: 3,
                          },
                        },
                      },
                    },
                  },
                ],
              },
              example: {
                data: {
                  images: [
                    {
                      key: "listings/507f1f77bcf86cd799439011/abc123-image1.webp",
                      url: "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/507f1f77bcf86cd799439011/abc123-image1.webp",
                      thumbnailKey:
                        "listings/507f1f77bcf86cd799439011/thumb_abc123-image1.webp",
                      thumbnailUrl:
                        "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/507f1f77bcf86cd799439011/thumb_abc123-image1.webp",
                      size: 245678,
                      width: 2048,
                      height: 1536,
                      mimeType: "image/webp",
                      uploadedAt: "2024-01-15T10:30:00.000Z",
                    },
                  ],
                  count: 3,
                },
                requestId: "abc-123-def",
              },
            },
          },
        },
        400: {
          description:
            "Bad request - invalid files, wrong count, or listing not in draft status",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              examples: {
                noImages: {
                  value: {
                    error: {
                      message: "No images uploaded. Please upload 3-10 images.",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
                tooFew: {
                  value: {
                    error: {
                      message: "Listings require at least 3 images",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
                tooLarge: {
                  value: {
                    error: {
                      message: "File image.jpg exceeds maximum size of 10MB",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
                invalidFormat: {
                  value: {
                    error: {
                      message:
                        "Unsupported image format. Supported: image/jpeg, image/png, image/webp, image/gif",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - not the listing owner",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}/images/{imageKey}": {
    delete: {
      tags: ["Marketplace - Listings"],
      summary: "Delete image from listing",
      description:
        "Remove a specific image from a marketplace listing. The image and its thumbnail are deleted from S3 storage. If the deleted image was the primary thumbnail, the first remaining image becomes the new thumbnail.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
        {
          name: "imageKey",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description:
            "Image key (URL-encoded S3 key, e.g., listings%2F123%2Fimage.webp)",
        },
      ],
      responses: {
        200: {
          description: "Image deleted successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          remainingImages: {
                            type: "number",
                            example: 2,
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - not the listing owner",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing or image not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}/thumbnail": {
    patch: {
      tags: ["Marketplace - Listings"],
      summary: "Set primary thumbnail",
      description:
        "Set a specific image as the primary thumbnail for the listing. The image must already be uploaded to the listing.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                imageUrl: {
                  type: "string",
                  description: "Full URL of the image to set as thumbnail",
                  example:
                    "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/123/image2.webp",
                },
              },
              required: ["imageUrl"],
            },
          },
        },
      },
      responses: {
        200: {
          description: "Thumbnail updated successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          thumbnail: {
                            type: "string",
                            example:
                              "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/123/image2.webp",
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: {
          description: "Bad request - imageUrl missing",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - not the listing owner",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing not found or image not in listing",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}/images/reorder": {
    patch: {
      tags: ["Marketplace - Listings"],
      summary: "Reorder listing images",
      description:
        "Change the display order of images in a listing. Provide an array of image URLs in the desired order. All existing images must be included.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                imageUrls: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Array of image URLs in desired order",
                  example: [
                    "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/123/image3.webp",
                    "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/123/image1.webp",
                    "https://dialist-mobile.s3.ca-central-1.amazonaws.com/listings/123/image2.webp",
                  ],
                },
              },
              required: ["imageUrls"],
            },
          },
        },
      },
      responses: {
        200: {
          description: "Images reordered successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          images: {
                            type: "array",
                            items: {
                              type: "string",
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: {
          description:
            "Bad request - invalid array, count mismatch, or URL not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              examples: {
                notArray: {
                  value: {
                    error: {
                      message: "imageUrls must be an array",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
                countMismatch: {
                  value: {
                    error: {
                      message:
                        "imageUrls count must match existing images count",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
                urlNotFound: {
                  value: {
                    error: {
                      message: "Image URL not found: https://...",
                      code: "VALIDATION_ERROR",
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - not the listing owner",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/listings/{id}/inquire": {
    post: {
      tags: ["Marketplace - Listings"],
      summary: "Inquire on a listing",
      description:
        "Creates a chat channel with the seller IMMEDIATELY and sends an inquiry. The channel is unique per (listing, buyer, seller) combination. Channel is reused for all future interactions on this listing.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "Listing ID",
        },
      ],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Optional inquiry message",
                  example: "Is this still available?",
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Inquiry sent and channel created",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      channel_id: { type: "string" },
                      getstream_channel_id: { type: "string" },
                      listing_id: { type: "string" },
                      seller_id: { type: "string" },
                      created: { type: "boolean" },
                    },
                  },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        200: {
          description: "Inquiry added to existing conversation",
        },
        400: {
          description: "Cannot inquire on your own listing",
        },
        404: {
          description: "Listing not found",
        },
      },
    },
  },
  "/api/v1/marketplace/users/{id}": {
    get: {
      tags: ["Marketplace - Users"],
      summary: "Get marketplace user profile",
      description: "Returns public marketplace profile information for a user",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "User ID",
        },
      ],
      responses: {
        200: {
          description: "User profile retrieved successfully",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponse" },
                  {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          _id: {
                            type: "string",
                          },
                          name: {
                            type: "string",
                            nullable: true,
                          },
                          location: {
                            type: "string",
                          },
                          avatar: {
                            type: "string",
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        404: {
          description: "User not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/reserve": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Reserve a marketplace listing",
      description:
        "Creates a 45-minute reservation on a marketplace listing. During this time, the listing is locked for the buyer to complete payment. **[FINIX CERT]** Returns fraud_session_id for fraud prevention tracking throughout the payment flow.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["listing_id"],
              properties: {
                listing_id: {
                  type: "string",
                  description: "MongoDB ObjectId of the listing to reserve",
                  example: "507f1f77bcf86cd799439011",
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Listing reserved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "object",
                    properties: {
                      order_id: {
                        type: "string",
                        description: "MongoDB ObjectId of the created order",
                        example: "507f1f77bcf86cd799439012",
                      },
                      status: {
                        type: "string",
                        enum: ["reserved"],
                        example: "reserved",
                      },
                      reservation_expires_at: {
                        type: "string",
                        format: "date-time",
                        description:
                          "When the reservation expires (45 minutes from now)",
                        example: "2025-11-27T15:30:00.000Z",
                      },
                      fraud_session_id: {
                        type: "string",
                        description: "Fraud prevention session ID",
                        example: "fs_a1b2c3d4e5f6789012345678",
                      },
                      listing: {
                        type: "object",
                        properties: {
                          title: {
                            type: "string",
                            example: "Rolex Submariner",
                          },
                          image: {
                            type: "string",
                            nullable: true,
                            example: "https://example.com/image.jpg",
                          },
                          price: {
                            type: "number",
                            example: 12500,
                          },
                          condition: {
                            type: "string",
                            enum: ["new", "like-new", "good", "fair", "poor"],
                            example: "like-new",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Bad request - validation error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not authenticated",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        403: {
          description: "Forbidden - cannot buy own listing",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        404: {
          description: "Listing not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/{id}/tokenize": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Get payment tokenization form configuration",
      description:
        "Returns Finix configuration needed to initialize the payment tokenization form on the frontend. Creates a Finix buyer identity with full profile (name, email, phone, address) if it doesn't exist.\n\n**Prefill Customization**: Users can override profile data by passing optional fields (first_name, last_name, email, phone, address).\n\n**Currency Support**: Automatically detects USD or CAD based on buyer location. Override with `currency` parameter.\n\n**Payment Types**: Supports card and bank (ACH/EFT) payment instruments.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID from reserve step",
          schema: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/TokenizeRequest",
            },
            examples: {
              minimal: {
                summary: "Minimal request (uses profile data)",
                value: {
                  idempotency_id: "buyer-abc123",
                },
              },
              withPrefill: {
                summary: "With prefill customization",
                value: {
                  idempotency_id: "buyer-abc123",
                  first_name: "John",
                  last_name: "Doe",
                  email: "john.doe@example.com",
                  phone: "4155551234",
                  address_line1: "123 Market St",
                  city: "San Francisco",
                  region: "CA",
                  postal_code: "94114",
                  country: "USA",
                },
              },
              canadianBuyer: {
                summary: "Canadian buyer (CAD currency)",
                value: {
                  idempotency_id: "buyer-ca-123",
                  first_name: "Jean",
                  last_name: "Tremblay",
                  address_line1: "456 Rue Principale",
                  city: "Montreal",
                  region: "QC",
                  postal_code: "H2Y 1C6",
                  country: "CAN",
                  currency: "CAD",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Tokenization form configuration retrieved successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TokenizeResponse",
              },
            },
          },
        },
        400: {
          description: "Reservation expired",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                error: {
                  message:
                    "Your reservation has expired. Please reserve the listing again.",
                  code: "VALIDATION_ERROR",
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not the buyer",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        404: {
          description: "Order not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/{id}/payment": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Process payment for reserved order",
      description:
        "Processes token-based payment using Finix.js tokenization. Requires payment_token generated from CardTokenForm or BankTokenForm. This step authorizes and captures the payment, then marks the listing as sold.\n\n**[REQUIREMENTS]**\n- **payment_token**: Required. Token from Finix.js CardTokenForm or BankTokenForm\n- **postal_code**: Required for AVS checks\n- **address_line1, city, region**: Required for billing address\n- **idempotency_id**: Required UUID to prevent duplicate charges",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID from reserve step",
          schema: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["payment_token", "postal_code", "idempotency_id"],
              properties: {
                address_line1: {
                  type: "string",
                  description: "Billing address line 1",
                  example: "123 Market St",
                },
                address_line2: {
                  type: "string",
                  description: "Billing address line 2",
                  example: "Apt 200",
                },
                city: {
                  type: "string",
                  description: "Billing city",
                  example: "San Francisco",
                },
                region: {
                  type: "string",
                  description: "State / Region",
                  example: "CA",
                },
                payment_token: {
                  type: "string",
                  description:
                    "Payment token from Finix.js CardTokenForm or BankTokenForm",
                  example: "TKN_abc123xyz789",
                },
                postal_code: {
                  type: "string",
                  description: "Postal code for AVS checks",
                  example: "94114",
                },
                idempotency_id: {
                  type: "string",
                  description: "Idempotency key to prevent duplicate charges",
                  example: "7f1b4c82-9e3a-4e5b-93b0-2ad1c6c47a11",
                },
                fraud_session_id: {
                  type: "string",
                  description:
                    "Finix fraud session ID from finix.Auth.getSessionKey()",
                  example: "fs_a1b2c3d4e5f6789012345678",
                },
              },
            },
            examples: {
              tokenPayment: {
                summary: "Token-based payment",
                value: {
                  payment_token: "TKN_abc123xyz789",
                  postal_code: "94114",
                  address_line1: "123 Market St",
                  city: "San Francisco",
                  region: "CA",
                  idempotency_id: "7f1b4c82-9e3a-4e5b-93b0-2ad1c6c47a11",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Payment processed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "paid" },
                      amount: { type: "number" },
                      currency: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        402: {
          description: "Payment failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PaymentErrorResponse" },
            },
          },
        },
        404: {
          description: "Order not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },

  "/api/v1/marketplace/orders/{id}/refund": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Refund an existing transfer (create reversal)",
      description:
        "Creates a transfer reversal (refund) for a SUCCEEDED transfer associated with the order. **[FINIX CERT]** `idempotency_id` is required to prevent duplicate refunds. Same idempotency_id will return the existing refund instead of creating duplicates.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID",
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["idempotency_id"],
              properties: {
                idempotency_id: {
                  type: "string",
                  description: "Idempotency key for refund transfers",
                },
                refund_amount: {
                  type: "number",
                  description:
                    "Refund amount in cents (optional - full if omitted)",
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Refund created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiResponse" },
            },
          },
        },
      },
    },
  },
  // =============================================================
  // REFUND REQUEST WORKFLOW (Buyer Request → Seller Approval)
  // =============================================================
  "/api/v1/marketplace/orders/{id}/refund-request": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Request refund (Buyer only)",
      description: `Creates a refund request for the order. **BUYER** must initiate the refund request with a reason.

**Refund Workflow:**
1. BUYER requests refund with reason (this endpoint)
2. BUYER returns product and submits tracking (\`/refund-requests/{id}/submit-return\`)
3. SELLER confirms product received (\`/refund-requests/{id}/confirm-return\`)
4. SELLER approves the refund (\`/refund-requests/{id}/approve\`)
5. BUYER receives refund via Finix

**[FINIX CERT]** Requires \`reason\` (min 10 chars) and \`idempotency_id\`.`,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID",
          schema: { type: "string", example: "507f1f77bcf86cd799439012" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reason"],
              properties: {
                reason: {
                  type: "string",
                  minLength: 10,
                  description:
                    "Reason for requesting refund (min 10 characters)",
                  example:
                    "Item was not as described in the listing. Watch has scratches not shown in photos.",
                },
                refund_amount: {
                  type: "number",
                  description:
                    "Partial refund amount in cents (full refund if omitted)",
                  example: 1250000,
                },
                idempotency_id: {
                  type: "string",
                  description: "Idempotency key to prevent duplicate requests",
                  example: "refund-req-abc123",
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Refund request created",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      refund_request_id: {
                        type: "string",
                        example: "674a1234abcd5678ef901234",
                      },
                      order_id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439012",
                      },
                      status: { type: "string", example: "pending" },
                      requested_amount: { type: "number", example: 1250000 },
                      buyer_reason: {
                        type: "string",
                        example: "Item not as described...",
                      },
                      message: {
                        type: "string",
                        example:
                          "Refund request submitted. Please return the product and await seller approval.",
                      },
                      next_steps: {
                        type: "array",
                        items: { type: "string" },
                        example: [
                          "1. Return the product to the seller",
                          "2. Provide tracking number via /submit-return endpoint",
                          "3. Seller will confirm product receipt",
                          "4. Seller will approve the refund",
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Invalid reason or already pending request" },
        401: { description: "Unauthorized - not the buyer" },
        404: { description: "Order not found" },
      },
    },
  },
  "/api/v1/marketplace/refund-requests": {
    get: {
      tags: ["Marketplace - Orders"],
      summary: "List refund requests",
      description:
        "Returns refund requests where the authenticated user is either the buyer or seller.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "status",
          in: "query",
          description: "Filter by status",
          schema: {
            type: "string",
            enum: [
              "pending",
              "return_requested",
              "return_received",
              "approved",
              "executed",
              "denied",
              "cancelled",
            ],
          },
        },
        {
          name: "role",
          in: "query",
          description: "Filter by user role in the transaction",
          schema: { type: "string", enum: ["buyer", "seller"] },
        },
      ],
      responses: {
        200: {
          description: "List of refund requests",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      refund_requests: {
                        type: "array",
                        items: { $ref: "#/components/schemas/RefundRequest" },
                      },
                      count: { type: "number", example: 5 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/refund-requests/{id}": {
    get: {
      tags: ["Marketplace - Orders"],
      summary: "Get refund request details",
      description:
        "Returns details of a specific refund request. Only buyer or seller can view.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Refund Request ID",
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description: "Refund request details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: { $ref: "#/components/schemas/RefundRequest" },
                },
              },
            },
          },
        },
        404: { description: "Refund request not found" },
      },
    },
  },
  "/api/v1/marketplace/refund-requests/{id}/submit-return": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Submit product return tracking (Buyer only)",
      description:
        "After requesting a refund, the BUYER must return the product and provide tracking information.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Refund Request ID",
          schema: { type: "string" },
        },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                tracking_number: {
                  type: "string",
                  description: "Return shipment tracking number",
                  example: "1Z999AA10123456784",
                },
                return_notes: {
                  type: "string",
                  description: "Additional notes about the return",
                  example:
                    "Returning via UPS Ground, expected delivery in 5 days",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Return info submitted",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      refund_request_id: { type: "string" },
                      status: { type: "string", example: "return_requested" },
                      tracking_number: {
                        type: "string",
                        example: "1Z999AA10123456784",
                      },
                      message: {
                        type: "string",
                        example:
                          "Return information submitted. Awaiting seller confirmation of product receipt.",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Return already submitted or invalid status" },
        401: { description: "Unauthorized - not the buyer" },
      },
    },
  },
  "/api/v1/marketplace/refund-requests/{id}/confirm-return": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Confirm product return received (Seller only)",
      description:
        "SELLER confirms they have received the returned product. After confirmation, seller can approve the refund.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Refund Request ID",
          schema: { type: "string" },
        },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                confirmation_notes: {
                  type: "string",
                  description: "Notes about the returned product condition",
                  example: "Product received in original condition",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Return confirmed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      refund_request_id: { type: "string" },
                      status: { type: "string", example: "return_received" },
                      message: {
                        type: "string",
                        example:
                          "Product return confirmed. You can now approve the refund.",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Product not yet returned by buyer" },
        401: { description: "Unauthorized - not the seller" },
      },
    },
  },
  "/api/v1/marketplace/refund-requests/{id}/approve": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Approve refund request (Seller only)",
      description: `SELLER approves the refund request. **Product return must be confirmed first.**

Once approved:
- Refund is executed via Finix (transfer reversal)
- Order status updated to 'refunded' (if full refund)
- Listing becomes available again (if full refund)

**[FINIX CERT]** Creates a transfer reversal with idempotency.`,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Refund Request ID",
          schema: { type: "string" },
        },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                approval_notes: {
                  type: "string",
                  description: "Optional notes for approval",
                  example:
                    "Product returned in original condition, approving full refund",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Refund approved and executed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      refund_request_id: { type: "string" },
                      order_id: { type: "string" },
                      status: { type: "string", example: "executed" },
                      refund_id: { type: "string", example: "RV_abc123xyz" },
                      refund_state: { type: "string", example: "SUCCEEDED" },
                      amount: { type: "number", example: 1250000 },
                      message: {
                        type: "string",
                        example: "Refund approved and executed successfully",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Product not returned/confirmed yet" },
        401: { description: "Unauthorized - not the seller" },
      },
    },
  },
  "/api/v1/marketplace/refund-requests/{id}/deny": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Deny refund request (Seller only)",
      description:
        "SELLER denies the refund request with a reason. Buyer can file a dispute if they disagree.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Refund Request ID",
          schema: { type: "string" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reason"],
              properties: {
                reason: {
                  type: "string",
                  minLength: 10,
                  description: "Reason for denying the refund (min 10 chars)",
                  example:
                    "Item was delivered as described. Photos match the condition received.",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Refund request denied",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      refund_request_id: { type: "string" },
                      order_id: { type: "string" },
                      status: { type: "string", example: "denied" },
                      denial_reason: { type: "string" },
                      message: {
                        type: "string",
                        example: "Refund request denied",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Invalid reason or wrong status" },
        401: { description: "Unauthorized - not the seller" },
      },
    },
  },
  "/api/v1/marketplace/refund-requests/{id}/cancel": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Cancel refund request (Buyer only)",
      description:
        "BUYER cancels their own pending refund request. Only works for pending or return_requested status.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Refund Request ID",
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description: "Refund request cancelled",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "Refund request cancelled successfully",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Cannot cancel - wrong status" },
        401: { description: "Unauthorized - not the buyer" },
      },
    },
  },
  "/api/v1/marketplace/orders/{id}/tracking": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Upload shipping tracking (Seller only)",
      description:
        "Seller uploads tracking information after payment. This marks the order as shipped and notifies the buyer. Requires tracking_number, carrier information is optional.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID",
          schema: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["tracking_number"],
              properties: {
                tracking_number: {
                  type: "string",
                  description: "Shipping tracking number",
                  example: "1Z999AA10123456784",
                },
                carrier: {
                  type: "string",
                  description:
                    "Shipping carrier name (alternative to tracking_carrier for backward compatibility)",
                  example: "UPS",
                  enum: ["UPS", "FedEx", "USPS", "DHL", "Other"],
                },
                tracking_carrier: {
                  type: "string",
                  description: "Shipping carrier name (alternative to carrier)",
                  example: "UPS",
                  enum: ["UPS", "FedEx", "USPS", "DHL", "Other"],
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Tracking uploaded successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "object",
                    properties: {
                      order_id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439012",
                      },
                      status: {
                        type: "string",
                        enum: ["shipped"],
                        example: "shipped",
                      },
                      tracking_number: {
                        type: "string",
                        example: "1Z999AA10123456784",
                      },
                      tracking_carrier: {
                        type: "string",
                        nullable: true,
                        example: "UPS",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description:
            "Bad request - order must be paid before shipping or missing fields",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not the seller",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        404: {
          description: "Order not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/{id}/confirm-delivery": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Confirm delivery (Buyer only)",
      description:
        "Buyer confirms they received the watch in good condition. This triggers fund release to the seller and completes the order.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID",
          schema: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
          },
        },
      ],
      responses: {
        200: {
          description: "Delivery confirmed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "object",
                    properties: {
                      order_id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439012",
                      },
                      status: {
                        type: "string",
                        enum: ["completed"],
                        example: "completed",
                      },
                      message: {
                        type: "string",
                        example:
                          "Delivery confirmed. Funds will be released to the seller.",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Bad request - order must be shipped first",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not the buyer",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        404: {
          description: "Order not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/{id}/cancel": {
    post: {
      tags: ["Marketplace - Orders"],
      summary: "Cancel order (Buyer only, before payment)",
      description:
        "Buyer cancels a reserved order before payment. This releases the listing reservation and allows other buyers to purchase.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID",
          schema: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
          },
        },
      ],
      responses: {
        200: {
          description: "Order cancelled successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "object",
                    properties: {
                      order_id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439012",
                      },
                      status: {
                        type: "string",
                        enum: ["cancelled"],
                        example: "cancelled",
                      },
                      message: {
                        type: "string",
                        example: "Order cancelled successfully",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Bad request - cannot cancel after payment",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                error: {
                  message: "Cannot cancel order after payment",
                  code: "VALIDATION_ERROR",
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not the buyer",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        404: {
          description: "Order not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/{id}": {
    get: {
      tags: ["Marketplace - Orders"],
      summary: "Get order details",
      description:
        "Get detailed information about a specific order. Only the buyer or seller can access the order details.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Order ID",
          schema: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
          },
        },
      ],
      responses: {
        200: {
          description: "Order details retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "object",
                    properties: {
                      _id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439012",
                      },
                      listing_id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439011",
                      },
                      buyer_id: {
                        type: "object",
                        properties: {
                          _id: { type: "string" },
                          first_name: { type: "string" },
                          last_name: { type: "string" },
                          email: { type: "string" },
                        },
                      },
                      seller_id: {
                        type: "object",
                        properties: {
                          _id: { type: "string" },
                          first_name: { type: "string" },
                          last_name: { type: "string" },
                          email: { type: "string" },
                        },
                      },
                      listing_snapshot: {
                        type: "object",
                        properties: {
                          brand: { type: "string", example: "Rolex" },
                          model: { type: "string", example: "Submariner" },
                          reference: {
                            type: "string",
                            example: "116610LN",
                          },
                          condition: { type: "string", example: "like-new" },
                          price: { type: "number", example: 12500 },
                          images: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                      },
                      amount: {
                        type: "number",
                        example: 12500,
                      },
                      currency: {
                        type: "string",
                        example: "USD",
                      },
                      status: {
                        type: "string",
                        enum: [
                          "reserved",
                          "pending",
                          "authorized",
                          "paid",
                          "shipped",
                          "completed",
                          "cancelled",
                          "expired",
                        ],
                        example: "paid",
                      },
                      reserved_at: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                      },
                      reservation_expires_at: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                      },
                      paid_at: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                      },
                      shipped_at: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                      },
                      tracking_number: {
                        type: "string",
                        nullable: true,
                        example: "1Z999AA10123456784",
                      },
                      tracking_carrier: {
                        type: "string",
                        nullable: true,
                        example: "UPS",
                      },
                      completed_at: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                      },
                      createdAt: {
                        type: "string",
                        format: "date-time",
                      },
                      updatedAt: {
                        type: "string",
                        format: "date-time",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not the buyer or seller",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        404: {
          description: "Order not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/buyer/list": {
    get: {
      tags: ["Marketplace - Orders"],
      summary: "Get buyer's orders",
      description:
        "Get all orders where the authenticated user is the buyer. Orders are sorted by creation date (newest first).",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Buyer orders retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        _id: {
                          type: "string",
                          example: "507f1f77bcf86cd799439012",
                        },
                        listing_id: {
                          type: "string",
                          example: "507f1f77bcf86cd799439011",
                        },
                        seller_id: {
                          type: "object",
                          properties: {
                            _id: { type: "string" },
                            first_name: { type: "string", example: "John" },
                            last_name: { type: "string", example: "Doe" },
                          },
                        },
                        listing_snapshot: {
                          type: "object",
                          properties: {
                            brand: { type: "string", example: "Rolex" },
                            model: {
                              type: "string",
                              example: "Submariner",
                            },
                            price: { type: "number", example: 12500 },
                            images: {
                              type: "array",
                              items: { type: "string" },
                            },
                          },
                        },
                        amount: { type: "number", example: 12500 },
                        status: { type: "string", example: "paid" },
                        reserved_at: {
                          type: "string",
                          format: "date-time",
                        },
                        paid_at: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        shipped_at: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        tracking_number: {
                          type: "string",
                          nullable: true,
                        },
                        tracking_carrier: {
                          type: "string",
                          nullable: true,
                        },
                        createdAt: {
                          type: "string",
                          format: "date-time",
                        },
                        updatedAt: {
                          type: "string",
                          format: "date-time",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not authenticated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/orders/seller/list": {
    get: {
      tags: ["Marketplace - Orders"],
      summary: "Get seller's orders",
      description:
        "Get all orders where the authenticated user is the seller. Orders are sorted by creation date (newest first).",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Seller orders retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true,
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        _id: {
                          type: "string",
                          example: "507f1f77bcf86cd799439012",
                        },
                        listing_id: {
                          type: "string",
                          example: "507f1f77bcf86cd799439011",
                        },
                        buyer_id: {
                          type: "object",
                          properties: {
                            _id: { type: "string" },
                            first_name: { type: "string", example: "Jane" },
                            last_name: { type: "string", example: "Smith" },
                          },
                        },
                        listing_snapshot: {
                          type: "object",
                          properties: {
                            brand: { type: "string", example: "Rolex" },
                            model: {
                              type: "string",
                              example: "Submariner",
                            },
                            price: { type: "number", example: 12500 },
                            images: {
                              type: "array",
                              items: { type: "string" },
                            },
                          },
                        },
                        amount: { type: "number", example: 12500 },
                        status: { type: "string", example: "paid" },
                        reserved_at: {
                          type: "string",
                          format: "date-time",
                        },
                        paid_at: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        shipped_at: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        tracking_number: {
                          type: "string",
                          nullable: true,
                        },
                        tracking_carrier: {
                          type: "string",
                          nullable: true,
                        },
                        createdAt: {
                          type: "string",
                          format: "date-time",
                        },
                        updatedAt: {
                          type: "string",
                          format: "date-time",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized - not authenticated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },

  "/api/v1/networks/user/feeds/token": {
    get: {
      tags: ["Feeds"],
      summary: "Get Stream Feeds authentication token",
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: "Token generated" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/feeds/timeline": {
    get: {
      tags: ["Feeds"],
      summary: "Get timeline feed",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Timeline retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/feeds/user/{id}": {
    get: {
      tags: ["Feeds"],
      summary: "Get user's activity feed",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "User feed retrieved" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/user/feeds/following": {
    get: {
      tags: ["Feeds"],
      summary: "Get following list",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Following list retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/feeds/followers": {
    get: {
      tags: ["Feeds"],
      summary: "Get followers list",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Followers list retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/users/{id}/connections": {
    post: {
      tags: ["Networks - Connections"],
      summary: "Send a connection request to another user",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        201: { description: "Connection request sent or established" },
        400: { description: "Already connected, blocked, or invalid target" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
    delete: {
      tags: ["Networks - Connections"],
      summary: "Remove an outgoing connection or pending request",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: { description: "Connection removed" },
        401: { description: "Unauthorized" },
        404: { description: "No outgoing connection found" },
      },
    },
  },
  "/api/v1/networks/users/{id}/connections/incoming": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Get another user's incoming accepted connections",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Incoming connections retrieved" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/users/{id}/connections/outgoing": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Get another user's outgoing accepted connections",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Outgoing connections retrieved" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/users/{id}/connection-status": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Check directional connection status with another user",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: { description: "Connection status retrieved" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/user/connections/incoming": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Get current user's incoming accepted connections",
      description:
        "Returns accepted incoming connections for the authenticated networks user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Incoming connections retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/connections/outgoing": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Get current user's outgoing accepted connections",
      description:
        "Returns accepted outgoing connections for the authenticated networks user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Outgoing connections retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/connections/requests": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Get current user's pending incoming connection requests",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 20 },
        },
        {
          in: "query",
          name: "offset",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Pending requests retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/connections/{id}": {
    post: {
      tags: ["Networks - Connections"],
      summary: "Send a connection request from the current user",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        201: { description: "Connection request sent or established" },
        400: { description: "Already connected, blocked, or invalid target" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
    delete: {
      tags: ["Networks - Connections"],
      summary:
        "Remove an outgoing connection or pending request from the current user",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: { description: "Connection removed" },
        401: { description: "Unauthorized" },
        404: { description: "No outgoing connection found" },
      },
    },
  },
  "/api/v1/networks/user/connections/requests/{id}/accept": {
    post: {
      tags: ["Networks - Connections"],
      summary: "Accept a pending incoming connection request",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: { description: "Connection request accepted" },
        400: { description: "Request cannot be accepted" },
        401: { description: "Unauthorized" },
        404: { description: "Connection request not found" },
      },
    },
  },
  "/api/v1/networks/user/connections/requests/{id}/reject": {
    post: {
      tags: ["Networks - Connections"],
      summary: "Reject a pending incoming connection request",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "path", name: "id", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: { description: "Connection request rejected" },
        400: { description: "Request cannot be rejected" },
        401: { description: "Unauthorized" },
        404: { description: "Connection request not found" },
      },
    },
  },
  "/api/v1/marketplace/messages/send": {
    post: {
      tags: ["Marketplace - Messages"],
      summary: "Send a message through backend",
      description:
        "Sends a message to a channel, stores it in MongoDB and delivers via GetStream simultaneously.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SendMessageRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Message sent",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatMessage" },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/messages/channel/{channelId}": {
    get: {
      tags: ["Marketplace - Messages"],
      summary: "Get messages for a channel",
      description: "Retrieves message history from backend database",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "channelId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50 },
        },
        { name: "before", in: "query", schema: { type: "string" } },
      ],
      responses: {
        200: { description: "Messages retrieved" },
      },
    },
  },

  "/api/v1/marketplace/channels": {
    get: {
      tags: ["Marketplace - Channels"],
      summary: "Get marketplace channels for current user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "role",
          in: "query",
          schema: { type: "string", enum: ["buyer", "seller"] },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "List of marketplace channels",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/MarketplaceChannel" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/marketplace/channels/{channelId}/messages": {
    get: {
      tags: ["Marketplace - Messages"],
      summary: "Get messages for a marketplace channel",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "channelId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "GetStream Channel ID",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50 },
        },
        {
          name: "before",
          in: "query",
          schema: { type: "string" },
          description: "Message ID for pagination",
        },
      ],
      responses: {
        200: {
          description: "List of messages",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ChatMessage" },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Marketplace - Messages"],
      summary: "Send a message in a marketplace channel",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "channelId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SendMessageRequest" },
          },
        },
      },
      responses: { 201: { description: "Message sent" } },
    },
  },

  // ==========================================================================
  // REVIEWS API
  // ==========================================================================
  "/api/v1/reviews": {
    post: {
      tags: ["Reviews"],
      summary: "Create a review for a completed order",
      description:
        "Submit a review/rating for an order after it has been delivered. Both buyer and seller can submit reviews.",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["order_id", "rating"],
              properties: {
                order_id: {
                  type: "string",
                  description: "MongoDB ObjectId of the completed order",
                },
                rating: {
                  type: "integer",
                  minimum: 1,
                  maximum: 5,
                  description: "Rating from 1-5 stars",
                },
                feedback: {
                  type: "string",
                  maxLength: 1000,
                  description: "Optional written feedback",
                },
                is_anonymous: {
                  type: "boolean",
                  default: false,
                  description: "Hide reviewer identity",
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Review created successfully" },
        400: { description: "Invalid request or duplicate review" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/reviews/users/{user_id}": {
    get: {
      tags: ["Reviews"],
      summary: "Get reviews for a user",
      security: [],
      description:
        "Retrieve paginated reviews for a specific user, optionally filtered by role (buyer/seller).",
      parameters: [
        {
          name: "user_id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "role",
          in: "query",
          schema: { type: "string", enum: ["buyer", "seller"] },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "List of reviews with pagination" },
      },
    },
  },
  "/api/v1/reviews/users/{user_id}/summary": {
    get: {
      tags: ["Reviews"],
      summary: "Get rating summary for a user",
      security: [],
      description:
        "Returns aggregated rating statistics including average, count, and breakdown by star rating.",
      parameters: [
        {
          name: "user_id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description:
            "Rating summary with avg_rating, rating_count, breakdown",
        },
      },
    },
  },
  "/api/v1/reviews/me": {
    get: {
      tags: ["Reviews"],
      summary: "Get reviews written by current user",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: {
          description: "List of reviews written by the authenticated user",
        },
      },
    },
  },

  // ==========================================================================
  // USER PROFILE API
  // ==========================================================================

  // ==========================================================================
  // WISHLIST API
  // ==========================================================================

  // ==========================================================================
  // SUPPORT TICKETS API
  // ==========================================================================

  // --- Auto-Appended Networks Routes ---
  "/api/v1/networks/reference-checks": {
    get: {
      tags: ["Networks - Reference Checks"],
      summary: "Get reference checks",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      responses: { 200: { description: "Success" } },
    },
    post: {
      tags: ["Networks - Reference Checks"],
      summary: "Request a reference check",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      requestBody: {
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/reference-checks/{id}": {
    get: {
      tags: ["Networks - Reference Checks"],
      summary: "Get specific reference check",
      description:
        "Returns check details including timeRemaining, vouch_weight, and transaction_value",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
    delete: {
      tags: ["Networks - Reference Checks"],
      summary: "Delete reference check",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/reference-checks/{id}/respond": {
    post: {
      tags: ["Networks - Reference Checks"],
      summary: "Respond to reference check",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/reference-checks/{id}/complete": {
    post: {
      tags: ["Networks - Reference Checks"],
      summary: "Complete reference check",
      description: "Requires dual-confirmation from both buyer and seller",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/reference-checks/{id}/suspend": {
    post: {
      tags: ["Networks - Reference Checks"],
      summary: "Suspend reference check",
      description: "Admin/Moderator only",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/reference-checks/{id}/vouch": {
    post: {
      tags: ["Networks - Reference Checks"],
      summary: "Vouch for a transaction",
      description:
        "Requires legal_consent_accepted: true. Increases trust weight.",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/reference-checks/{id}/vouches": {
    get: {
      tags: ["Networks - Reference Checks"],
      summary: "Get vouches for reference check",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/offers/{id}": {
    get: {
      tags: ["Networks - Offers"],
      summary: "Get specific offer",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/offers/{id}/accept": {
    post: {
      tags: ["Networks - Offers"],
      summary: "Accept an offer",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/offers/{id}/reject": {
    post: {
      tags: ["Networks - Offers"],
      summary: "Reject an offer",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: { 200: { description: "Success" } },
    },
  },
  "/api/v1/networks/offers/{id}/counter": {
    post: {
      tags: ["Networks - Offers"],
      summary: "Counter an offer",
      description: "Sets 24h binding expiry and returns price_delta",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        200: { description: "Success - returns channel with price_delta" },
      },
    },
  },

  // =========================================================================
  // NETWORKS - SOCIAL (GROUPS + INVITES)
  // =========================================================================
  "/api/v1/networks/social/groups/{id}": {
    get: {
      tags: ["Networks - Social Hub | Groups"],
      summary: "Get group details",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Group ID",
        },
      ],
      responses: {
        200: { description: "Group details retrieved" },
        404: { description: "Group not found" },
      },
    },
  },
  "/api/v1/networks/social/groups/{group_id}/join": {
    post: {
      tags: ["Networks - Social Hub | Groups"],
      summary: "Join a group",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        {
          name: "group_id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Group ID",
        },
      ],
      responses: {
        200: { description: "Joined group successfully" },
        400: { description: "Already a member" },
        404: { description: "Group not found" },
      },
    },
  },
  "/api/v1/networks/social/groups/{group_id}/leave": {
    delete: {
      tags: ["Networks - Social Hub | Groups"],
      summary: "Leave a group",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        {
          name: "group_id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Group ID",
        },
      ],
      responses: {
        200: { description: "Left group successfully" },
        400: { description: "Not a member" },
        404: { description: "Group not found" },
      },
    },
  },
  "/api/v1/networks/social/groups/{id}/members/{userId}/role": {
    patch: {
      tags: ["Networks - Social Hub | Groups"],
      summary: "Update member role in group",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Group ID",
        },
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["role"],
              properties: {
                role: { type: "string", enum: ["admin", "member"] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Role updated" },
        403: { description: "Forbidden" },
        404: { description: "Not found" },
      },
    },
  },
  "/api/v1/networks/social/invites": {
    post: {
      tags: ["Networks - Social Hub | Invites"],
      summary: "Create a social invite link",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                group_id: { type: "string" },
                expires_in: { type: "integer" },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Invite link created" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/social/invites/{token}": {
    get: {
      tags: ["Networks - Social Hub | Invites"],
      summary: "Validate / get invite token details",
      security: [{ bearerAuth: [] }, { mockUser: [] }],
      parameters: [
        {
          name: "token",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Invite token",
        },
      ],
      responses: {
        200: { description: "Invite details retrieved" },
        404: { description: "Invite not found or expired" },
      },
    },
  },

  // =========================================================================
  // NETWORKS - USER PROFILE & ACTIONS
  // =========================================================================
  "/api/v1/networks/user/dashboard/stats": {
    get: {
      tags: ["Networks - Dashboard"],
      summary: "Get dashboard statistics",
      description:
        "Returns key statistics for the current user's Networks dashboard",
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: "Stats retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/profile": {
    get: {
      tags: ["Networks - User"],
      summary: "Get consolidated current-user profile payload",
      description:
        "Returns profile identity, verification, onboarding progress, and activity stats in one response for Networks Home/Profile screens.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: "Consolidated profile payload retrieved" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/user/{id}/profile": {
    get: {
      tags: ["Networks - User"],
      summary: "Get public profile of a Networks user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
      ],
      responses: {
        200: { description: "Public profile retrieved" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/user/{id}/listings": {
    get: {
      tags: ["Networks - User"],
      summary: "Get public listings of a Networks user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "User listings retrieved" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/user/block": {
    post: {
      tags: ["Networks - User"],
      summary: "Block a user",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["blocked_id"],
              properties: { blocked_id: { type: "string" } },
            },
          },
        },
      },
      responses: {
        200: { description: "User blocked" },
        400: { description: "Already blocked" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/blocks": {
    get: {
      tags: ["Networks - User"],
      summary: "Get blocked users list",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Blocked users retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/blocks/{blocked_id}": {
    delete: {
      tags: ["Networks - User"],
      summary: "Unblock a user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "blocked_id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Blocked user ID",
        },
      ],
      responses: {
        200: { description: "User unblocked" },
        401: { description: "Unauthorized" },
        404: { description: "Block not found" },
      },
    },
  },
  "/api/v1/networks/user/report": {
    post: {
      tags: ["Networks - User"],
      summary: "Report a user",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reported_id", "reason"],
              properties: {
                reported_id: { type: "string" },
                reason: { type: "string" },
                details: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Report submitted" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/user/{id}/common-groups": {
    get: {
      tags: ["Networks - User"],
      summary: "Get groups in common with a user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
      ],
      responses: {
        200: { description: "Common groups retrieved" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/user/{id}/references": {
    get: {
      tags: ["Networks - User"],
      summary: "Get references for a user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "References retrieved" },
        404: { description: "User not found" },
      },
    },
  },

  // =========================================================================
  // NETWORKS - CONNECTIONS
  // =========================================================================
  "/api/v1/networks/connections": {
    get: {
      tags: ["Networks - Connections"],
      summary: "Get current user's outgoing connections",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50 },
        },
      ],
      responses: {
        200: { description: "Outgoing connections retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/networks/connections/request": {
    post: {
      tags: ["Networks - Connections"],
      summary: "Send a connection request",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["target_user_id"],
              properties: {
                target_user_id: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Connection request sent" },
        400: { description: "Already connected, blocked, or request pending" },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
      },
    },
  },
  "/api/v1/networks/connections/{id}/respond": {
    patch: {
      tags: ["Networks - Connections"],
      summary: "Respond to a connection request",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Connection request ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: { type: "string", enum: ["accepted", "declined"] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Connection request responded to" },
        400: { description: "Request cannot be processed" },
        401: { description: "Unauthorized" },
        404: { description: "Request not found" },
      },
    },
  },

  // =========================================================================
  // DEPRECATED ENDPOINTS REMOVED
  // User auth, profile, subscription, and token endpoints moved to
  // platform-specific routes: /api/v1/networks/* and /api/v1/marketplace/*
  // =========================================================================

  // =========================================================================
  // MARKETPLACE - USER INVENTORY & OFFERS
  // =========================================================================
  "/api/v1/marketplace/user/listings": {
    get: {
      tags: ["Marketplace - User"],
      summary: "Get current user's marketplace listings",
      description:
        "Returns the inventory of listings for the authenticated marketplace user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { type: "string" },
          description: "Filter by listing status",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Listings retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/api/v1/marketplace/user/offers": {
    get: {
      tags: ["Marketplace - User"],
      summary: "Get current user's marketplace offers",
      description:
        "Returns all offers sent or received by the authenticated marketplace user",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "type",
          in: "query",
          schema: { type: "string", enum: ["sent", "received"] },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
        },
      ],
      responses: {
        200: { description: "Offers retrieved" },
        401: { description: "Unauthorized" },
      },
    },
  },
};
