import { unwrapQueryRows } from './unwrap-query-rows';

describe('unwrapQueryRows', () => {
  it('returns plain row arrays unchanged', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(unwrapQueryRows(rows)).toEqual(rows);
  });

  it('unwraps TypeORM [rows, rowCount] tuples', () => {
    expect(unwrapQueryRows([[], 0])).toEqual([]);
    expect(unwrapQueryRows([[{ id: 'event-1' }], 1])).toEqual([{ id: 'event-1' }]);
  });

  it('unwraps reversed [rowCount, rows] tuples', () => {
    expect(unwrapQueryRows([0, []])).toEqual([]);
    expect(unwrapQueryRows([1, [{ id: 'event-2' }]])).toEqual([
      { id: 'event-2' },
    ]);
  });

  it('reads rows from pg QueryResult objects', () => {
    expect(unwrapQueryRows({ rows: [{ id: 'x' }] })).toEqual([{ id: 'x' }]);
  });

  it('returns an empty array for unknown shapes', () => {
    expect(unwrapQueryRows(null)).toEqual([]);
    expect(unwrapQueryRows(undefined)).toEqual([]);
    expect(unwrapQueryRows({})).toEqual([]);
  });
});
