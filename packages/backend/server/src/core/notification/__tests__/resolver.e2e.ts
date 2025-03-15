import { randomUUID } from 'node:crypto';

import test from 'ava';

import {
  acceptInviteById,
  createTestingApp,
  createWorkspace,
  getNotificationCount,
  inviteUser,
  listNotifications,
  mentionUser,
  readNotification,
  TestingApp,
} from '../../../__tests__/utils';
import { DocMode, Models, NotificationType } from '../../../models';
import { MentionNotificationBodyType, NotificationObjectType } from '../types';

let app: TestingApp;
let models: Models;

test.before(async () => {
  app = await createTestingApp();
  models = app.get(Models);
});

test.after.always(async () => {
  await app.close();
});

test('should mention user in a doc', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  await models.workspace.update(workspace.id, {
    name: 'test-workspace-name',
    avatarKey: 'test-avatar-key',
  });
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const mentionId = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-1',
      title: 'doc-title-1',
      blockId: 'block-id-1',
      mode: DocMode.page,
    },
  });
  t.truthy(mentionId);
  // mention user at another doc
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-2',
      title: 'doc-title-2',
      elementId: 'element-id-2',
      mode: DocMode.edgeless,
    },
  });

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  t.is(result.totalCount, 2);
  const notifications = result.edges.map(edge => edge.node);
  t.is(notifications.length, 2);

  const notification = notifications[1] as NotificationObjectType;
  t.is(notification.read, false);
  t.truthy(notification.createdAt);
  t.truthy(notification.updatedAt);
  const body = notification.body as MentionNotificationBodyType;
  t.is(body.workspace!.id, workspace.id);
  t.is(body.doc.id, 'doc-id-1');
  t.is(body.doc.title, 'doc-title-1');
  t.is(body.doc.blockId, 'block-id-1');
  t.is(body.doc.mode, DocMode.page);
  t.is(body.createdByUser!.id, owner.id);
  t.is(body.createdByUser!.name, owner.name);
  t.is(body.workspace!.id, workspace.id);
  t.is(body.workspace!.name, 'test-workspace-name');
  t.truthy(body.workspace!.avatarUrl);

  const notification2 = notifications[0] as NotificationObjectType;
  t.is(notification2.read, false);
  t.truthy(notification2.createdAt);
  t.truthy(notification2.updatedAt);
  const body2 = notification2.body as MentionNotificationBodyType;
  t.is(body2.workspace!.id, workspace.id);
  t.is(body2.doc.id, 'doc-id-2');
  t.is(body2.doc.title, 'doc-title-2');
  t.is(body2.doc.elementId, 'element-id-2');
  t.is(body2.doc.mode, DocMode.edgeless);
  t.is(body2.createdByUser!.id, owner.id);
  t.is(body2.workspace!.id, workspace.id);
  t.is(body2.workspace!.name, 'test-workspace-name');
  t.truthy(body2.workspace!.avatarUrl);
});

test('should mention doc mode support string value', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  await models.workspace.update(workspace.id, {
    name: 'test-workspace-name',
    avatarKey: 'test-avatar-key',
  });
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const mentionId = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-1',
      title: 'doc-title-1',
      blockId: 'block-id-1',
      mode: 'page' as DocMode,
    },
  });
  t.truthy(mentionId);

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  t.is(result.totalCount, 1);
  const notifications = result.edges.map(edge => edge.node);
  t.is(notifications.length, 1);

  const notification = notifications[0] as NotificationObjectType;
  t.is(notification.read, false);
  t.truthy(notification.createdAt);
  t.truthy(notification.updatedAt);
  const body = notification.body as MentionNotificationBodyType;
  t.is(body.workspace!.id, workspace.id);
  t.is(body.doc.id, 'doc-id-1');
  t.is(body.doc.title, 'doc-title-1');
  t.is(body.doc.blockId, 'block-id-1');
  t.is(body.doc.mode, DocMode.page);
  t.is(body.createdByUser!.id, owner.id);
  t.is(body.createdByUser!.name, owner.name);
  t.is(body.workspace!.id, workspace.id);
  t.is(body.workspace!.name, 'test-workspace-name');
  t.truthy(body.workspace!.avatarUrl);
});

test('should throw error when mention user has no Doc.Read role', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);

  await app.switchUser(owner);
  const docId = randomUUID();
  await t.throwsAsync(
    mentionUser(app, {
      userId: member.id,
      workspaceId: workspace.id,
      doc: {
        id: docId,
        title: 'doc-title-1',
        blockId: 'block-id-1',
        mode: DocMode.page,
      },
    }),
    {
      message: `Mentioned user can not access doc ${docId}.`,
    }
  );
});

