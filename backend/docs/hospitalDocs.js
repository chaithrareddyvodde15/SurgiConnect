/**
 * @swagger
 * tags:
 *   name: Hospitals
 *   description: Hospital Management APIs
 */

/**
 * @swagger
 * /api/hospitals/profile:
 *   get:
 *     summary: Get logged in hospital profile
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospital profile fetched successfully
 *
 *   patch:
 *     summary: Update logged in hospital profile
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospital profile updated successfully
 */

/**
 * @swagger
 * /api/hospitals:
 *   post:
 *     summary: Create hospital
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Hospital created successfully
 *
 *   get:
 *     summary: Get all hospitals
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospitals fetched successfully
 */

/**
 * @swagger
 * /api/hospitals/{id}:
 *   get:
 *     summary: Get hospital by ID
 *     tags: [Hospitals]
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
 *         description: Hospital fetched successfully
 *
 *   put:
 *     summary: Update hospital
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospital updated successfully
 *
 *   delete:
 *     summary: Delete hospital
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hospital deleted successfully
 */

/**
 * @swagger
 * /api/hospitals/{id}/assign-manager:
 *   patch:
 *     summary: Assign manager to hospital
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Manager assigned successfully
 */