const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "SurgiConnect API",
      version: "1.0.0",
      description:
        "REST API documentation for SurgiConnect - AI Powered Emergency Doctor Coordination Platform",
      contact: {
        name: "Chaithra Reddy",
        email: "chaithrareddyvodde15@gmail.com",
      },
    },

    servers: [
      {
        url: "http://localhost:5000",
        description: "Local Development Server",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },

    security: [
      {
        bearerAuth: [],
      },
    ],
  },

 apis: [
  "./routes/*.js",
  "./docs/authDocs.js",
  "./docs/doctorDocs.js",
  "./docs/hospitalDocs.js",
  "./docs/patientDocs.js",
  "./docs/emergencyDocs.js",
  "./docs/assignmentDocs.js",
  "./docs/notificationDocs.js",
  "./docs/auditDocs.js",
  "./docs/dashboardDocs.js",
  "./docs/aiDocs.js",
],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;