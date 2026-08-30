import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConsumerDetail, type Consumer } from './ConsumerDetail';
import { fetchNextMessages } from '../../services/api-client-extended';

vi.mock('../../services/api-client', () => ({
  pauseConsumer: vi.fn(),
  resumeConsumer: vi.fn(),
}));

vi.mock('../../services/api-client-extended', () => ({
  fetchNextMessages: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const CONSUMER: Consumer = {
  name: 'orders-worker',
  stream: 'ORDERS',
  subject: 'orders.>',
  deliverPolicy: 'all',
  ackPolicy: 'explicit',
  replayPolicy: 'instant',
  maxDeliver: 5,
  delivered: 10,
  acknowledged: 9,
  pending: 1,
  redelivered: 0,
  numWaiting: 0,
  paused: false,
  created: new Date('2026-05-01T10:00:00Z'),
  lastActivity: new Date('2026-05-03T10:00:00Z'),
  isActive: true,
};

const mockedFetchNext = vi.mocked(fetchNextMessages);

function renderDetail() {
  return render(
    <ConsumerDetail
      consumer={CONSUMER}
      onClose={vi.fn()}
      onRefresh={vi.fn()}
      getActivityStatus={() => ({ status: 'active', color: 'bg-state-ok' })}
    />,
  );
}

describe('ConsumerDetail pulled messages', () => {
  beforeEach(() => {
    mockedFetchNext.mockReset();
    mockedFetchNext.mockResolvedValue([
      {
        sequence: 3,
        subject: 'orders.created',
        data: { id: 'ord-1', tags: { env: 'prod', team: 'core' } },
        headers: {},
        timestamp: '2026-05-03T18:21:19Z',
      },
    ]);
  });

  it('renders pulled JSON payloads as an expandable tree', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: /fetch next/i }));

    expect(await screen.findByText('"id":')).toBeInTheDocument();
    expect(screen.getByText('{2 keys}')).toBeInTheDocument();
  });

  it('lets nested nodes be expanded', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: /fetch next/i }));
    await user.click(await screen.findByRole('button', { name: /expand "tags"/i }));

    expect(screen.getByText('"env":')).toBeInTheDocument();
    expect(screen.getByText('"prod"')).toBeInTheDocument();
  });

  it('keeps a multi-message batch collapsed so large payloads stay cheap', async () => {
    const user = userEvent.setup();
    mockedFetchNext.mockResolvedValue([
      {
        sequence: 3,
        subject: 'orders.created',
        data: { id: 'ord-1', tags: { env: 'prod' } },
        headers: {},
        timestamp: '2026-05-03T18:21:19Z',
      },
      {
        sequence: 4,
        subject: 'orders.created',
        data: { id: 'ord-2', tags: { env: 'prod' } },
        headers: {},
        timestamp: '2026-05-03T18:21:20Z',
      },
    ]);
    renderDetail();

    await user.click(screen.getByRole('button', { name: /fetch next/i }));

    // Each message renders as a single collapsed root, not a full tree.
    const roots = await screen.findAllByRole('button', { name: /expand root/i });
    expect(roots).toHaveLength(2);
    expect(screen.queryByText('"id":')).not.toBeInTheDocument();

    await user.click(roots[0]);
    expect(screen.getByText('"ord-1"')).toBeInTheDocument();
    expect(screen.queryByText('"ord-2"')).not.toBeInTheDocument();
  });

  it('falls back to plain text for non-JSON payloads', async () => {
    const user = userEvent.setup();
    mockedFetchNext.mockResolvedValue([
      {
        sequence: 4,
        subject: 'orders.raw',
        data: 'plain payload',
        headers: {},
        timestamp: '2026-05-03T18:21:19Z',
      },
    ]);
    renderDetail();

    await user.click(screen.getByRole('button', { name: /fetch next/i }));

    expect(await screen.findByText('plain payload')).toBeInTheDocument();
  });
  it('browses without acking by default and acks only when asked', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: /fetch next/i }));
    expect(mockedFetchNext).toHaveBeenLastCalledWith('ORDERS', 'orders-worker', 1, false);

    await user.click(screen.getByRole('switch', { name: /ack after fetch/i }));
    await user.click(screen.getByRole('button', { name: /fetch next/i }));

    expect(mockedFetchNext).toHaveBeenLastCalledWith('ORDERS', 'orders-worker', 1, true);
  });

  it('warns before acking that messages will be consumed', async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(screen.queryByText(/permanently removed/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /ack after fetch/i }));
    expect(screen.getByText(/permanently removed/i)).toBeInTheDocument();
  });

  // Regression: messages were keyed by array index, so React reused the
  // component from the previous batch and the single-message auto-expand
  // silently stopped working after any larger pull.
  it('auto-expands a single message pulled after a larger batch', async () => {
    const user = userEvent.setup();
    mockedFetchNext.mockResolvedValueOnce([
      {
        sequence: 3,
        subject: 'orders.created',
        data: { id: 'ord-1' },
        headers: {},
        timestamp: '2026-05-03T18:21:19Z',
      },
      {
        sequence: 4,
        subject: 'orders.created',
        data: { id: 'ord-2' },
        headers: {},
        timestamp: '2026-05-03T18:21:20Z',
      },
    ]);
    renderDetail();

    await user.click(screen.getByRole('button', { name: /fetch next/i }));
    expect(await screen.findAllByRole('button', { name: /expand root/i })).toHaveLength(2);

    mockedFetchNext.mockResolvedValueOnce([
      {
        sequence: 5,
        subject: 'orders.created',
        data: { id: 'ord-3' },
        headers: {},
        timestamp: '2026-05-03T18:21:21Z',
      },
    ]);
    await user.click(screen.getByRole('button', { name: /fetch next/i }));

    expect(await screen.findByText('"ord-3"')).toBeInTheDocument();
  });
});
