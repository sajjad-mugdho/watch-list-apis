import { test, expect } from '@playwright/test';

test.describe('API Health Smoke Test', () => {
  test('should return 200 for health check', async ({ request }) => {
    const response = await request.get('health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('should return status message for root', async ({ request }) => {
    const response = await request.get('');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toContain('API is running');
  });
});
