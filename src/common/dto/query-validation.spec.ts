import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DateCheckQueryDto } from '../../availability/dto/date-check-query.dto';
import { ProductListQueryDto } from '../../product/dto/product-query.dto';
import { ScheduleQueryDto } from '../../schedule/dto/schedule-query.dto';

function errors<T extends object>(cls: new () => T, plain: object): string[] {
  return validateSync(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);
}

describe('query DTO validation', () => {
  it('date-check requires a real calendar date', () => {
    expect(errors(DateCheckQueryDto, {})).toEqual(['date']);
    expect(errors(DateCheckQueryDto, { date: '2026-02-30' })).toEqual(['date']);
    expect(errors(DateCheckQueryDto, { date: '06/11/2026' })).toEqual(['date']);
    expect(errors(DateCheckQueryDto, { date: '2026-11-06' })).toEqual([]);
  });

  it('rejects invalid timezones without fallback', () => {
    expect(errors(ScheduleQueryDto, { tz: 'Mars/Olympus' })).toEqual(['tz']);
    expect(errors(ScheduleQueryDto, { tz: 'PDT' })).toEqual(['tz']);
    expect(errors(ScheduleQueryDto, { tz: 'Europe/London' })).toEqual([]);
  });

  it('normalises enum filters to upper case and rejects unknown values', () => {
    const dto = plainToInstance(ProductListQueryDto, { discipline: 'ballet', level: 'beginner', deliveryMode: 'online_live', durationMonths: '12' });
    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ discipline: 'BALLET', level: 'BEGINNER', deliveryMode: 'ONLINE_LIVE', durationMonths: 12 });
    expect(errors(ProductListQueryDto, { level: 'EXPERT' })).toEqual(['level']);
    expect(errors(ProductListQueryDto, { durationMonths: 'twelve' })).toEqual(['durationMonths']);
  });
});
