import {
  MUNICIPAL_COVERAGE_COLOR,
  REGISTERED_KITCHEN_COLOR,
} from './municipalKitchenCoverage';

const outline = (small: boolean): string => {
  return `stroke="${small ? '#222' : '#fff'}" ${small ? 'stroke-dasharray="4 3"' : ''}`;
};

/** SVG sector geometry; 0% has no sector and 100% is a complete disk. */
export const municipalPieSvg = (percent: number, small = false): string => {
  const angle = (2 * Math.PI * percent) / 100;
  const endpoint = `${40 + 38 * Math.sin(angle)},${40 - 38 * Math.cos(angle)}`;
  const sector =
    percent === 100
      ? `<circle cx="40" cy="40" r="38" fill="${MUNICIPAL_COVERAGE_COLOR}"/>`
      : `<path d="M40,40 L40,2 A38,38 0 ${percent > 50 ? 1 : 0},1 ${endpoint} Z" fill="${MUNICIPAL_COVERAGE_COLOR}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="${REGISTERED_KITCHEN_COLOR}"/>${percent === 0 ? '' : sector}<circle cx="40" cy="40" r="38" fill="none" stroke-width="1" ${outline(small)}/></svg>`;
};
