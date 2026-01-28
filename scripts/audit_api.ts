
import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.APP_URL || "http://localhost:5050";
const TEST_USER_BUYER = "buyer_us_complete";

console.log(`Starting API Audit against ${BASE_URL}`);

interface AuditResult {
  method: string;
  path: string;
  status: number | "ERROR";
  success: boolean;
  durationMs: number;
  error?: string;
}

class ApiAuditRunner {
  private client: AxiosInstance;
  private results: AuditResult[] = [];
  
  // State for chained requests
  private state: Record<string, any> = {};

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        "Content-Type": "application/json",
        "x-test-user": TEST_USER_BUYER,
      },
      validateStatus: () => true, // Don't throw on status codes
    });
  }

  async runAudit() {
    try {
      console.log("\n📦 1. SYSTEM & PUBLIC");
      await this.check("GET", "/api/health");
      await this.check("GET", "/api/v1/watches");
      
      console.log("\n👤 2. USER PROFILE");
      await this.check("GET", "/api/v1/user");
      await this.check("GET", "/api/v1/me");
      await this.check("GET", "/api/v1/onboarding/status");
      await this.check("GET", "/api/v1/user/tokens/chat");
      await this.check("GET", "/api/v1/user/tokens/feed");

      console.log("\n🛍️ 3. MARKETPLACE - LISTINGS");
      const listingsRes = await this.check("GET", "/api/v1/marketplace/listings");
      if (listingsRes.data?.data?.length > 0) {
        const listingId = listingsRes.data.data[0]._id;
        this.state.listingId = listingId;
        console.log(`   ℹ️ Using Listing ID: ${listingId}`);
        await this.check("GET", `/api/v1/marketplace/listings/${listingId}`);
      } else {
        console.log("   ⚠️ No listings found, skipping detail checks");
      }

      console.log("\n🛒 4. MARKETPLACE - ORDERS");
      await this.check("GET", "/api/v1/marketplace/orders/buyer/list");
      await this.check("GET", "/api/v1/marketplace/orders/seller/list");

      console.log("\n❤️ 5. FAVORITES");
      await this.check("GET", "/api/v1/user/favorites?platform=marketplace");
      if (this.state.listingId) {
        // Toggle favorite (add/remove) - uses POST with body
        await this.check("POST", "/api/v1/user/favorites", {
          item_type: "for_sale",
          item_id: this.state.listingId,
          platform: "marketplace"
        });
      }

      console.log("\n🔍 6. ISOs");
      await this.check("GET", "/api/v1/isos", undefined, { headers: { "x-platform": "networks" } }); // ISOs are networks only
      await this.check("GET", "/api/v1/user/isos", undefined, { headers: { "x-platform": "networks" } }); // moved to user/isos

      console.log("\n🔔 7. NOTIFICATIONS");
      await this.check("GET", "/api/v1/user/notifications");
      await this.check("GET", "/api/v1/user/notifications/unread-count");

      console.log("\n📱 8. FEEDS & SOCIAL");
      await this.check("GET", "/api/v1/feeds/timeline");
      const userRes = await this.check("GET", "/api/v1/user");
      if (userRes.data?.data?._id) {
        const myId = userRes.data.data._id;
        // Check my own followers/following (empty usually)
        await this.check("GET", `/api/v1/users/${myId}/followers`);
        await this.check("GET", `/api/v1/users/${myId}/following`);
      }

      console.log("\n🌐 9. NETWORKS");
      await this.check("GET", "/api/v1/networks/channels", undefined, { headers: { "x-platform": "networks", "x-test-user": TEST_USER_BUYER } });
      await this.check("GET", "/api/v1/networks/offers", undefined, { headers: { "x-platform": "networks", "x-test-user": TEST_USER_BUYER } });

      console.log("\n📲 10. DEVICE TOKENS");
      await this.check("POST", "/api/v1/user/tokens/push", {
        token: "audit_test_token_" + Date.now(),
        platform: "web"
      });

      this.printReport();

    } catch (err) {
      console.error("Critical Audit Failure:", err);
    }
  }

  private async check(method: string, path: string, data?: any, config: any = {}) {
    const start = Date.now();
    try {
        // Log equivalent cURL command
        const headers = { ...this.client.defaults.headers, ...config.headers };
        const headerStr = Object.entries(headers)
            .map(([k, v]) => `-H "${k}: ${v}"`)
            .join(" ");
        const dataStr = data ? `-d '${JSON.stringify(data)}'` : "";
        console.log(`   > curl -X ${method} ${BASE_URL}${path} ${headerStr} ${dataStr}`);

      const res = await this.client.request({
        method,
        url: path,
        data,
        ...config
      });
      
      const duration = Date.now() - start;
      const success = res.status >= 200 && res.status < 300;
      
      this.results.push({
        method,
        path,
        status: res.status,
        success,
        durationMs: duration
      });

      const icon = success ? "✅" : "❌";
      console.log(`   ${icon} ${res.status} (${duration}ms)`);
      
      return res;
    } catch (err: any) {
      const duration = Date.now() - start;
      const status = err.response?.status || "ERROR";
      const errorMsg = err.message;
      
      this.results.push({
        method,
        path,
        status,
        success: false,
        durationMs: duration,
        error: errorMsg
      });
      
      console.log(`   ❌ ${status} (${duration}ms) - ${errorMsg}`);
      return { data: null, status };
    }
  }

  private printReport() {
    console.log("\n\n===========================================");
    console.log("             API AUDIT REPORT              ");
    console.log("===========================================");
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`Total Endpoints: ${total}`);
    console.log(`Passed:          ${passed}`);
    console.log(`Failed:          ${failed}`);
    console.log("===========================================");
    
    if (failed > 0) {
      console.log("\nFailed Endpoints:");
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`- [${r.method}] ${r.path} -> ${r.status} (${r.error || 'Unknown'})`);
      });
    } else {
      console.log("\n🎉 ALL TESTS PASSED!");
    }
  }
}

// Run
new ApiAuditRunner().runAudit();
