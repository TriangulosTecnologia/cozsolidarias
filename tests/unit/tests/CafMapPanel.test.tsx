import { render, screen } from '@testing-library/react';

import CafMapPanel from '@/app/(features)/mapas/CafMapPanel';

const mockUseCafDrilldown = jest.fn();

jest.mock('@ttoss/geovis', () => {
  return {
    GeoVisCanvas: ({ style }: { style: React.CSSProperties }) => {
      return <div data-testid="canvas" style={style} />;
    },
  };
});

jest.mock('@/app/(features)/mapas/useCafDrilldown', () => {
  return {
    useCafDrilldown: () => {
      return mockUseCafDrilldown();
    },
  };
});

test('renders the canvas filling its container, with the drill-down wired', () => {
  render(<CafMapPanel />);

  const canvas = screen.getByTestId('canvas');

  expect(canvas.style.width).toBe('100%');
  expect(canvas.style.height).toBe('100%');
  expect(mockUseCafDrilldown).toHaveBeenCalled();
});
