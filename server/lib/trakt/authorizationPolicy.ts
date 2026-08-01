import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import type { EntityManager, Repository } from 'typeorm';

export type TraktAuthorizationDecision =
  | { allowed: true; actor: User; target: User }
  | {
      allowed: false;
      reason: 'invalid_state' | 'target_missing' | 'actor_not_authorized';
    };

class TraktAuthorizationPolicy {
  public async resolve(
    actorUserId: number,
    targetUserId: number | null | undefined,
    manager?: EntityManager
  ): Promise<TraktAuthorizationDecision> {
    const userRepo = this.getUserRepository(manager);
    const [actor, target] = await Promise.all([
      userRepo.findOneBy({ id: actorUserId }),
      targetUserId === null || targetUserId === undefined
        ? null
        : userRepo.findOneBy({ id: targetUserId }),
    ]);
    return this.evaluate(actor, target);
  }

  public async resolveActorFirst(
    actorUserId: number,
    targetUserId: number | null | undefined,
    manager?: EntityManager
  ): Promise<TraktAuthorizationDecision> {
    const userRepo = this.getUserRepository(manager);
    const actor = await userRepo.findOneBy({ id: actorUserId });
    if (!actor) {
      return { allowed: false, reason: 'invalid_state' };
    }
    if (targetUserId === null || targetUserId === undefined) {
      return { allowed: false, reason: 'target_missing' };
    }
    const target = await userRepo.findOneBy({ id: targetUserId });
    return this.evaluate(actor, target);
  }

  private getUserRepository(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : getRepository(User);
  }

  private evaluate(
    actor: User | null,
    target: User | null
  ): TraktAuthorizationDecision {
    if (!actor) {
      return { allowed: false, reason: 'invalid_state' };
    }
    if (!target) {
      return { allowed: false, reason: 'target_missing' };
    }
    if (actor.id !== target.id && !actor.hasPermission(Permission.ADMIN)) {
      return { allowed: false, reason: 'actor_not_authorized' };
    }
    return { allowed: true, actor, target };
  }
}

export const traktAuthorizationPolicy = new TraktAuthorizationPolicy();
