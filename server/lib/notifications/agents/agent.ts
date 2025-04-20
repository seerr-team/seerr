import type Issue from '@server/entity/Issue';
import type IssueComment from '@server/entity/IssueComment';
import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { User } from '@server/entity/User';
import {
  getSettings,
  type NotificationAgentConfig,
} from '@server/lib/settings';
import type { Notification } from '..';

export interface NotificationPayload {
  event?: string;
  subject: string;
  notifySystem: boolean;
  notifyAdmin: boolean;
  notifyUser?: User;
  media?: Media;
  image?: string;
  message?: string;
  extra?: { name: string; value: string }[];
  request?: MediaRequest;
  issue?: Issue;
  comment?: IssueComment;
  pendingRequestsCount?: number;
  isAdmin?: boolean;
}

export abstract class BaseAgent<T extends NotificationAgentConfig> {
  protected settings?: T;
  protected id: number;

  public constructor(id: number, settings?: T) {
    this.settings = settings;
    this.id = id;
  }

  protected getSettings(): NotificationAgentConfig {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    const notificationInstance = settings.notifications.instances.find(
      (instance) => instance.id === Number(this.id)
    );

    return notificationInstance as NotificationAgentConfig;
  }
}

export interface NotificationAgent {
  shouldSend(): boolean;
  send(type: Notification, payload: NotificationPayload): Promise<boolean>;
}
