'use client';

import { useCallback } from 'react';
import { useApi } from '@/lib/api/ApiContext';
import type { DateCheckResponse, Occurrence } from '@/lib/api/types';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatCalendarDate, weekdayPlural, zoneLabel } from '@/lib/labels';
import { Badge } from './ui';

interface Props {
  productSlug: string;
  date: string;
  timezone?: string;
}

/**
 * Structured view of a check_date tool call. It re-reads the same deterministic
 * /date-check endpoint with the arguments the assistant used.
 */
export function DateCheckCard({ productSlug, date, timezone }: Props) {
  const api = useApi();
  const loader = useCallback(() => api.dateCheck(productSlug, date, timezone), [api, productSlug, date, timezone]);
  const { data, error, loading } = useAsyncData(`${productSlug}|${date}|${timezone ?? ''}`, loader);

  if (loading) return <Frame><p className="text-xs text-slate-500">Loading date check…</p></Frame>;
  if (error || !data?.requestedDate || !data.schedule) return null;
  return <DateCheckView data={data} timezone={timezone} />;
}

export function DateCheckView({ data, timezone }: { data: DateCheckResponse; timezone?: string }) {
  const req = data.requestedDate!;
  const zone = timezone ?? req.interpretedInTimezone;
  const onDate = req.occurrencesOnDate[0];
  const next = req.matchesRecurrence && onDate ? onDate : firstAfter(data.nextCandidateOccurrences, req.date, zone);
  const local = next ? next.localTimes[zone] : undefined;

  return (
    <Frame>
      <dl className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Requested</dt>
        <dd className="text-slate-900">
          {formatCalendarDate(req.date)}{' '}
          <Badge tone={req.matchesRecurrence ? 'info' : 'neutral'}>{req.matchesRecurrence ? 'Regular class day' : 'Not a regular class day'}</Badge>
        </dd>
        <dt className="text-slate-500">Regular schedule</dt>
        <dd className="text-slate-900">{weekdayPlural(data.schedule!.recurrence.weekday)}</dd>
        {next && (
          <>
            <dt className="text-slate-500">{req.matchesRecurrence ? 'Session on this date' : 'Next recurring candidate'}</dt>
            <dd className="text-slate-900">
              {formatCalendarDate(local?.localDate ?? next.scheduleLocalDate)}
              {local && (
                <span className="text-slate-500">
                  {' '}
                  · {local.localTime} {zoneLabel(zone)}
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
      {next && <p className="mt-2 text-xs text-slate-600">{occurrenceNote(next)}</p>}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" role="group" aria-label="Date check">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Date check</p>
      {children}
    </div>
  );
}

function firstAfter(occurrences: Occurrence[], date: string, zone: string): Occurrence | undefined {
  return occurrences.find((o) => (o.localTimes[zone]?.localDate ?? o.scheduleLocalDate) > date && o.status !== 'CANCELLED');
}

function occurrenceNote(o: Occurrence): string {
  switch (o.status) {
    case 'SCHEDULED_CONFIRMED':
      return 'No exceptions are recorded for this date in the confirmed exception data.';
    case 'CANCELLED':
      return 'A recorded exception cancels this session.';
    case 'RESCHEDULED':
      return 'This session was moved by a recorded exception.';
    case 'ADDITIONAL':
      return 'This is an additional session from a recorded exception.';
    default:
      return 'Exception/cancellation information has not been confirmed for this date.';
  }
}
