import type { User } from '@server/entity/User';
import type { NotificationSettingsResultResponse } from '@server/interfaces/api/settingsInterfaces';
import type { NotificationAgentConfig } from '@server/interfaces/settings';
import notificationManager, {
  createAccordingNotificationAgent,
  Notification,
} from '@server/lib/notifications';
import type { NotificationAgent } from '@server/lib/notifications/agents/agent';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';

const notificationRoutes = Router();

const sendTestNotification = async (agent: NotificationAgent, user: User) =>
  await agent.send(Notification.TEST_NOTIFICATION, {
    notifySystem: true,
    notifyAdmin: false,
    notifyUser: user,
    subject: 'Test Notification',
    message: 'Check check, 1, 2, 3. Are we coming in clear?',
  });

const findFirstFreeNotificationInstanceId = () => {
  const instances = getSettings().notification.instances;

  for (let i = 0; i < instances.length; ++i) {
    if (!instances.find((instance) => instance.id === i)) {
      return i;
    }
  }

  return instances.length;
};

notificationRoutes.get('/', (req, res) => {
  const settings = getSettings();
  const instances = settings.notification.instances;

  const pageSize = req.query.take ? Number(req.query.take) : 10;
  const skip = req.query.skip ? Number(req.query.skip) : 0;

  let sortFunc: (
    a: NotificationAgentConfig,
    b: NotificationAgentConfig
  ) => number;
  switch (req.query.sort) {
    case 'name':
      sortFunc = (a, b) => a.name.localeCompare(b.name);
      break;

    case 'agent':
      sortFunc = (a, b) => a.agent.localeCompare(b.agent);
      break;

    default:
      sortFunc = (a, b) => (a.id || 0) - (b.id || 0);
  }

  const instancesResponse = instances
    .sort(sortFunc)
    .slice(skip, skip + pageSize);

  const notificationResponse: NotificationSettingsResultResponse = {
    results: instancesResponse,
    agentTemplates: settings.notification.agentTemplates,
    pageInfo: {
      pages: Math.ceil(instances.length / pageSize),
      pageSize,
      results: instances.length,
      page: Math.ceil(skip / pageSize) + 1,
    },
  };

  res.status(200).json(notificationResponse);
});

notificationRoutes.post('/', async (req, res, next) => {
  const settings = getSettings();
  const instances = settings.notification.instances;

  const notificationInstanceId = findFirstFreeNotificationInstanceId();

  const request = req.body;
  request.id = notificationInstanceId;

  const notificationAgent = createAccordingNotificationAgent(
    request,
    notificationInstanceId
  );

  if (!notificationAgent) {
    return next({
      status: 500,
      message: 'A valid agent is missing from the request.',
    });
  }

  notificationManager.registerAgent(notificationAgent);

  const notificationInstanceIndex = instances.length;
  instances[notificationInstanceIndex] = request;
  await settings.save();

  res.status(200).json(instances[notificationInstanceIndex]);
});

notificationRoutes.post('/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const notificationAgent = createAccordingNotificationAgent(req.body);
  if (!notificationAgent) {
    return next({
      status: 500,
      message: 'A valid agent is missing from the request.',
    });
  }

  if (await sendTestNotification(notificationAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: `Failed to send ${req.body.agent} test notification.`,
    });
  }
});

notificationRoutes.get<{ id: string }>('/:id', (req, res, next) => {
  const settings = getSettings();

  const notificationInstance = settings.notification.instances.find(
    (instance) => instance.id === Number(req.params.id)
  );

  if (!notificationInstance) {
    return next({ status: '404', message: 'Notifications instance not found' });
  }

  res.status(200).json(notificationInstance);
});

notificationRoutes.post<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();
  const instances = settings.notification.instances;

  const notificationInstanceId = Number(req.params.id);
  let notificationInstanceIndex = instances.findIndex(
    (instance) => instance.id === notificationInstanceId
  );

  const request = req.body;
  request.id = notificationInstanceId;

  // instance was not found -> register new one with new id
  if (notificationInstanceIndex === -1) {
    const notificationAgent = createAccordingNotificationAgent(
      request,
      notificationInstanceId
    );

    if (!notificationAgent) {
      return next({
        status: 500,
        message: 'A valid agent is missing from the request.',
      });
    }

    notificationManager.registerAgent(notificationAgent);

    notificationInstanceIndex = instances.length;
  }
  // agent has changed -> reregister
  else if (instances[notificationInstanceIndex].agent !== request.agent) {
    const notificationAgent = createAccordingNotificationAgent(
      request,
      notificationInstanceId
    );

    if (!notificationAgent) {
      return next({
        status: 500,
        message: 'A valid agent is missing from the request.',
      });
    }

    notificationManager.reregisterAgent(
      notificationAgent,
      notificationInstanceId
    );
  }

  instances[notificationInstanceIndex] = request;

  await settings.save();

  res.status(200).json(instances[notificationInstanceIndex]);
});

notificationRoutes.delete<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();
  const instances = settings.notification.instances;

  const notificationInstanceIndex = instances.findIndex(
    (instance) => instance.id === Number(req.params.id)
  );

  if (notificationInstanceIndex === -1) {
    return next({ status: 404, message: 'Notifications instance not found' });
  }

  instances.splice(notificationInstanceIndex, 1);
  notificationManager.unregisterAgent(Number(req.params.id));

  await settings.save();

  res.status(200).send();
});

export default notificationRoutes;
