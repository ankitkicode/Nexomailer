import { describe, it, expect } from 'vitest';
import { TrackingModule } from '../src/tracking.js';

describe('TrackingModule', () => {
  it('should initialize successfully', () => {
    const tracking = new TrackingModule({ enabled: true, baseUrl: 'http://test', opens: true, clicks: true });
    expect(tracking).toBeDefined();
  });
  
  it('should instrument html correctly', () => {
    const tracking = new TrackingModule({ enabled: true, baseUrl: 'http://test', opens: true, clicks: true });
    const result = tracking.instrument('msg-1', '<html><body><a href="http://google.com">Link</a></body></html>');
    expect(result).toContain('http://test/track/open');
    expect(result).toContain('http://test/track/click');
  });
});
