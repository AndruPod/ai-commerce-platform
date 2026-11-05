import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { toLookupKey } from '../../common/lookup-key';
import * as s from '../schema';
import { vsaSeed as d } from './vsa-annual-ballet.data';

/**
 * Idempotent seed: inside one transaction, removes the VSA business (cascading
 * to everything it owns) and re-inserts it from the typed seed data.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: s });

  try {
    await db.transaction(async (tx) => {
      await tx.delete(s.businesses).where(eq(s.businesses.slug, d.business.slug));

      const [business] = await tx
        .insert(s.businesses)
        .values({
          slug: d.business.slug,
          canonicalName: d.business.canonicalName,
          canonicalNameKey: toLookupKey(d.business.canonicalName),
        })
        .returning();

      await tx.insert(s.businessAliases).values(
        d.business.aliases.map((alias) => ({
          businessId: business.id,
          alias,
          aliasKey: toLookupKey(alias),
          ...d.business.aliasProvenance,
        })),
      );

      const [coach] = await tx
        .insert(s.coaches)
        .values({ businessId: business.id, displayName: d.coach.displayName, bio: d.coach.bio })
        .returning();

      const [product] = await tx
        .insert(s.products)
        .values({ businessId: business.id, ...d.product })
        .returning();

      await tx
        .insert(s.productAudienceLevels)
        .values(d.audienceLevels.map((level) => ({ productId: product.id, level, ...d.audienceProvenance })));

      await tx
        .insert(s.productCoaches)
        .values({ productId: product.id, coachId: coach.id, role: d.coachRole, ...d.coachProvenance });

      const { provenance: offerProv, ...offer } = d.offer;
      const [offerRow] = await tx
        .insert(s.offers)
        .values({ productId: product.id, ...offer, ...offerProv })
        .returning();

      const { provenance: programProv, ...program } = d.program;
      await tx.insert(s.programs).values({ productId: product.id, ...program, ...programProv });

      const sc = d.schedule;
      const [schedule] = await tx
        .insert(s.schedules)
        .values({
          productId: product.id,
          frequency: sc.frequency,
          isoWeekday: sc.isoWeekday,
          localStartTime: sc.localStartTime,
          durationMinutes: sc.durationMinutes,
          ...sc.provenance,
          timezone: sc.timezone,
          tzSourceType: sc.timezoneProvenance.sourceType,
          tzSourceRef: sc.timezoneProvenance.sourceRef,
          tzVerificationStatus: sc.timezoneProvenance.verificationStatus,
          tzVerifiedAt: sc.timezoneProvenance.verifiedAt,
          publishedTimeLabels: sc.publishedTimeLabels,
          exceptionsConfirmedThrough: sc.exceptionsConfirmedThrough,
          exceptionsSourceType: sc.exceptionsProvenance.sourceType,
          exceptionsSourceRef: sc.exceptionsProvenance.sourceRef,
          exceptionsVerificationStatus: sc.exceptionsProvenance.verificationStatus,
          exceptionsVerifiedAt: sc.exceptionsProvenance.verifiedAt,
        })
        .returning();

      if (d.scheduleExceptions.length > 0) {
        await tx
          .insert(s.scheduleExceptions)
          .values(d.scheduleExceptions.map(({ provenance, ...e }) => ({ scheduleId: schedule.id, ...e, ...provenance })));
      }

      const { provenance: enrollProv, ...enrollment } = d.enrollment;
      await tx.insert(s.enrollmentAvailability).values({ productId: product.id, ...enrollment, ...enrollProv });

      const a = d.accessPolicy;
      await tx.insert(s.accessPolicies).values({
        productId: product.id,
        entitlementDurationMonths: a.entitlementDurationMonths,
        durationSourceType: a.durationProvenance.sourceType,
        durationSourceRef: a.durationProvenance.sourceRef,
        durationVerificationStatus: a.durationProvenance.verificationStatus,
        durationVerifiedAt: a.durationProvenance.verifiedAt,
        startRule: a.startRule,
        startRuleSourceType: a.startRuleProvenance.sourceType,
        startRuleSourceRef: a.startRuleProvenance.sourceRef,
        startRuleVerificationStatus: a.startRuleProvenance.verificationStatus,
        startRuleVerifiedAt: a.startRuleProvenance.verifiedAt,
        endRule: a.endRule,
        endRuleSourceType: a.endRuleProvenance.sourceType,
        endRuleSourceRef: a.endRuleProvenance.sourceRef,
        endRuleVerificationStatus: a.endRuleProvenance.verificationStatus,
        endRuleVerifiedAt: a.endRuleProvenance.verifiedAt,
      });

      if (d.requirements.length > 0) {
        await tx
          .insert(s.productRequirements)
          .values(d.requirements.map(({ provenance, ...r }) => ({ productId: product.id, ...r, ...provenance })));
      }

      const { provenance: checkoutProv, ...checkout } = d.checkout;
      await tx
        .insert(s.checkoutActions)
        .values({ productId: product.id, offerId: offerRow.id, ...checkout, ...checkoutProv });

      await tx
        .insert(s.dataQualityIssues)
        .values(d.dataQualityIssues.map((i) => ({ businessId: business.id, productId: product.id, ...i })));
    });
    console.log(`Seeded ${d.business.canonicalName} / ${d.product.name}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
