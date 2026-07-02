/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: Audit Log APIs
 */

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get All Audit Logs
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit logs fetched successfully
 *
 *   post:
 *     summary: Create Audit Log
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Audit log created successfully
 */

/**
 * @swagger
 * /api/audit-logs/recent:
 *   get:
 *     summary: Get Recent Audit Activity
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent audit activity
 */

/**
 * @swagger
 * /api/audit-logs/user/{userId}:
 *   get:
 *     summary: Get Logs By User
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User audit logs
 */

/**
 * @swagger
 * /api/audit-logs/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get Logs By Entity
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Entity audit logs
 */

/**
 * @swagger
 * /api/audit-logs/{id}:
 *   get:
 *     summary: Get Audit Log By ID
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log fetched successfully
 */