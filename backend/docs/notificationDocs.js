/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification APIs
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get User Notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
 *
 *   post:
 *     summary: Create Notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Notification created successfully
 */

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get Unread Notification Count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count fetched
 */

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark All Notifications As Read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get Notification By ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification fetched successfully
 *
 *   delete:
 *     summary: Delete Notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark Notification As Read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification marked as read
 */