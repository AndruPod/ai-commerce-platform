# Checkout evidence: VSA Stripe checkout (captured 2026-10-03)

This is submission and evaluation evidence only. **No runtime code reads this folder or the screenshot.**
The observation is encoded as data in `src/database/seed/vsa-annual-ballet.data.ts` (`checkout`, and
the `checkout.price` data-quality issue).

## Capture

| | |
|---|---|
| Captured | 2026-10-03, manually opened in a browser |
| Provider | Stripe (Stripe-hosted checkout; page footer "Powered by stripe") |
| Checkout URL | `https://buy.stripe.com/fZudR90Q3cxm69k8sTdMM2n`, as recorded by the person who opened it. The URL is not visible in the screenshot itself. |
| Reached from | The checkout linked from the program landing page `https://victoryskating.com/balletgroupprogram` |
| Screenshot | [`2026-10-03-vsa-stripe-checkout-1-year-ballet-club.png`](./2026-10-03-vsa-stripe-checkout-1-year-ballet-club.png), a copy of the original screenshot taken at 23:03 local time. Not edited. |

## What the checkout displayed

| Field | Observed |
|---|---|
| Merchant / brand | VSA |
| Product label | "1-Year Ballet Club (weekly classes)" (heading: "Subscribe to 1-Year Ballet Club (weekly classes).") |
| Price | **$179.00 per year** (USD selected; a TRY/USD currency toggle was shown) |
| Billing | "Billed annually" |
| Payment wording | "You can cancel at least 48 hours before your next payment date by viewing Subscriptions in your email." · "Non-Refundable Payment Terms." · "By subscribing, you authorize VSA to charge you according to the terms until you cancel." |
| Action button | "Subscribe" |

## Conflict with the authoritative product offer

The current authoritative offer for the **1-Year Online Ballet Club** is **$499 USD, package total,
48 included classes**. It came in through the assignment brief, where it is reported as the price
published on the landing page.

The captured checkout shows **$179 USD per year, billed annually**, presented as a subscription.

| | Authoritative offer | Captured checkout |
|---|---|---|
| Amount | $499.00 USD | $179.00 USD |
| Basis | Package total | Per year, billed annually (subscription wording) |
| Source | Assignment brief | Manual checkout verification, 2026-10-03 |

The business has not confirmed or explained the discrepancy. All of the following are **unknown**,
and the prototype does not assume any of them:

- $179 is a new price, or $499 is stale;
- $179 is a promotion or an instalment;
- the landing page is wrong, or the Stripe checkout is wrong.

## Why the prototype blocks this checkout

A captured checkout and an approved checkout are different things. The observation confirms
**what Stripe currently displays**. It does not confirm **which commercial terms VSA intends** to
be authoritative.

- **Checkout status:** `status = ACTIVE` (the checkout page was live at the provider),
  `verification = CONFLICTING`, `usable = false`.
- **Blocking issue:** the OPEN data-quality issue `checkout.price` (CONFLICTING) carries
  `blockingCode = PRICE_CONFLICT`. While it is open, `evaluateCheckoutEligibility()` returns
  `usable = false`.
- **Public responses:** the REST checkout response and the AI tool result report
  `urlCaptured: true`, `url: null` and `urlWithheld: true`. The raw URL is stored in the database
  but is not exposed while the checkout is blocked.
- **AI layer:** it never emits a `CHECKOUT` action. It emits `CHECKOUT_UNAVAILABLE` with reason
  `PRICE_CONFLICT`, and strips any URL the model might write in prose.
- **The offer itself:** the authoritative offer is unchanged ($499, package total, payment
  schedule UNKNOWN). The observed billing and terms are recorded as checkout observations, not as
  product terms.

## How to unblock (once VSA confirms the terms)

1. Update the authoritative offer and/or the checkout to the confirmed terms, with
   `BUSINESS_APPROVED_CONFIG` provenance.
2. Set the checkout's verification to `CONFIRMED`.
3. Mark the `checkout.price` issue `RESOLVED`.

Both steps 2 and 3 are required. The eligibility logic then allows the checkout, and the URL is
exposed through the CHECKOUT action.
