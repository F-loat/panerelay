import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_PROTOCOL_VERSION, type CdpBootstrapRequest } from '@panerelay/protocol';
import { CdpBootstrapStoreError, CdpBootstrapTicketStore } from './cdp-bootstrap-store.js';

const request: CdpBootstrapRequest = {
  protocol: PANERELAY_PROTOCOL_VERSION,
  browser: { browserId: 'browser-1', generation: 'generation-1' },
  actor: { kind: 'automation', name: 'Browser Use' },
  laneKey: 'browser-use:default',
  connectionPolicy: 'single',
};

test('issues random bounded tickets without creating a participant', () => {
  const created = 0;
  const store = new CdpBootstrapTicketStore<object>({ maxOutstandingTickets: 2 });
  const first = store.issue(request);
  const second = store.issue({ ...request, laneKey: 'browser-use:other' });
  assert.notEqual(first.ticketId, second.ticketId);
  assert.match(first.ticketId, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(store.snapshot(), {
    outstandingTickets: 2,
    activeLanes: 0,
    consumedTickets: 0,
  });
  assert.equal(created, 0);
  assert.throws(
    () => store.issue({ ...request, laneKey: 'third' }),
    (error: unknown) => error instanceof CdpBootstrapStoreError && error.code === 'ticket-limit',
  );
  store.clear();
});

test('activates idempotently, occupies one lane, and consumes once', () => {
  const store = new CdpBootstrapTicketStore<{ id: string }>();
  const issued = store.issue(request);
  let created = 0;
  const create = () => {
    created += 1;
    return { participant: { id: 'participant-1' }, cdpUrl: 'ws://127.0.0.1/cdp' };
  };
  const first = store.activate(issued.ticketId, request.browser, create);
  const repeated = store.activate(issued.ticketId, request.browser, create);
  assert.equal(repeated.participant, first.participant);
  assert.equal(created, 1);

  const competing = store.issue(request);
  assert.throws(
    () => store.activate(competing.ticketId, request.browser, create),
    (error: unknown) => error instanceof CdpBootstrapStoreError && error.code === 'lane-busy',
  );
  assert.equal(store.consume(issued.ticketId, request.browser).participant, first.participant);
  assert.throws(
    () => store.consume(issued.ticketId, request.browser),
    (error: unknown) => error instanceof CdpBootstrapStoreError && error.code === 'ticket-consumed',
  );
  assert.equal(store.releaseParticipant(first.participant), true);
  const activated = store.activate(competing.ticketId, request.browser, create);
  assert.equal(activated.participant.id, 'participant-1');
  store.clear();
});

test('enforces generation binding, expiry, and deterministic shutdown cleanup', async () => {
  const invalidated: string[] = [];
  const store = new CdpBootstrapTicketStore<{ id: string }>({
    ticketTtlMs: 20,
    connectionWindowMs: 20,
    onParticipantInvalidated: (participant, reason) =>
      invalidated.push(`${participant.id}:${reason}`),
  });
  const wrongGeneration = store.issue(request);
  assert.throws(
    () =>
      store.activate(
        wrongGeneration.ticketId,
        { ...request.browser, generation: 'generation-2' },
        () => ({ participant: { id: 'wrong' }, cdpUrl: 'ws://127.0.0.1/cdp' }),
      ),
    (error: unknown) =>
      error instanceof CdpBootstrapStoreError && error.code === 'generation-changed',
  );
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.throws(
    () =>
      store.activate(wrongGeneration.ticketId, request.browser, () => ({
        participant: { id: 'expired' },
        cdpUrl: 'ws://127.0.0.1/cdp',
      })),
    (error: unknown) =>
      error instanceof CdpBootstrapStoreError &&
      (error.code === 'ticket-expired' || error.code === 'ticket-invalid'),
  );

  const active = store.issue(request);
  store.activate(active.ticketId, request.browser, () => ({
    participant: { id: 'active' },
    cdpUrl: 'ws://127.0.0.1/cdp',
  }));
  store.clear('Bridge shutting down');
  assert.deepEqual(invalidated, ['active:Bridge shutting down']);
  assert.deepEqual(store.snapshot(), {
    outstandingTickets: 0,
    activeLanes: 0,
    consumedTickets: 0,
  });
});
