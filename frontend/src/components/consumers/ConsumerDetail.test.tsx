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
      getActivityStatus={() => ({ status: 'active', color: 'bg-green-500' })}
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
});
