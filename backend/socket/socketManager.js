// ─────────────────────────────────────────────────────────────────────────────
// socket/socketManager.js
// Core Socket.IO instance holder + user-socket map utilities
//
// Design decisions:
//  - Single source of truth: `io` is initialised once in server.js and stored here
//  - userSocketMap  → Map<userId:string, Set<socketId:string>>
//    One user can have multiple open tabs / devices; every socket is tracked.
//  - All helper functions are safe to call even before `io` is initialised
//    (they return gracefully) so controllers never need defensive checks.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

/** @type {import("socket.io").Server | null} */
let io = null;

/**
 * userId  →  Set<socketId>
 * Maintained entirely in memory. On server restart all clients must
 * reconnect (which they do automatically with socket.io-client).
 * @type {Map<string, Set<string>>}
 */
const userSocketMap = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// User ↔ Socket mapping
// ─────────────────────────────────────────────────────────────────────────────

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
  console.log(`🟢 [Socket] User ${uid} connected  | socket ${socketId} | total sockets: ${userSocketMap.get(uid).size}`);
};

/**
 * Remove a socket from the map.
 * Called on every "disconnect" event.
 * Cleans up the user entry entirely when the last socket disconnects.
 * @param {string} userId
 * @param {string} socketId
 */
const removeUserSocket = (userId, socketId) => {
  const uid = userId.toString();
  const sockets = userSocketMap.get(uid);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSocketMap.delete(uid);
    console.log(`🔴 [Socket] User ${uid} fully disconnected (no remaining sockets)`);
  } else {
    console.log(`🟡 [Socket] User ${uid} socket ${socketId} removed | remaining: ${sockets.size}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Public helper utilities
// ─────────────────────────────────────────────────────────────────────────────

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
    console.warn(`[Socket] sendNotificationToUser called before io was initialised (userId: ${userId})`);
    return false;
  }

  const socketIds = getSocketIdsForUser(userId);
  if (socketIds.length === 0) {
    console.log(`[Socket] User ${userId} is offline — notification not emitted in real-time`);
    return false;
  }

  socketIds.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });

  console.log(`📤 [Socket] Event "${event}" emitted to user ${userId} (${socketIds.length} socket(s))`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
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
};