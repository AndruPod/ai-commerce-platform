# Baseline: Google Gemini (Flash-Lite), without the prototype

This folder records how a general-purpose assistant answered the queries in
[`queries.md`](./queries.md) **without** access to this prototype or its structured commerce data.
It is the "before" half of the comparison in [`../after/README.md`](../after/README.md).

## Setup

| | |
|---|---|
| Assistant | Google Gemini, web UI, model selector **Flash-Lite** (visible in every screenshot) |
| Date | October 4, 2026 |
| Account | Signed out (the "Sign in" button is visible in every screenshot) |
| Access to our data | None. No files, prompts, API output or hints from this repository |
| Intended protocol | One fresh conversation per query, query pasted verbatim, first answer kept (no regeneration) |
| Evidence | One screenshot per query in [`gemini/`](gemini/) (B1–B6, X1, X2) |

**Protocol deviation visible in the evidence.** The top of `X1.png` shows the last word of the
previous answer ("course?", the end of the B6 answer) above the X1 query. So X1 was asked in the
same thread as B6, not in a fresh conversation. Several other screenshots are scrolled, so they
can't confirm or rule out earlier messages in the thread. Read the baseline as "signed-out Gemini
Flash-Lite answers on 2026-10-04", not as a strictly isolated per-query run.

