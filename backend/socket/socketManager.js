// ─────────────────────────────────────────────────────────────────────────────
// socket/socketManager.js
//
// Core Socket.IO instance holder + user-socket map utilities.
//
// Design decisions (unchanged from original):
//   - Single source of truth: `io` is initialised once in server.js
//   - userSocketMap → Map<userId:string, Set<socketId:string>>
//     One user can have multiple open tabs / devices; every socket is tracked
//   - All helpers are safe to call before `io` is initialised (return gracefully)
//
// What changed:
//   - Added `emitToSpecialization(specialization, event, payload, Doctor)`
//     This is the only addition. Everything else is 100% identical to the
//     original file.
//
//     Context: when a hospital creates an emergency request, the controller
//     needs to emit `emergency:new` only to doctors whose specialization
//     matches the required one. Rather than duplicating the Doctor model
//     query inside every caller, this helper is the single place that knows
//     how to map specialization → online userIds → socket delivery.
//
//     The Doctor model is passed as a parameter (not imported here) to keep
//     this file free of Mongoose dependencies — the same pattern used for
//     `sendNotificationToUser`, which also does not query the DB itself.
//     If you prefer to import Doctor here directly, that works too.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

/** @type {import("socket.io").Server | null} */
let io = null;

/**
 * userId  →  Set<socketId>
 * @type {Map<string, Set<string>>}
 */
const userSocketMap = new Map();

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────

/**
 * Store the Socket.IO server instance.
 * Called once from server.js after `new Server(httpServer, …)`.
 * @param {import("socket.io").Server} ioInstance
 */
const initSocketManager = (ioInstance) => {
  io = ioInstance;
  console.log("✅ SocketManager initialised");
};

/**
 * Retrieve the Socket.IO server instance.
 * Returns null if called before initSocketManager().
 * @returns {import("socket.io").Server | null}
 */
const getIO = () => io;

// ─────────────────────────────────────────────
// User ↔ Socket mapping
// ─────────────────────────────────────────────

/**
 * Register a socket for a user.
 * Called on every "connection" event.
 * @param {string} userId
 * @param {string} socketId
 */
const registerUserSocket = (userId, socketId) => {
  const uid = userId.toString();
  if (!userSocketMap.has(uid)) {
    userSocketMap.set(uid, new Set());
  }
  userSocketMap.get(uid).add(socketId);
  console.log(
    `🟢 [Socket] User ${uid} connected  | socket ${socketId} | ` +
    `total sockets: ${userSocketMap.get(uid).size}`
  );
};

/**
 * Remove a socket from the map.
 * Cleans up the user entry entirely when the last socket disconnects.
 * @param {string} userId
 * @param {string} socketId
 */
const removeUserSocket = (userId, socketId) => {
  const uid     = userId.toString();
  const sockets = userSocketMap.get(uid);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSocketMap.delete(uid);
    console.log(`🔴 [Socket] User ${uid} fully disconnected (no remaining sockets)`);
  } else {
    console.log(
      `🟡 [Socket] User ${uid} socket ${socketId} removed | ` +
      `remaining: ${sockets.size}`
    );
  }
};

/**
 * Retrieve all socket IDs for a user (returns empty array when offline).
 * @param {string} userId
 * @returns {string[]}
 */
const getSocketIdsForUser = (userId) => {
  const sockets = userSocketMap.get(userId.toString());
  return sockets ? Array.from(sockets) : [];
};

// ─────────────────────────────────────────────
// Public helper utilities
// ─────────────────────────────────────────────

/**
 * Check whether a user has at least one active socket connection.
 * @param {string} userId
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  const sockets = userSocketMap.get(userId.toString());
  return !!(sockets && sockets.size > 0);
};

/**
 * Return a snapshot of all currently online users.
 * @returns {{ userId: string, socketCount: number }[]}
 */
const getOnlineUsers = () =>
  Array.from(userSocketMap.entries()).map(([userId, sockets]) => ({
    userId,
    socketCount: sockets.size,
  }));