test('should throw error when mention a not exists user', async t => {
  const owner = await app.signup();
  const workspace = await createWorkspace(app);
  await app.switchUser(owner);
  const docId = randomUUID();
  await t.throwsAsync(
    mentionUser(app, {
      userId: 'user-id-not-exists',
      workspaceId: workspace.id,
      doc: {
        id: docId,
        title: 'doc-title-1',
        blockId: 'block-id-1',
        mode: DocMode.page,
      },
    }),
    {
      message: `Mentioned user can not access doc ${docId}.`,
    }
  );
});

test('should not mention user oneself', async t => {
  const owner = await app.signup();
  const workspace = await createWorkspace(app);
  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: owner.id,
      workspaceId: workspace.id,
      doc: {
        id: 'doc-id-1',
        title: 'doc-title-1',
        blockId: 'block-id-1',
        mode: DocMode.page,
      },
    }),
    {
      message: 'You can not mention yourself.',
    }
  );
});

test('should mark notification as read', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const mentionId = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-1',
      title: 'doc-title-1',
      blockId: 'block-id-1',
      mode: DocMode.page,
    },
  });
  t.truthy(mentionId);

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  t.is(result.totalCount, 1);

  const notifications = result.edges.map(edge => edge.node);
  const notification = notifications[0] as NotificationObjectType;
  t.is(notification.read, false);

  await readNotification(app, notification.id);

  const count = await getNotificationCount(app);
  t.is(count, 0);

  // read again should work
  await readNotification(app, notification.id);
});

test('should throw error when read the other user notification', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const mentionId = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-1',
      title: 'doc-title-1',
      blockId: 'block-id-1',
      mode: DocMode.page,
    },
  });
  t.truthy(mentionId);

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  const notifications = result.edges.map(edge => edge.node);
  const notification = notifications[0] as NotificationObjectType;
  t.is(notification.read, false);

  await app.switchUser(owner);
  await t.throwsAsync(readNotification(app, notification.id), {
    message: 'Notification not found.',
  });
  // notification not exists
  await t.throwsAsync(readNotification(app, 'notification-id-not-exists'), {
    message: 'Notification not found.',
  });
});

test('should throw error when mention call with invalid params', async t => {
  const owner = await app.signup();
  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: '',
      workspaceId: '',
      doc: {
        id: '',
        title: 'doc-title-1'.repeat(100),
        blockId: '',
        mode: DocMode.page,
      },
    }),
    {
      message: /Validation error/,
    }
  );
});

test('should throw error when mention mode value is invalid', async t => {
  const owner = await app.signup();
  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: randomUUID(),
      workspaceId: randomUUID(),
      doc: {
        id: randomUUID(),
        title: 'doc-title-1',
        blockId: 'block-id-1',
        mode: 'invalid-mode' as DocMode,
      },
    }),
    {
      message:
        'Variable "$input" got invalid value "invalid-mode" at "input.doc.mode"; Value "invalid-mode" does not exist in "DocMode" enum.',
    }
  );
});

