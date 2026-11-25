import { namedYears } from 'src/app/api/ai/spec/catalogueFeedback';

jest.mock('@ttoss/geovis', () => {
  return { validateSpec: jest.fn() };
});

describe('namedYears', () => {
  test('lists every year a text names, in order, and nothing else', () => {
    expect(namedYears('dados de 2010 e de 2022, 12345 pessoas')).toEqual([
      2010, 2022,
    ]);
    expect(namedYears('por 10 mil pessoas')).toEqual([]);
  });
});
