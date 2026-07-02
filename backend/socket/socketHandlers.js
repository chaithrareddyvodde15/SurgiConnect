"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const {
  registerUserSocket,
  removeUserSocket,
  getOnlineUsers,
  isUserOnline,
} = require("./socketManager");

// ─────────────────────────────────────────────
// Authenticate Socket
// ─────────────────────────────────────────────
const authenticateSocket = async (socket) => {
  let token = socket.handshake.auth?.token || null;

  if (!token) {
    const authHeader = socket.handshake.headers?.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
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
  } catch (err) {
    throw new Error(
      err.name === "TokenExpiredError"
        ? "Authentication token has expired"
        : "Authentication token is invalid"
    );
  }

  const user = await User.findById(decoded.id)
    .select("-password")
    .lean();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

// ─────────────────────────────────────────────
// Ping
// ─────────────────────────────────────────────
const handlePing = (socket, user) => {
  socket.on("ping:client", (data, callback) => {
    const response = {
      pong: true,
      userId: user._id.toString(),
      role: user.role,
      timestamp: new Date().toISOString(),
      echo: data || null,
    };

    if (typeof callback === "function") {
      callback(response);
    } else {
      socket.emit("pong:server", response);
    }
  });
};

// ─────────────────────────────────────────────
// Online Users
// Hospitals can see everyone.
// Doctors only see themselves.
// ─────────────────────────────────────────────
const handleGetOnlineUsers = (socket, user) => {
  socket.on("online-users:get", (callback) => {
    if (user.role === "hospital") {
      const onlineUsers = getOnlineUsers();

      const response = {
        success: true,
        onlineUsers,
        count: onlineUsers.length,
      };

      if (typeof callback === "function") {
        callback(response);
      } else {
        socket.emit("online-users:list", response);
      }

      return;
    }

    const response = {
      success: true,
      userId: user._id.toString(),
      isOnline: isUserOnline(user._id.toString()),
    };

    if (typeof callback === "function") {
      callback(response);
    } else {
      socket.emit("online-users:self", response);
    }
  });
};

// ─────────────────────────────────────────────
// Disconnect
// ─────────────────────────────────────────────
const handleDisconnect = (socket, user) => {
  socket.on("disconnect", () => {
    removeUserSocket(user._id.toString(), socket.id);
  });

  socket.on("error", (err) => {
    console.error(err.message);
  });
};

// ─────────────────────────────────────────────
// Register Socket Handlers
// ─────────────────────────────────────────────
const registerSocketHandlers = (io) => {
  io.on("connection", async (socket) => {
    let user;

    try {
      user = await authenticateSocket(socket);
    } catch (err) {
      socket.emit("auth:error", {
        success: false,
        message: err.message,
      });

      socket.disconnect(true);
      return;
    }

    registerUserSocket(user._id.toString(), socket.id);

    await socket.join(user._id.toString());

    socket.emit("auth:success", {
      success: true,
      message: "Connected successfully",
      userId: user._id.toString(),
      name: user.name,
      role: user.role,
      socketId: socket.id,
    });

    handlePing(socket, user);
    handleGetOnlineUsers(socket, user);
    handleDisconnect(socket, user);

    const onlineUsers = getOnlineUsers();

    io.emit("presence:update", {
      type: "connected",
      userId: user._id.toString(),
      role: user.role,
      totalOnline: onlineUsers.length,
      timestamp: new Date().toISOString(),
    });
  });
};

module.exports = {
  registerSocketHandlers,
};