
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { swaggerSpec } from '../src/config/swagger';

const BASE_URL = 'http://localhost:5050';
// Use process.cwd() instead of __dirname if __dirname is causing issues with ts-node
const OUTPUT_FILE = path.join(process.cwd(), 'docs/API_TEST_REPORT.md');

// Mock User for Auth
const MOCK_USER_HEADER = { 'x-test-user': 'buyer_us_complete' };

interface TestResult {
  path: string;
  method: string;
  status: number;
  data: any;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];

async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Server is running.');
    return true;
  } catch (error) {
    console.error('❌ Server is NOT running. Please run `npm run dev` in a separate terminal.');
    return false;
  }
}

function replaceParams(route: string): string {
    // Replace parameters with dummy values that are likely to cause 404s but valid format
    // This allows us to reach the controller logic (and validation layers)
    return route
        .replace('{id}', '60d5ecb8b487343568912345') // Dummy Mongo ObjectId
        .replace('{channelId}', '60d5ecb8b487343568912345')
        .replace('{listingId}', '60d5ecb8b487343568912345')
        .replace('{userId}', '60d5ecb8b487343568912345');
}

async function runAudit() {
  if (!await checkServer()) process.exit(1);

  console.log('🚀 Starting API Audit...');
  
  const paths = (swaggerSpec as any).paths;
  if (!paths) {
      console.error("❌ Could not find paths in swaggerSpec");
      process.exit(1);
  }

  for (const routePath in paths) {
    const methods = paths[routePath];
    for (const method in methods) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            const fullPath = BASE_URL + replaceParams(routePath);
            const isWrite = ['post', 'put', 'patch'].includes(method);
            
            console.log(`Testing ${method.toUpperCase()} ${fullPath}...`);
            
            try {
                const response = await axios({
                    method,
                    url: fullPath,
                    headers: MOCK_USER_HEADER,
                    data: isWrite ? {} : undefined, // Send empty body to trigger validation errors
                    validateStatus: () => true // Don't throw on error status
                });

                let passed = false;
                let notes = '';

                if (isWrite) {
                    // For Write operations with empty body:
                    // - Expect 400 (Bad Request) if Zod caught it.
                    // - Expect 200/201 if it worked (meaning no validation needed?).
                    // - Expect 500 if it crashed (Validation Gap).
                    if (response.status === 400) {
                        passed = true;
                        notes = '✅ Validation caught empty body.';
                    } else if (response.status === 500) {
                        passed = false;
                        notes = '❌ server error (500). Possible missing validation.';
                    } else if (response.status >= 200 && response.status < 300) {
                         // Should not happen for empty body unless optional
                         notes = '⚠️ Success with empty body. Check if this is intended.';
                         passed = true; 
                    } else {
                        notes = `Received status ${response.status}.`;
                        passed = true; // 404s etc are fine for dummy IDs
                    }
                } else {
                    // Read operations
                    if (response.status === 500) {
                        passed = false;
                        notes = '❌ Server Error (500).';
                    } else {
                        passed = true;
                        notes = `Status ${response.status}`;
                    }
                }

                results.push({
                    path: routePath,
                    method: method.toUpperCase(),
                    status: response.status,
                    data: response.data,
                    passed,
                    notes
                });

            } catch (error: any) {
                 results.push({
                    path: routePath,
                    method: method.toUpperCase(),
                    status: 0,
                    data: error.message,
                    passed: false,
                    notes: '❌ Request Failed (Network/Client Error)'
                });
            }
        }
    }
  }

  generateReport();
}

function generateReport() {
    let md = '# API Audit & Validation Report\n\n';
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Total Endpoints:** ${results.length}\n`;
    md += `**Passed:** ${results.filter(r => r.passed).length}\n`;
    md += `**Failed:** ${results.filter(r => !r.passed).length}\n\n`; // "Fail" here means 500 or network error
    
    md += '| Method | Path | Status | Result | Notes |\n';
    md += '|--------|------|--------|--------|-------|\n';

    results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        md += `| ${r.method} | \`${r.path}\` | ${r.status} | ${icon} | ${r.notes} |\n`;
    });

    md += '\n## potential Gaps (500 Errors or Unprotected Writes)\n';
    const gaps = results.filter(r => r.status === 500 || (!r.passed));
    if (gaps.length === 0) {
        md += 'No obvious gaps found.\n';
    } else {
        gaps.forEach(r => {
             md += `- **${r.method} ${r.path}**: ${r.notes}\n`;
        });
    }

    fs.writeFileSync(OUTPUT_FILE, md);
    console.log(`\nReport written to ${OUTPUT_FILE}`);
}

runAudit();
