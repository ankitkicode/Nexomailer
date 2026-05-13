import { describe, it, expect } from 'vitest';
import { AnalyticsModule } from '../src/analytics.js';

describe('AnalyticsModule', () => {
  it('should initialize successfully', () => {
    const analytics = new AnalyticsModule();
    expect(analytics).toBeDefined();
  });
  
  it('should record events and return summary', async () => {
    const analytics = new AnalyticsModule();
    await analytics.record({ id: '1', messageId: 'm1', type: 'email.sent', timestamp: new Date() });
    
    const summary = await analytics.getSummary({ from: new Date(0), to: new Date() });
    expect(summary.sent).toBe(1);
    expect(summary.deliveryRate).toBe(0); // Since delivered is 0
  });
});
