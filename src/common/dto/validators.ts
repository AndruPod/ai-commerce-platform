import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidCalendarDate, isValidIanaZone } from '../../schedule/domain/evaluate-date';

/** Strict "YYYY-MM-DD" that is also a real calendar date (rejects 2026-02-30). */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: '$property must be a valid calendar date in YYYY-MM-DD format', ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && isValidCalendarDate(v) },
    });
}

/** A valid IANA timezone name (e.g. "Europe/London"). No silent fallback. */
export function IsIanaTimezone(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isIanaTimezone',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: '$property must be a valid IANA timezone, e.g. "Europe/London"', ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && isValidIanaZone(v) },
    });
}
