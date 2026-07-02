/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient APIs
 */

/**
 * @swagger
 * /api/patients/me:
 *   get:
 *     summary: Get logged in patient profile
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile fetched successfully
 *
 *   patch:
 *     summary: Update logged in patient profile
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile updated successfully
 */

/**
 * @swagger
 * /api/patients/{id}:
 *   get:
 *     summary: Get patient by ID
 *     tags: [Patients]
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
 *         description: Patient fetched successfully
 */