test('should list and count notifications', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 10,
      offset: 0,
    });
    const notifications = result.edges.map(edge => edge.node);
    t.is(notifications.length, 0);
    t.is(result.totalCount, 0);
  }

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  await models.workspace.update(workspace.id, {
    name: 'test-workspace-name1',
    avatarKey: 'test-avatar-key1',
  });
  const inviteId = await inviteUser(app, workspace.id, member.email);
  const workspace2 = await createWorkspace(app);
  await models.workspace.update(workspace2.id, {
    name: 'test-workspace-name2',
    avatarKey: 'test-avatar-key2',
  });
  const inviteId2 = await inviteUser(app, workspace2.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);
  await acceptInviteById(app, workspace2.id, inviteId2);

  await app.switchUser(owner);
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-1',
      title: 'doc-title-1',
      blockId: 'block-id-1',
      mode: DocMode.page,
    },
  });
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-2',
      title: 'doc-title-2',
      blockId: 'block-id-2',
      mode: DocMode.page,
    },
  });
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    doc: {
      id: 'doc-id-3',
      title: 'doc-title-3',
      blockId: 'block-id-3',
      mode: DocMode.page,
    },
  });
  // mention user in another workspace
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace2.id,
    doc: {
      id: 'doc-id-4',
      title: 'doc-title-4',
      blockId: 'block-id-4',
      mode: DocMode.page,
    },
  });

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 10,
      offset: 0,
    });
    const notifications = result.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications.length, 4);
    t.is(result.totalCount, 4);

    const notification = notifications[0];
    t.is(notification.read, false);
    const body = notification.body as MentionNotificationBodyType;
    t.is(body.type, NotificationType.Mention);
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.doc.id, 'doc-id-4');
    t.is(body.doc.title, 'doc-title-4');
    t.is(body.doc.blockId, 'block-id-4');
    t.is(body.createdByUser!.id, owner.id);
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.workspace!.name, 'test-workspace-name2');
    t.truthy(body.workspace!.avatarUrl);

    const notification2 = notifications[1];
    t.is(notification2.read, false);
    const body2 = notification2.body as MentionNotificationBodyType;
    t.is(body2.type, NotificationType.Mention);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.doc.id, 'doc-id-3');
    t.is(body2.doc.title, 'doc-title-3');
    t.is(body2.doc.blockId, 'block-id-3');
    t.is(body2.createdByUser!.id, owner.id);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.workspace!.name, 'test-workspace-name1');
    t.truthy(body2.workspace!.avatarUrl);
  }

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 10,
      offset: 2,
    });
    t.is(result.totalCount, 4);
    t.is(result.pageInfo.hasNextPage, false);
    t.is(result.pageInfo.hasPreviousPage, true);
    const notifications = result.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications.length, 2);

    const notification = notifications[0];
    t.is(notification.read, false);
    const body = notification.body as MentionNotificationBodyType;
    t.is(body.workspace!.id, workspace.id);
    t.is(body.doc.id, 'doc-id-2');
    t.is(body.doc.title, 'doc-title-2');
    t.is(body.doc.blockId, 'block-id-2');
    t.is(body.createdByUser!.id, owner.id);
    t.is(body.workspace!.id, workspace.id);
    t.is(body.workspace!.name, 'test-workspace-name1');
    t.truthy(body.workspace!.avatarUrl);

    const notification2 = notifications[1];
    t.is(notification2.read, false);
    const body2 = notification2.body as MentionNotificationBodyType;
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.doc.id, 'doc-id-1');
    t.is(body2.doc.title, 'doc-title-1');
    t.is(body2.doc.blockId, 'block-id-1');
    t.is(body2.createdByUser!.id, owner.id);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.workspace!.name, 'test-workspace-name1');
    t.truthy(body2.workspace!.avatarUrl);
  }

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 2,
      offset: 0,
    });
    t.is(result.totalCount, 4);
    t.is(result.pageInfo.hasNextPage, true);
    t.is(result.pageInfo.hasPreviousPage, false);
    const notifications = result.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications.length, 2);

    const notification = notifications[0];
    t.is(notification.read, false);
    const body = notification.body as MentionNotificationBodyType;
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.doc.id, 'doc-id-4');
    t.is(body.doc.title, 'doc-title-4');
    t.is(body.doc.blockId, 'block-id-4');
    t.is(body.createdByUser!.id, owner.id);
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.workspace!.name, 'test-workspace-name2');
    t.truthy(body.workspace!.avatarUrl);
    t.is(
      notification.createdAt.toString(),
      Buffer.from(result.pageInfo.startCursor!, 'base64').toString('utf-8')
    );
    const notification2 = notifications[1];
    t.is(notification2.read, false);
    const body2 = notification2.body as MentionNotificationBodyType;
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.doc.id, 'doc-id-3');
    t.is(body2.doc.title, 'doc-title-3');
    t.is(body2.doc.blockId, 'block-id-3');
    t.is(body2.createdByUser!.id, owner.id);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.workspace!.name, 'test-workspace-name1');
    t.truthy(body2.workspace!.avatarUrl);

    await app.switchUser(owner);
    await mentionUser(app, {
      userId: member.id,
      workspaceId: workspace.id,
      doc: {
        id: 'doc-id-5',
        title: 'doc-title-5',
        blockId: 'block-id-5',
        mode: DocMode.page,
      },
    });

    // get new notifications
    await app.switchUser(member);
    const result2 = await listNotifications(app, {
      first: 2,
      offset: 0,
      after: result.pageInfo.startCursor,
    });
    t.is(result2.totalCount, 5);
    t.is(result2.pageInfo.hasNextPage, false);
    t.is(result2.pageInfo.hasPreviousPage, true);
    const notifications2 = result2.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications2.length, 1);

    const notification3 = notifications2[0];
    t.is(notification3.read, false);
    const body3 = notification3.body as MentionNotificationBodyType;
    t.is(body3.workspace!.id, workspace.id);
    t.is(body3.doc.id, 'doc-id-5');
    t.is(body3.doc.title, 'doc-title-5');
    t.is(body3.doc.blockId, 'block-id-5');
    t.is(body3.createdByUser!.id, owner.id);
    t.is(body3.createdByUser!.name, owner.name);
    t.is(body3.workspace!.id, workspace.id);
    t.is(body3.workspace!.name, 'test-workspace-name1');
    t.truthy(body3.workspace!.avatarUrl);

    // no new notifications
    const result3 = await listNotifications(app, {
      first: 2,
      offset: 0,
      after: result2.pageInfo.startCursor,
    });
    t.is(result3.totalCount, 5);
    t.is(result3.pageInfo.hasNextPage, false);
    t.is(result3.pageInfo.hasPreviousPage, true);
    t.is(result3.pageInfo.startCursor, null);
    t.is(result3.pageInfo.endCursor, null);
    t.is(result3.edges.length, 0);
  }
});
