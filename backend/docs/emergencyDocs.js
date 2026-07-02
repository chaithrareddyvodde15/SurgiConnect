/**
 * @swagger
 * tags:
 *   name: Emergency Requests
 *   description: Emergency Request Management APIs
 */

/**
 * @swagger
 * /api/emergency-requests:
 *   post:
 *     summary: Create Emergency Request
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Emergency created successfully
 *
 *   get:
 *     summary: Get All Emergency Requests
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Emergency requests fetched successfully
 */

/**
 * @swagger
 * /api/emergency-requests/{id}:
 *   get:
 *     summary: Get Emergency Request by ID
 *     tags: [Emergency Requests]
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
 *         description: Emergency fetched successfully
 *
 *   put:
 *     summary: Update Emergency Request
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Emergency updated successfully
 */

/**
 * @swagger
 * /api/emergency-requests/{id}/assign-doctors:
 *   patch:
 *     summary: Assign Doctors (Legacy)
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctors assigned successfully
 */

/**
 * @swagger
 * /api/emergency-requests/{id}/status:
 *   patch:
 *     summary: Update Emergency Status
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status updated successfully
 */

/**
 * @swagger
 * /api/emergency-requests/{id}/respond:
 *   post:
 *     summary: Doctor Respond to Emergency
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor response submitted
 */

/**
 * @swagger
 * /api/emergency-requests/{id}/confirm-doctor:
 *   patch:
 *     summary: Hospital Confirms Doctor
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor confirmed successfully
 */

/**
 * @swagger
 * /api/emergency-requests/{id}/start:
 *   patch:
 *     summary: Start Treatment
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Treatment started
 */

/**
 * @swagger
 * /api/emergency-requests/{id}/complete:
 *   patch:
 *     summary: Complete Treatment
 *     tags: [Emergency Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Treatment completed
 */