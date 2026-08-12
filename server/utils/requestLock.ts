import AsyncLock from '@server/utils/asyncLock';

// Keyed on user id. Never dispatch from a subscriber or transaction as a waiter
// would block while holding the save's connection.
const requestLock = new AsyncLock();

export default requestLock;
