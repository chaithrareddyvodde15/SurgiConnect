/**
 * @swagger
 * tags:
 *   name: Doctor Assignments
 *   description: Doctor Assignment APIs
 */

/**
 * @swagger
 * /api/assignments/{requestId}/assign:
 *   post:
 *     summary: Assign Doctors to Emergency
 *     tags: [Doctor Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doctors assigned successfully
 */

/**
 * @swagger
 * /api/assignments/{requestId}/doctors:
 *   get:
 *     summary: Get Assigned Doctors
 *     tags: [Doctor Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assigned doctors fetched successfully
 */

/**
 * @swagger
 * /api/assignments/{requestId}/doctors/{doctorId}:
 *   delete:
 *     summary: Unassign Doctor
 *     tags: [Doctor Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doctor unassigned successfully
 */

/**
 * @swagger
 * /api/assignments/doctor/{doctorId}:
 *   get:
 *     summary: Get Emergencies Assigned to Doctor
 *     tags: [Doctor Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Emergencies fetched successfully
 */