import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LagCell } from './LagCell';
import { LAG_CRIT, LAG_WARN } from '../../lib/lag';

describe('LagCell', () => {
  it('reports the pending count to assistive tech, not just visually', () => {
    render(<LagCell pending={41208} />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '41208');
    expect(meter).toHaveAccessibleName('41,208 messages pending');
  });

  it('escalates the colour with the threshold', () => {
    const { container: ok } = render(<LagCell pending={0} />);
    expect(ok.querySelector('.bg-state-ok')).toBeInTheDocument();

    const { container: warn } = render(<LagCell pending={LAG_WARN} />);
    expect(warn.querySelector('.bg-state-warn')).toBeInTheDocument();

    const { container: crit } = render(<LagCell pending={LAG_CRIT} />);
    expect(crit.querySelector('.bg-state-crit')).toBeInTheDocument();
  });

  it('keeps a healthy count quiet instead of colouring it', () => {
    render(<LagCell pending={0} />);
    expect(screen.getByText('0')).toHaveClass('text-muted-foreground');
  });
});
