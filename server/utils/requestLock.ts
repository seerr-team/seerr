import AsyncLock from '@server/utils/asyncLock';

// Keyed on user id or request id. Never dispatch from a subscriber or
// transaction as a waiter would block while holding the save's connection.
const requestLock = new AsyncLock();

export const userKey = (userId: number) => `user:${userId}`;
export const requestKey = (requestId: number) => `request:${requestId}`;

export default requestLock;
