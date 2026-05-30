import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  MediaRemovalRequestStatus,
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRemovalRequest } from '@server/entity/MediaRemovalRequest';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import removalRequestRoutes from './removalRequest';

// Precomputed bcrypt hash of 'test1234' (matches seedTestDb).
const PW = '$2b$12$Z5V2P5HZgmx4/AnWFMZN1.aD5AM1NucNi.mhNTSQ9oVtmdzu7Le/a';

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/removal-request', removalRequestRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return app;
}

before(() => {
  app = createApp();
});

setupTestDb();

async function loginAs(email: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;
  try {
    const agent = request.agent(app);
    const res = await agent
      .post('/auth/local')
      .send({ email, password: 'test1234' });
    assert.strictEqual(res.status, 200, `login failed for ${email}`);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

async function makeUser(email: string, permissions: number): Promise<User> {
  const userRepo = getRepository(User);
  const user = (await userRepo.findOne({ where: { email } })) ?? new User();
  user.email = email;
  user.username = email.split('@')[0];
  user.userType = UserType.LOCAL;
  user.password = PW;
  user.permissions = permissions;
  user.avatar = '';
  return userRepo.save(user);
}

async function makeMovie(
  tmdbId: number,
  opts: { status?: MediaStatus; status4k?: MediaStatus } = {}
): Promise<Media> {
  // serviceId stays null so executeRemoval only clears Seerr data (no *arr call)
  return getRepository(Media).save(
    new Media({
      mediaType: MediaType.MOVIE,
      tmdbId,
      status: opts.status ?? MediaStatus.AVAILABLE,
      status4k: opts.status4k ?? MediaStatus.UNKNOWN,
      serviceId: null,
      serviceId4k: null,
    })
  );
}

async function makeShow(
  tmdbId: number,
  seasonNumbers: number[]
): Promise<Media> {
  const media = await getRepository(Media).save(
    new Media({
      mediaType: MediaType.TV,
      tmdbId,
      tvdbId: tmdbId + 1000,
      status: MediaStatus.AVAILABLE,
      status4k: MediaStatus.UNKNOWN,
      serviceId: null,
      serviceId4k: null,
    })
  );
  const seasonRepo = getRepository(Season);
  for (const n of seasonNumbers) {
    await seasonRepo.save(
      new Season({
        seasonNumber: n,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );
  }
  return media;
}

async function requestMedia(
  media: Media,
  user: User,
  is4k = false
): Promise<MediaRequest> {
  return getRepository(MediaRequest).save(
    new MediaRequest({
      type: media.mediaType,
      media,
      requestedBy: user,
      status: MediaRequestStatus.COMPLETED,
      is4k,
    })
  );
}

describe('POST /removal-request (permissions & validation)', () => {
  it('rejects users without REQUEST_REMOVAL with 403', async () => {
    const user = await makeUser('plain@seerr.dev', Permission.REQUEST);
    const media = await makeMovie(101);
    await requestMedia(media, user);

    const agent = await loginAs('plain@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });

    assert.strictEqual(res.status, 403);
  });

  it('rejects removal of media the user did not request (no REMOVAL_ALL)', async () => {
    const requester = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const other = await makeUser('other@seerr.dev', Permission.REQUEST);
    const media = await makeMovie(102);
    await requestMedia(media, other); // requested by someone else

    const agent = await loginAs('req@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });

    assert.strictEqual(res.status, 403);
    void requester;
  });

  it('creates a PENDING request for media the user requested', async () => {
    const user = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const media = await makeMovie(103);
    await requestMedia(media, user);

    const agent = await loginAs('req@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, MediaRemovalRequestStatus.PENDING);
    assert.strictEqual(res.body.is4k, false);
  });

  it('allows REMOVAL_ALL users to request removal of any media', async () => {
    await makeUser(
      'super@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL + Permission.REMOVAL_ALL
    );
    const owner = await makeUser('owner2@seerr.dev', Permission.REQUEST);
    const media = await makeMovie(104);
    await requestMedia(media, owner);

    const agent = await loginAs('super@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });

    assert.strictEqual(res.status, 201);
  });

  it('rejects seasons supplied for a movie with 400', async () => {
    const user = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const media = await makeMovie(105);
    await requestMedia(media, user);

    const agent = await loginAs('req@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: media.id, seasons: [1] });

    assert.strictEqual(res.status, 400);
  });

  it('rejects an empty seasons array with 400', async () => {
    const user = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const show = await makeShow(106, [1, 2]);
    await requestMedia(show, user);

    const agent = await loginAs('req@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: show.id, seasons: [] });

    assert.strictEqual(res.status, 400);
  });

  it('rejects unknown season numbers with 400', async () => {
    const user = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const show = await makeShow(107, [1, 2]);
    await requestMedia(show, user);

    const agent = await loginAs('req@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: show.id, seasons: [5] });

    assert.strictEqual(res.status, 400);
  });

  it('rejects non-positive season numbers with 400', async () => {
    const user = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const show = await makeShow(108, [1, 2]);
    await requestMedia(show, user);

    const agent = await loginAs('req@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: show.id, seasons: [0] });

    assert.strictEqual(res.status, 400);
  });

  it('blocks a duplicate active request from the same user with 409', async () => {
    const user = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const media = await makeMovie(109);
    await requestMedia(media, user);

    const agent = await loginAs('req@seerr.dev');
    const first = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });
    assert.strictEqual(first.status, 201);

    const second = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });
    assert.strictEqual(second.status, 409);
  });
});

describe('POST /removal-request (auto-approve & execution)', () => {
  it('auto-approves and fully removes media for AUTO_APPROVE_REMOVAL users', async () => {
    const user = await makeUser(
      'auto@seerr.dev',
      Permission.REQUEST +
        Permission.REQUEST_REMOVAL +
        Permission.AUTO_APPROVE_REMOVAL
    );
    const media = await makeMovie(110);
    await requestMedia(media, user);

    const agent = await loginAs('auto@seerr.dev');
    const res = await agent
      .post('/removal-request')
      .send({ mediaId: media.id });

    assert.strictEqual(res.status, 201);
    // Sole requester consented, so the media should be fully removed.
    const stillExists = await getRepository(Media).findOne({
      where: { id: media.id },
    });
    assert.strictEqual(stillExists, null);
  });
});

describe('GET /removal-request (scoping)', () => {
  it('returns only the requesting user’s own requests for non-privileged users', async () => {
    const a = await makeUser(
      'a@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const b = await makeUser(
      'b@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const m1 = await makeMovie(120);
    const m2 = await makeMovie(121);
    await requestMedia(m1, a);
    await requestMedia(m2, b);
    const removalRepo = getRepository(MediaRemovalRequest);
    await removalRepo.save(
      new MediaRemovalRequest({
        media: m1,
        requestedBy: a,
        is4k: false,
        status: MediaRemovalRequestStatus.PENDING,
      })
    );
    await removalRepo.save(
      new MediaRemovalRequest({
        media: m2,
        requestedBy: b,
        is4k: false,
        status: MediaRemovalRequestStatus.PENDING,
      })
    );

    const agent = await loginAs('a@seerr.dev');
    const res = await agent.get('/removal-request');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.results.length, 1);
    assert.strictEqual(res.body.results[0].requestedBy.email, 'a@seerr.dev');
  });

  it('returns all requests for MANAGE_REQUESTS users', async () => {
    const a = await makeUser(
      'a@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const manager = await makeUser('mgr@seerr.dev', Permission.MANAGE_REQUESTS);
    const m1 = await makeMovie(122);
    await requestMedia(m1, a);
    await getRepository(MediaRemovalRequest).save(
      new MediaRemovalRequest({
        media: m1,
        requestedBy: a,
        is4k: false,
        status: MediaRemovalRequestStatus.PENDING,
      })
    );

    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.get('/removal-request');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.results.length, 1);
    void manager;
  });
});

describe('Approve / decline / retry (MANAGE_REQUESTS)', () => {
  async function seedPending(tmdbId: number) {
    const requester = await makeUser(
      'req@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    await makeUser('mgr@seerr.dev', Permission.MANAGE_REQUESTS);
    const media = await makeMovie(tmdbId);
    await requestMedia(media, requester);
    return getRepository(MediaRemovalRequest).save(
      new MediaRemovalRequest({
        media,
        requestedBy: requester,
        is4k: false,
        status: MediaRemovalRequestStatus.PENDING,
      })
    );
  }

  it('forbids non-managers from approving', async () => {
    const rr = await seedPending(130);
    const agent = await loginAs('req@seerr.dev');
    const res = await agent.post(`/removal-request/${rr.id}/approve`);
    assert.strictEqual(res.status, 403);
  });

  it('approves a pending request, executes removal, and records the actor', async () => {
    const rr = await seedPending(131);
    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.post(`/removal-request/${rr.id}/approve`);
    assert.strictEqual(res.status, 200);
    // Sole requester → media fully removed
    const media = await getRepository(Media).findOne({
      where: { tmdbId: 131 },
    });
    assert.strictEqual(media, null);
  });

  it('declines a pending request', async () => {
    const rr = await seedPending(132);
    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.post(`/removal-request/${rr.id}/decline`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, MediaRemovalRequestStatus.DECLINED);
  });

  it('rejects approving a non-pending request with 400', async () => {
    const rr = await seedPending(133);
    const repo = getRepository(MediaRemovalRequest);
    rr.status = MediaRemovalRequestStatus.DECLINED;
    await repo.save(rr);

    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.post(`/removal-request/${rr.id}/approve`);
    assert.strictEqual(res.status, 400);
  });

  it('only retries FAILED requests', async () => {
    const rr = await seedPending(134);
    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.post(`/removal-request/${rr.id}/retry`);
    assert.strictEqual(res.status, 400);
  });

  it('returns 404 when approving a missing request', async () => {
    await makeUser('mgr@seerr.dev', Permission.MANAGE_REQUESTS);
    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.post('/removal-request/999999/approve');
    assert.strictEqual(res.status, 404);
  });
});

describe('DELETE /removal-request/:id', () => {
  async function seedOwned(tmdbId: number, ownerEmail: string) {
    const owner = await makeUser(
      ownerEmail,
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const media = await makeMovie(tmdbId);
    await requestMedia(media, owner);
    return getRepository(MediaRemovalRequest).save(
      new MediaRemovalRequest({
        media,
        requestedBy: owner,
        is4k: false,
        status: MediaRemovalRequestStatus.PENDING,
      })
    );
  }

  it('allows the requester to delete their own request', async () => {
    const rr = await seedOwned(140, 'req@seerr.dev');
    const agent = await loginAs('req@seerr.dev');
    const res = await agent.delete(`/removal-request/${rr.id}`);
    assert.strictEqual(res.status, 204);
  });

  it('allows a MANAGE_REQUESTS user to delete any request', async () => {
    const rr = await seedOwned(141, 'req@seerr.dev');
    await makeUser('mgr@seerr.dev', Permission.MANAGE_REQUESTS);
    const agent = await loginAs('mgr@seerr.dev');
    const res = await agent.delete(`/removal-request/${rr.id}`);
    assert.strictEqual(res.status, 204);
  });

  it('forbids a different non-manager user from deleting', async () => {
    const rr = await seedOwned(142, 'req@seerr.dev');
    await makeUser(
      'intruder@seerr.dev',
      Permission.REQUEST + Permission.REQUEST_REMOVAL
    );
    const agent = await loginAs('intruder@seerr.dev');
    const res = await agent.delete(`/removal-request/${rr.id}`);
    assert.strictEqual(res.status, 403);
  });
});

describe('Multi-user co-removal consent', () => {
  it('keeps media until every requester has consented (partial → full)', async () => {
    const userA = await makeUser(
      'usera@seerr.dev',
      Permission.REQUEST +
        Permission.REQUEST_REMOVAL +
        Permission.AUTO_APPROVE_REMOVAL
    );
    const userB = await makeUser(
      'userb@seerr.dev',
      Permission.REQUEST +
        Permission.REQUEST_REMOVAL +
        Permission.AUTO_APPROVE_REMOVAL
    );
    const media = await makeMovie(150);
    await requestMedia(media, userA);
    await requestMedia(media, userB);

    // User A requests removal → only one of two requesters consents → partial
    const agentA = await loginAs('usera@seerr.dev');
    const resA = await agentA
      .post('/removal-request')
      .send({ mediaId: media.id });
    assert.strictEqual(resA.status, 201);
    assert.strictEqual(
      resA.body.status,
      MediaRemovalRequestStatus.PARTIALLY_REMOVED
    );
    const afterA = await getRepository(Media).findOne({
      where: { id: media.id },
    });
    assert.notStrictEqual(
      afterA,
      null,
      'media should survive until all consent'
    );

    // User B requests removal → all requesters consent → media fully removed
    const agentB = await loginAs('userb@seerr.dev');
    const resB = await agentB
      .post('/removal-request')
      .send({ mediaId: media.id });
    assert.strictEqual(resB.status, 201);
    const afterB = await getRepository(Media).findOne({
      where: { id: media.id },
    });
    assert.strictEqual(
      afterB,
      null,
      'media should be removed once all consent'
    );
  });

  it('does not let a 4K-only requester block full removal of the non-4K version', async () => {
    const userA = await makeUser(
      'usera@seerr.dev',
      Permission.REQUEST +
        Permission.REQUEST_REMOVAL +
        Permission.AUTO_APPROVE_REMOVAL
    );
    const userB = await makeUser('userb@seerr.dev', Permission.REQUEST);
    const media = await makeMovie(151, {
      status: MediaStatus.AVAILABLE,
      status4k: MediaStatus.AVAILABLE,
    });
    await requestMedia(media, userA, false); // A requested non-4K
    await requestMedia(media, userB, true); // B requested 4K only

    // A requests non-4K removal. Only non-4K requesters must consent (just A),
    // so the removal should proceed to full deletion despite B's 4K request.
    const agentA = await loginAs('usera@seerr.dev');
    const res = await agentA
      .post('/removal-request')
      .send({ mediaId: media.id, is4k: false });
    assert.strictEqual(res.status, 201);
    const after = await getRepository(Media).findOne({
      where: { id: media.id },
    });
    assert.strictEqual(after, null);
  });
});
