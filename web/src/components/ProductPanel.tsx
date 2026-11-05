import type { ChatAction, CheckoutResponse, EnrollmentView, ProductDetail, ScheduleResponse } from '@/lib/api/types';
import {
  deliveryLabel,
  durationLabel,
  formatCalendarDate,
  formatMoney,
  levelLabel,
  paymentScheduleLabel,
  pricingBasisLabel,
  productTypeLabel,
  sortLevels,
  weekdayPlural,
  zoneLabel,
} from '@/lib/labels';
import { EnrollmentCard } from './EnrollmentCard';
import { PaymentCard } from './PaymentCard';
import { Card, Note, Row } from './ui';

export interface ProductPanelData {
  product: ProductDetail;
  schedule: ScheduleResponse | null;
  enrollment: EnrollmentView;
  checkout: CheckoutResponse;
}

interface Props {
  data: ProductPanelData | undefined;
  loading: boolean;
  error: string | null;
  chatCheckoutAction: Extract<ChatAction, { type: 'CHECKOUT' | 'CHECKOUT_UNAVAILABLE' }> | null;
  timezone: string | undefined;
}

export function ProductPanel({ data, loading, error, chatCheckoutAction, timezone }: Props) {
  if (error) {
    return (
      <Card title="Product">
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="Product">
        <p className="text-sm text-slate-500" aria-live="polite">
          {loading ? 'Loading product information…' : 'Ask about a program and its structured product data will appear here.'}
        </p>
      </Card>
    );
  }

  const { product, schedule, enrollment, checkout } = data;
  const offer = product.offers[0] ?? null;
  const businessName = product.business.canonicalName;

  return (
    <div className="space-y-3" aria-busy={loading}>
      <ProductCard product={product} schedule={schedule} timezone={timezone} />
      <EnrollmentCard enrollment={enrollment} businessName={businessName} />
      <PaymentCard checkout={checkout.actions[0] ?? null} offer={offer} chatAction={chatCheckoutAction} />
    </div>
  );
}

function ProductCard({ product, schedule, timezone }: { product: ProductDetail; schedule: ScheduleResponse | null; timezone: string | undefined }) {
  const offer = product.offers[0];
  const program = product.program;
  const levels = sortLevels(product.audienceLevels);
  const access = product.accessPolicy;
  const payment = offer ? paymentScheduleLabel(offer.paymentSchedule) : null;

  return (
    <Card title="Product" aside={<span className="text-xs text-slate-400">Live from commerce API</span>}>
      <h3 className="text-xl font-semibold leading-tight tracking-tight text-slate-900">{product.name}</h3>
      <p className="mt-0.5 text-sm text-slate-500">
        {product.business.canonicalName}
        {product.business.aliases.length > 0 && <> · {product.business.aliases.join(' · ')}</>}
      </p>

      {offer?.price && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Published package</p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(offer.price.amountMinor, offer.price.currency)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {pricingBasisLabel(offer.pricingBasis)}
            {payment ? ` · ${payment}` : ' · payment schedule not specified'}
          </p>
        </div>
      )}

      <dl className="mt-2 divide-y divide-slate-100">
        <Row label="Format">
          {deliveryLabel(product.deliveryMode)} · {productTypeLabel(product.productType)}
        </Row>
        {product.durationMonths != null && <Row label="Duration">{durationLabel(product.durationMonths)}</Row>}
        {program && <Row label="Classes">{program.includedClasses} included</Row>}
        {schedule && <ScheduleRow schedule={schedule} timezone={timezone} />}
        {program && <Row label="Class duration">{program.classDurationMinutes} minutes</Row>}
        {product.coaches.length > 0 && <Row label="Coach">{product.coaches.map((c) => c.displayName).join(', ')}</Row>}
        {levels.length > 0 && (
          <Row label="Audience">
            <ul className="flex flex-wrap gap-1.5">
              {levels.map((l) => (
                <li key={l} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {levelLabel(l)}
                </li>
              ))}
            </ul>
          </Row>
        )}
        {access?.entitlementDuration.value && (
          <Row label="Access">
            {durationLabel(access.entitlementDuration.value.months)} of access
            {(access.startRule.value === 'UNKNOWN' || access.endRule.value === 'UNKNOWN') && <Note>Exact start and end rules are not specified.</Note>}
          </Row>
        )}
        <Row label="Requirements">
          {product.requirements.knowledge === 'NOT_PROVIDED' ? (
            <span className="text-slate-500">Not specified in the product information</span>
          ) : (
            product.requirements.items.map((r) => r.description).join('; ')
          )}
        </Row>
      </dl>
    </Card>
  );
}

function ScheduleRow({ schedule, timezone }: { schedule: ScheduleResponse; timezone: string | undefined }) {
  const r = schedule.recurrence;
  const tz = r.canonicalTimezone;
  const next = schedule.nextCandidateOccurrences[0];
  const local = next && timezone ? next.localTimes[timezone] : undefined;
  return (
    <Row label="Schedule">
      Weekly on {weekdayPlural(r.weekday)}
      {r.localStartTime && tz.value && (
        <>
          , {r.localStartTime} {zoneLabel(tz.value)}
          {tz.provenance.verificationStatus !== 'CONFIRMED' && '*'}
        </>
      )}
      {local && (
        <Note>
          Next regular session: {formatCalendarDate(local.localDate)}, {local.localTime} {zoneLabel(timezone!)}
          {next.status !== 'SCHEDULED_CONFIRMED' && ' (exceptions not confirmed)'}
        </Note>
      )}
      {tz.provenance.verificationStatus !== 'CONFIRMED' && <Note>* Time zone inferred from the published schedule; not confirmed.</Note>}
    </Row>
  );
}
