import { CHECKOUT_URL } from '../database/seed/vsa-annual-ballet.data';
import { checkoutRow, seededPriceConflict } from '../testing/fixtures';
import { toCheckoutActionDto } from './checkout.service';

const offer = { label: 'Annual package', amountMinor: 49900, currency: 'USD' };

describe('toCheckoutActionDto (seeded VSA checkout)', () => {
  const dto = toCheckoutActionDto(checkoutRow(), offer, [seededPriceConflict()]);

  it('G: exposes the conflict state without presenting a valid transaction', () => {
    expect(dto).toMatchObject({
      type: 'EXTERNAL_CHECKOUT',
      provider: 'STRIPE',
      status: 'ACTIVE',
      urlCaptured: true,
      url: null,
      urlWithheld: true,
      usable: false,
      blockingIssues: [{ code: 'PRICE_CONFLICT' }],
      verification: { sourceType: 'MANUAL_CHECKOUT_VERIFICATION', verificationStatus: 'CONFLICTING', verifiedAt: '2026-10-03T00:00:00.000Z' },
      offer: { label: 'Annual package', amountMinor: 49900, currency: 'USD', display: '$499.00' },
      observedTerms: {
        merchant: 'VSA',
        productLabel: '1-Year Ballet Club (weekly classes)',
        amountMinor: 17900,
        currency: 'USD',
        display: '$179.00',
        billing: 'ANNUAL',
        observedAt: '2026-10-03',
        isAuthoritativeOffer: false,
      },
    });
    expect(dto.observedTerms?.termsText).toContain('Non-Refundable Payment Terms.');
  });

  it('E: the raw blocked URL appears nowhere in the response', () => {
    const json = JSON.stringify(dto);
    expect(json).not.toContain(CHECKOUT_URL);
    expect(json).not.toContain('buy.stripe.com');
  });

  it('H: the same row becomes usable (with URL) only after the conflict is resolved in data', () => {
    const resolved = toCheckoutActionDto(checkoutRow({ verificationStatus: 'CONFIRMED' }), offer, []);
    expect(resolved).toMatchObject({ usable: true, url: CHECKOUT_URL, urlWithheld: false, blockingIssues: [] });
  });

  it('a not-captured checkout reports URL_NOT_CAPTURED and no URL', () => {
    const notCaptured = toCheckoutActionDto(checkoutRow({ externalUrl: null, status: 'NOT_CAPTURED', verificationStatus: 'UNKNOWN', observedAt: null }), offer, []);
    expect(notCaptured).toMatchObject({ urlCaptured: false, url: null, urlWithheld: false, usable: false, observedTerms: null });
    expect(notCaptured.blockingIssues.map((b) => b.code)).toEqual(['URL_NOT_CAPTURED']);
  });
});
