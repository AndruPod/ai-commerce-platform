import { Global, Module } from '@nestjs/common';

/** Injectable time source so date-dependent services are testable. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}

export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
