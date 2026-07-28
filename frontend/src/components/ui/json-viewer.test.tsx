import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { JsonViewer } from './json-viewer';

const NESTED = {
  id: 42,
  tags: { env: 'prod', team: 'core' },
  items: [{ sku: 'A-1' }],
};

describe('JsonViewer', () => {
  it('renders non-JSON payloads as plain text', () => {
    render(<JsonViewer data="not json at all" />);
    expect(screen.getByText('not json at all')).toBeInTheDocument();
  });

  it('parses JSON strings and shows the root expanded when defaultExpanded', () => {
    render(<JsonViewer data={JSON.stringify(NESTED)} defaultExpanded />);
    expect(screen.getByText('"id":')).toBeInTheDocument();
    expect(screen.getByText('"tags":')).toBeInTheDocument();
  });

  it('expands a nested node when its toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<JsonViewer data={NESTED} defaultExpanded />);

    // Nested objects start collapsed, showing only a preview.
    expect(screen.getByText('{2 keys}')).toBeInTheDocument();
    expect(screen.queryByText('"env":')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand "tags"/i }));

    expect(screen.getByText('"env":')).toBeInTheDocument();
    expect(screen.getByText('"prod"')).toBeInTheDocument();
  });

  it('collapses a nested node when its toggle is clicked again', async () => {
    const user = userEvent.setup();
    render(<JsonViewer data={NESTED} defaultExpanded />);

    await user.click(screen.getByRole('button', { name: /expand "tags"/i }));
    expect(screen.getByText('"env":')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse "tags"/i }));
    expect(screen.queryByText('"env":')).not.toBeInTheDocument();
  });

  it('expands nested arrays', async () => {
    const user = userEvent.setup();
    render(<JsonViewer data={NESTED} defaultExpanded />);

    await user.click(screen.getByRole('button', { name: /expand "items"/i }));
    expect(screen.getByText('{1 key}')).toBeInTheDocument();
  });

  it('does not bubble toggle clicks to ancestor click handlers', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();

    render(
      <div onClick={onAncestorClick}>
        <JsonViewer data={NESTED} defaultExpanded />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /expand "tags"/i }));

    expect(screen.getByText('"env":')).toBeInTheDocument();
    expect(onAncestorClick).not.toHaveBeenCalled();
  });

  it('toggles nested nodes with the keyboard', async () => {
    const user = userEvent.setup();
    render(<JsonViewer data={NESTED} defaultExpanded />);

    screen.getByRole('button', { name: /expand "tags"/i }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('"env":')).toBeInTheDocument();
  });
});