/**
 * Emit a real-time event to all active sockets of a specific user.
 * Safe to call when the user is offline — emits nothing, returns false.
 *
 * @param {string}  userId   – MongoDB ObjectId as string
 * @param {string}  event    – Socket.IO event name
 * @param {object}  payload  – data to send
 * @returns {boolean}        – true if at least one socket was targeted
 */
const sendNotificationToUser = (userId, event, payload) => {
  if (!io) {
    console.warn(
      `[Socket] sendNotificationToUser called before io was initialised ` +
      `(userId: ${userId})`
    );
    return false;
  }

  const socketIds = getSocketIdsForUser(userId);
  if (socketIds.length === 0) {
    console.log(
      `[Socket] User ${userId} is offline — notification not emitted in real-time`
    );
    return false;
  }

  socketIds.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });

  console.log(
    `📤 [Socket] Event "${event}" emitted to user ${userId} ` +
    `(${socketIds.length} socket(s))`
  );
  return true;
};

/**
 * Broadcast an event to ALL connected clients.
 * Use sparingly — reserved for system-wide announcements.
 * @param {string} event
 * @param {object} payload
 */
const broadcastToAll = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
  console.log(`📢 [Socket] Broadcast "${event}" sent to all clients`);
};

// ─────────────────────────────────────────────
// NEW: Specialization-targeted broadcast
// ─────────────────────────────────────────────

/**
 * Emit an event to all currently-online doctors whose specialization
 * matches the given value.
 *
 * Usage (inside emergencyRequestController):
 *
 *   const Doctor = require("../models/doctorModel");
 *   const { emitToSpecialization } = require("../socket/socketManager");
 *
 *   await emitToSpecialization(
 *     "Cardiology",
 *     "emergency:new",
 *     { emergencyId: "...", severity: "Critical", ... },
 *     Doctor
 *   );
 *
 * This helper is intentionally kept lightweight:
 *   - It does NOT create Notification documents (that is the controller's job)
 *   - It only emits to doctors who are currently online
 *   - Offline doctors receive the notification when they poll the Notification API
 *
 * Design note: the Doctor model is passed as a parameter so this file remains
 * free of Mongoose model imports. The controller owns the DB query; this
 * function owns the socket delivery loop.
 *
 * @param {string}   specialization  – e.g. "Cardiology"
 * @param {string}   event           – Socket.IO event name
 * @param {object}   payload         – data to emit
 * @param {object}   DoctorModel     – Mongoose Doctor model (passed from caller)
 * @returns {Promise<{ emitted: number, offline: number, total: number }>}
 */
const emitToSpecialization = async (specialization, event, payload, DoctorModel) => {
  if (!io) {
    console.warn(
      `[Socket] emitToSpecialization called before io was initialised ` +
      `(specialization: ${specialization})`
    );
    return { emitted: 0, offline: 0, total: 0 };
  }

  let doctors;
  try {
    doctors = await DoctorModel.find({
      specialization,
      verified:     true,
      availability: { $in: ["Available", "On-Call"] },
    })
      .select("userId")
      .lean();
  } catch (err) {
    console.error("[Socket] emitToSpecialization — DB query failed:", err.message);
    return { emitted: 0, offline: 0, total: 0 };
  }

  let emitted = 0;
  let offline = 0;

  for (const doc of doctors) {
    if (!doc.userId) continue;
    const delivered = sendNotificationToUser(doc.userId.toString(), event, payload);
    if (delivered) {
      emitted++;
    } else {
      offline++;
    }
  }

  console.log(
    `📡 [Socket] emitToSpecialization "${specialization}" | ` +
    `event: "${event}" | emitted: ${emitted} | offline: ${offline} | ` +
    `total doctors queried: ${doctors.length}`
  );

  return { emitted, offline, total: doctors.length };
};

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────
module.exports = {
  initSocketManager,
  getIO,
  registerUserSocket,
  removeUserSocket,
  getSocketIdsForUser,
  isUserOnline,
  getOnlineUsers,
  sendNotificationToUser,
  broadcastToAll,
  emitToSpecialization, // NEW — exported for use in emergencyRequestController
};