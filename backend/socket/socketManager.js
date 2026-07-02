"use strict";

/** @type {import("socket.io").Server | null} */
let io = null;

/**
 * userId -> Set<socketId>
 * @type {Map<string, Set<string>>}
 */
const userSocketMap = new Map();

// ─────────────────────────────────────────────
// Initialize Socket.IO
// ─────────────────────────────────────────────
const initSocketManager = (ioInstance) => {
  io = ioInstance;
  console.log("✅ SocketManager initialised");
};

const getIO = () => io;

// ─────────────────────────────────────────────
// User ↔ Socket Mapping
// ─────────────────────────────────────────────
const registerUserSocket = (userId, socketId) => {
  const uid = userId.toString();

  if (!userSocketMap.has(uid)) {
    userSocketMap.set(uid, new Set());
  }

  userSocketMap.get(uid).add(socketId);
};

const removeUserSocket = (userId, socketId) => {
  const uid = userId.toString();
  const sockets = userSocketMap.get(uid);

  if (!sockets) return;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    userSocketMap.delete(uid);
  }
};

const getSocketIdsForUser = (userId) => {
  const sockets = userSocketMap.get(userId.toString());
  return sockets ? Array.from(sockets) : [];
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const isUserOnline = (userId) => {
  const sockets = userSocketMap.get(userId.toString());
  return !!(sockets && sockets.size > 0);
};

const getOnlineUsers = () =>
  Array.from(userSocketMap.entries()).map(([userId, sockets]) => ({
    userId,
    socketCount: sockets.size,
  }));

// ─────────────────────────────────────────────
// Send notification to a specific user
// ─────────────────────────────────────────────
const sendNotificationToUser = (userId, event, payload) => {
  if (!io) return false;

  const socketIds = getSocketIdsForUser(userId);

  if (socketIds.length === 0) {
    return false;
  }

  socketIds.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });

  return true;
};

// ─────────────────────────────────────────────
// Broadcast to everyone
// ─────────────────────────────────────────────
const broadcastToAll = (event, payload) => {
  if (!io) return;

  io.emit(event, payload);
};

// ─────────────────────────────────────────────
// Broadcast to doctors of a specialization
// ─────────────────────────────────────────────
const emitToSpecialization = async (
  specialization,
  event,
  payload,
  DoctorModel
) => {
  if (!io) {
    return {
      emitted: 0,
      offline: 0,
      total: 0,
    };
  }

  let doctors;

  try {
    doctors = await DoctorModel.find({
      specialization,
      verified: true,
      availability: {
        $in: ["Available", "On-Call"],
      },
    })
      .select("userId")
      .lean();
  } catch (err) {
    console.error(err);
    return {
      emitted: 0,
      offline: 0,
      total: 0,
    };
  }

  let emitted = 0;
  let offline = 0;

  for (const doctor of doctors) {
    if (!doctor.userId) continue;

    const delivered = sendNotificationToUser(
      doctor.userId.toString(),
      event,
      payload
    );

    if (delivered) {
      emitted++;
    } else {
      offline++;
    }
  }

  return {
    emitted,
    offline,
    total: doctors.length,
  };
};

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
  emitToSpecialization,
};