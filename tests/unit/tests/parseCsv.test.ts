import { parseCsv } from 'src/data-source-static/parseCsv';

describe('parseCsv', () => {
  test('keeps quoted commas in one field and unescapes doubled quotes', () => {
    expect(parseCsv('a,"R$ 15.000,00","Alta""mira"\n1,2,3\n')).toEqual([
      ['a', 'R$ 15.000,00', 'Alta"mira'],
      ['1', '2', '3'],
    ]);
  });

  test('drops \\r so CRLF files parse like LF ones, and flushes a last row without newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});
