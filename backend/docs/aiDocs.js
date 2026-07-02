/**
 * @swagger
 * tags:
 *   name: AI Recommendations
 *   description: AI Recommendation APIs
 */

/**
 * @swagger
 * /api/ai-recommendations/recommend:
 *   post:
 *     summary: Generate AI Recommendation
 *     tags: [AI Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI recommendation generated
 */

/**
 * @swagger
 * /api/ai-recommendations/preview:
 *   post:
 *     summary: Preview AI Recommendation
 *     tags: [AI Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI recommendation preview
 */

/**
 * @swagger
 * /api/ai-recommendations/refresh/{emergencyRequestId}:
 *   patch:
 *     summary: Refresh AI Recommendation
 *     tags: [AI Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI recommendation refreshed
 */

/**
 * @swagger
 * /api/ai-recommendations/doctors/{emergencyRequestId}:
 *   get:
 *     summary: Get Matching Doctors
 *     tags: [AI Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Matching doctors fetched
 */

/**
 * @swagger
 * /api/ai-recommendations/{emergencyRequestId}:
 *   get:
 *     summary: Get Stored Recommendation
 *     tags: [AI Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recommendation fetched
 */