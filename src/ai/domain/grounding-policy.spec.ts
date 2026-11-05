import { redactUngroundedUrls } from './grounding-policy';

describe('redactUngroundedUrls', () => {
  it('removes URLs the backend did not ground', () => {
    expect(redactUngroundedUrls('Pay here: https://evil.example/pay now.', [])).toBe('Pay here: [link removed] now.');
  });

  it('keeps URLs that come from a usable checkout action, including trailing punctuation', () => {
    expect(redactUngroundedUrls('Enroll at https://checkout.example/a.', ['https://checkout.example/a'])).toBe(
      'Enroll at https://checkout.example/a.',
    );
  });
});
