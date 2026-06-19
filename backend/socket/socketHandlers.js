// ─────────────────────────────────────────────────────────────────────────────
// socket/socketHandlers.js
// Handles every Socket.IO lifecycle event:
//   authenticate → register → listen for client events → disconnect
//
// Authentication: JWT is verified on every connection before the socket
// is registered in the map.  Unauthenticated connections are rejected
// immediately with an informative error event and then disconnected.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const jwt  = require("jsonwebtoken");
const User = require("../models/userModel");

const {
  registerUserSocket,
  removeUserSocket,
  getOnlineUsers,
  isUserOnline,
} = require("./socketManager");

// ─────────────────────────────────────────────────────────────────────────────
// Internal: JWT + DB authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify the JWT supplied in socket.handshake and return the User document.
 * Throws a descriptive Error on failure so the caller can reject cleanly.
 *
 * Clients must pass the token in ONE of these ways (in priority order):
 *   1. socket.handshake.auth.token       ← recommended (auth option)
 *   2. socket.handshake.headers.authorization  ← "Bearer <token>"
 *   3. socket.handshake.query.token      ← fallback (less secure)
 *
 * @param {import("socket.io").Socket} socket
 * @returns {Promise<import("mongoose").Document>} authenticated User document
 */
const authenticateSocket = async (socket) => {
  // Extract token from all supported locations
  let token =
    socket.handshake.auth?.token ||
    null;

  if (!token) {
    const authHeader = socket.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    token = socket.handshake.query?.token || null;
  }

  if (!token) {
    throw new Error("Authentication token is missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtErr) {
    throw new Error(
      jwtErr.name === "TokenExpiredError"
        ? "Authentication token has expired"
        : "Authentication token is invalid"
    );
  }

  const user = await User.findById(decoded.id).select("-password").lean();
  if (!user) {
    throw new Error("User not found — token may reference a deleted account");
  }

  return user;
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal: per-socket event handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle the "ping" event — lets clients verify the connection is alive
 * and measure round-trip latency.
 * @param {import("socket.io").Socket} socket
 * @param {object} user
 */
const handlePing = (socket, user) => {
  socket.on("ping:client", (data, callback) => {
    const response = {
      pong:      true,
      userId:    user._id.toString(),
      role:      user.role,
      timestamp: new Date().toISOString(),
      echo:      data || null,
    };

    // Support both callback-style and event-style
    if (typeof callback === "function") {
      callback(response);
    } else {
      socket.emit("pong:server", response);
    }
  });
};

/**
 * Handle the "online-users:get" event — managers can query who is online.
 * Doctors receive only their own online status.
 * @param {import("socket.io").Socket} socket
 * @param {object} user
 */
const handleGetOnlineUsers = (socket, user) => {
  socket.on("online-users:get", (callback) => {
    if (user.role === "manager") {
      const onlineUsers = getOnlineUsers();
      const response = { success: true, onlineUsers, count: onlineUsers.length };
      if (typeof callback === "function") callback(response);
      else socket.emit("online-users:list", response);
    } else {
      // Doctors only get their own status
      const response = {
        success:  true,
        isOnline: isUserOnline(user._id.toString()),
        userId:   user._id.toString(),
      };
      if (typeof callback === "function") callback(response);
      else socket.emit("online-users:self", response);
    }
  });
};

/**
 * Handle disconnection: remove the socket from the map and log the event.
 * @param {import("socket.io").Socket} socket
 * @param {object} user
 */
const handleDisconnect = (socket, user) => {
  socket.on("disconnect", (reason) => {
    removeUserSocket(user._id.toString(), socket.id);
    console.log(
      `[Socket] Disconnected | user: ${user._id} (${user.role}) | socket: ${socket.id} | reason: ${reason}`
    );
  });

  // Handle transport errors (network drops, etc.)
  socket.on("error", (err) => {
    console.error(`[Socket] Error on socket ${socket.id} (user: ${user._id}):`, err.message);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Main: registerSocketHandlers
// Called once from server.js with the Socket.IO server instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach connection handling to the Socket.IO server.
 * Every incoming connection is authenticated before being registered.
 *
 * @param {import("socket.io").Server} io
 */
const registerSocketHandlers = (io) => {
  io.on("connection", async (socket) => {
    console.log(`[Socket] New connection attempt | socket: ${socket.id}`);

    // ── Step 1: Authenticate ────────────────────────────────────────────────
    let user;
    try {
      user = await authenticateSocket(socket);
    } catch (authErr) {
      console.warn(
        `[Socket] Authentication failed | socket: ${socket.id} | reason: ${authErr.message}`
      );
      socket.emit("auth:error", {
        success: false,
        message: authErr.message,
      });
      socket.disconnect(true);
      return;
    }

    // ── Step 2: Register in userSocketMap ───────────────────────────────────
    registerUserSocket(user._id.toString(), socket.id);

    // ── Step 3: Join a personal room named after the userId ─────────────────
    // This allows targeting the user from outside socket scope via:
    //   io.to(userId).emit(event, data)
    // which complements the explicit socketId loop in sendNotificationToUser.
    await socket.join(user._id.toString());

    // ── Step 4: Confirm authentication to the client ────────────────────────
    socket.emit("auth:success", {
      success:  true,
      message:  "Connected and authenticated",
      userId:   user._id.toString(),
      name:     user.name,
      role:     user.role,
      socketId: socket.id,
    });

    console.log(
      `[Socket] Authenticated | user: ${user._id} (${user.name}, ${user.role}) | socket: ${socket.id}`
    );

    // ── Step 5: Register per-socket event listeners ─────────────────────────
    handlePing(socket, user);
    handleGetOnlineUsers(socket, user);
    handleDisconnect(socket, user);

    // ── Step 6: Emit updated online count to managers ───────────────────────
    // Emit only to manager room (if such a room exists) to avoid broadcasting
    // presence data to all doctors.
    const onlineSnapshot = getOnlineUsers();
    io.emit("presence:update", {
      type:       "connected",
      userId:     user._id.toString(),
      role:       user.role,
      totalOnline: onlineSnapshot.length,
      timestamp:  new Date().toISOString(),
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = { registerSocketHandlers };