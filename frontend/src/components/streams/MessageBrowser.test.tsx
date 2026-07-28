import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MessageBrowser } from './MessageBrowser';
import { replayStreamMessages, type StreamMessage } from '../../services/api-client';

vi.mock('../../services/api-client', () => ({
  replayStreamMessages: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const MESSAGE: StreamMessage = {
  sequence: 7,
  subject: 'orders.created',
  data: { id: 'ord-1', tags: { env: 'prod', team: 'core' } },
  headers: {},
  timestamp: '2026-05-03T18:21:19Z',
};

const mockedReplay = vi.mocked(replayStreamMessages);

async function fetchAndExpandRow() {
  const user = userEvent.setup();
  render(<MessageBrowser streamName="ORDERS" onClose={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: /fetch messages/i }));
  await user.click(await screen.findByRole('button', { name: /expand message 7/i }));

  return user;
}

describe('MessageBrowser', () => {
  beforeEach(() => {
    mockedReplay.mockReset();
    mockedReplay.mockResolvedValue([MESSAGE]);
  });

  it('shows a collapsed preview until the message is expanded', async () => {
    const user = userEvent.setup();
    render(<MessageBrowser streamName="ORDERS" onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /fetch messages/i }));

    expect(await screen.findByText(JSON.stringify(MESSAGE.data))).toBeInTheDocument();
    expect(screen.queryByText('"id":')).not.toBeInTheDocument();
  });

  it('expands the message into a JSON tree', async () => {
    await fetchAndExpandRow();

    expect(screen.getByText('"id":')).toBeInTheDocument();
    expect(screen.getByText('"tags":')).toBeInTheDocument();
  });

  it('keeps the message expanded while drilling into nested JSON', async () => {
    const user = await fetchAndExpandRow();

    await user.click(screen.getByRole('button', { name: /expand "tags"/i }));

    // The nested node opened and the message row stayed expanded.
    expect(screen.getByText('"env":')).toBeInTheDocument();
    expect(screen.getByText('"prod"')).toBeInTheDocument();
    expect(screen.getByText('"id":')).toBeInTheDocument();
  });

  it('collapses the message only through its own toggle', async () => {
    const user = await fetchAndExpandRow();

    await user.click(screen.getByRole('button', { name: /collapse message 7/i }));

    expect(screen.queryByText('"id":')).not.toBeInTheDocument();
    expect(screen.getByText(JSON.stringify(MESSAGE.data))).toBeInTheDocument();
  });
});
