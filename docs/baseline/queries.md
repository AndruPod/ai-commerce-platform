# Baseline queries

The queries used for the Google Gemini baseline (`docs/baseline/gemini/`). B1–B6 are the supplied
queries and are used unchanged by the connected-prototype run (`docs/after/`, `pnpm eval:ai`).

| Id | Query | Screenshot |
|---|---|---|
| B1 | Does Victory Skating offer a year-long online ballet program? | [`gemini/B1.png`](gemini/B1.png) |
| B2 | Does VSA have online ballet classes for complete beginners? | [`gemini/B2.png`](gemini/B2.png) |
| B3 | I'm looking for an annual online ballet program that I can join from home. Does Victory Skating have anything? | [`gemini/B3.png`](gemini/B3.png) |
| B4 | I'm an experienced dancer. Does VSA offer an online ballet program that is also open to advanced students and professionals? | [`gemini/B4.png`](gemini/B4.png) |
| B5 | How much is the Victory Skating / VSA 1-Year Online Ballet Club, and what is included? | [`gemini/B5.png`](gemini/B5.png) |
| B6 | I want to start taking ballet classes regularly. Can I join the VSA annual program? | [`gemini/B6.png`](gemini/B6.png) |
| X1 | I'm free on November 6, 2026. Can I join the Victory Skating / VSA annual ballet program around that time? | [`gemini/X1.png`](gemini/X1.png) |
| X2 | I want to enroll in the Victory Skating / VSA 1-Year Online Ballet Club. Can you help me proceed with enrollment and payment? | [`gemini/X2.png`](gemini/X2.png) |

## Wording differences in the connected-prototype run

The extra Gemini queries X1 and X2 are close to, but not identical to, the prototype
evaluation's extra queries (`scripts/eval-ai.ts`):

| Gemini baseline | Closest prototype query | Difference |
|---|---|---|
| X1 (Nov 6) | eval X1: "I'm free on November 6, 2026. Can I join the annual ballet program around that time?" | The prototype wording omits "Victory Skating / VSA" |
| X2 (enroll and pay) | eval X4: "How do I enroll and pay for the VSA annual ballet program?" | Different phrasing, same intent |

Compare those pairs by intent, not word for word.