Gemini shows source chips under some sentences (for example "vsaworld.online", "Victory
Skating", "Google Play"). The screenshots show which chip sits next to a claim, but not whether
that source actually says it.

## Reference: what our structured data says

These are our seeded facts and their status (see the main README §7 and §17). They are **our**
data, not something Gemini could see.

| Topic | Our data |
|---|---|
| Product | Victory Skating Academy "1-Year Online Ballet Club": live online group program |
| Audience | Beginner, recreational, advanced, professional |
| Program | 12 months, 48 classes, 60 minutes each, coach Emilia |
| Schedule | Weekly on **Saturdays**, 11:00 (published label "11:00–12:00 PDT"); timezone America/Los_Angeles is an unconfirmed assumption; no exception data |
| Price | **$499 USD, package total**; payment schedule not specified |
| Captured checkout | A Stripe checkout opened on 2026-10-03 showed **$179 USD per year, billed annually**. This conflicts with $499, and **no source explains the difference** |
| Enrollment | "Open" only as prototype configuration; not confirmed by VSA |
| Access | 12 months; start and end rules not specified |
| Requirements | None provided (no equipment list, no onboarding process) |

## Observed Gemini behaviour

Each row records what the screenshot shows (paraphrased; quotes are verbatim) and, separately,
our assessment against the reference above.

| Id | Observed in the screenshot | Our assessment |
|---|---|---|
| B1 | "Yes, Victory Skating (VSA) offers year-long online ballet programs designed specifically for skaters and dancers." Lists two items: "1-Year Ballet Club For Skaters" (live group coaching) and "1-Year Online Ballet Club / 12-Month Ballet Course" (live group classes, step-by-step tutorials and daily exercises). | Finds the right brand and the product name, but merges it with a "12-Month Ballet Course" into one item and lists a skater club next to it. Gives no price, schedule or audience. |
| B2 | "Yes … online ballet programs that cater to all levels, including complete beginners." Mentions "Beginner Foundations", a 12-month ballet course with tutorials "at their own pace", and "free trial practice plans, recorded workshops, and downloadable workbooks". Ends by offering to help with pricing or enrollment. | The beginner answer agrees with our audience data, but it is attributed to VSA generally and not to the 1-Year Online Ballet Club. It describes self-paced material, which our live group program doesn't include. Free trials, workshops and workbooks aren't in our data. |
| B3 | "Yes … two main options": "1-Year Ballet Club For Skaters" (live group coaching via Zoom) and "12-Month Ballet Course (Online Ballet Academy)" (tutorials, access anytime), plus "complementary 12-month full-body flexibility and conditioning courses". | Never names the 1-Year Online Ballet Club. It offers other products instead (**product mixing**). Zoom isn't in our data. |
| B4 | Says the group programs ("1-Year Ballet Club and 12-Month Ballet Course") are "primarily general, multi-level tracks". For advanced students and professionals it recommends "Private Ballet Practice" (one-on-one coaching) and a "12-Month Full-Body Flexibility Course". It also suggests group tracks may be "too generalized". | In our data the 1-Year Online Ballet Club lists **advanced and professional** as audience levels. Gemini steers the user away from it and towards private lessons and another course (**product mixing** and an **audience error**). |
| B5 | "…is priced at **$499 per year** (frequently discounted from an original rate of around **$179 to $199 for promotional periods** or select sign-ups)." Included: "live, interactive group classes held weekly (**every Sunday**) via Zoom with elite master coaches", skill focus, community. "Equipment Needed for Sessions": "Sneakers or proper dance shoes/socks", "A jump rope and exercise mat", "A step platform", internet and space. | **Price basis:** $499 is a package total in our data and has no "per year" basis. **Invented explanation:** no source we have calls $179 (or $199) a promotional or original price. $179/year is what the checkout displayed, and the difference is unexplained. The sentence is also internally inconsistent: $499 "discounted from" a lower "original rate". **Schedule error:** Sunday, not Saturday. **Unsupported requirements:** our data has no equipment list, and a jump rope or step platform fits a skating/conditioning product (likely **product mixing**). Doesn't mention 48 classes, 60 minutes or the coach. |
| B6 | "**Yes, absolutely!** You can join … regardless of whether you are a complete beginner, an experienced dancer, or a skater." Steps: choose the "1-Year Online Ballet Club" or the "12-Month Ballet Course"; "Registration is open to students and athletes of all ages and levels worldwide"; "promotional enrollment windows (sometimes discounted down from standard pricing)"; "After completing your purchase, you will receive your onboarding details and access instructions via email (**typically within 24 to 48 hours**)". | States open enrollment without qualification, but in our data it is unconfirmed (prototype configuration). **Unsupported onboarding claims:** the email, portal and 24–48 hour timing aren't in our data. Mentions promotional pricing without any source. Mixes in the self-paced course again. |
| X1 | "**Yes, you can enroll and participate around November 6, 2026.**" For the "1-Year Ballet Club": "weekly live sessions (**held on Sundays** via Zoom). Since November 6, 2026, falls on a Friday, you can … jump straight into the next upcoming Sunday session following that date." For the "12-Month Ballet Course", access starts "immediately on or around November 6". | November 6, 2026 is correctly identified as a Friday. **Schedule error:** the next session in our data is a *candidate* on **Saturday November 7**, not Sunday November 8, and it is not guaranteed because exception data is missing. Enrollment is stated as a fact. Access is described as a "subscription"; our data has a 12-month duration with unknown start/end rules. |
| X2 | Step-by-step guide: visit "victoryskating.com/balletclasses or vsaworld.online", or the "VSA: Elite Sports & Arts" app; locate the "1-Year Ballet Club For Skaters (or the general annual online ballet club option)"; "The promotional annual rate is typically **$499/year** (frequently marked down from standard pricing)"; "Proceed to checkout, where you can securely complete your payment"; "confirmation email"; "portal credentials, schedule updates, and Zoom links … within **24 hours** of purchase." | **Unsafe enrollment/payment guidance:** it sends the user to pay without mentioning that the captured checkout shows a different price ($179/year), so the user would meet terms that conflict with what Gemini quoted. It again labels $499 "per year" and "promotional" with no source. It points to the skater club as the product to pick (**product mixing**). Onboarding timing and contents are unsupported. We have not verified the website path or app it names. |

## Summary of failure patterns (our conclusions)

These conclusions are drawn only from the eight screenshots above:

1. **Product mixing.** The answers move between a "1-Year Online Ballet Club", a "1-Year Ballet Club
   For Skaters", a self-paced "12-Month Ballet Course", flexibility courses and private practice.
   B3 never names the target product, and B4 and X2 steer the user to other products.
2. **Pricing and provenance.** The $499 package total becomes "$499 per year" (B5, X2). The $179
   that the real checkout displays is explained as promotional or original pricing (B5), and
   no source supports that explanation. No answer notices that the checkout and the published
   offer disagree.
3. **Schedule and dates.** Classes are said to be on Sunday (B5, X1). The November 6 answer sends
   the user to "the next upcoming Sunday session" instead of the Saturday candidate, and never
   says that individual sessions aren't guaranteed.
4. **Unsupported claims.** Equipment lists (B5), onboarding emails within 24–48 hours (B6, X2),
   Zoom delivery, free trials and workbooks. None of these are in our data. The screenshots
   don't show whether a cited source actually states them.
5. **Enrollment and payment safety.** Enrollment is asserted ("Yes, absolutely!", "Yes, you can
   enroll"), and X2 walks the user to checkout and payment without any warning.

What the evidence does **not** show: whether any of the cited web pages actually contain these
claims, and whether Gemini would answer differently in a strictly fresh conversation (see the
protocol deviation above).

## Independence rules

- The baseline was captured outside this repository, signed out, with no access to the
  prototype. Nothing in this repository's code reads, generates or modifies baseline files.
- Don't edit or replace the screenshots. A new baseline should be added as a new, dated folder.
