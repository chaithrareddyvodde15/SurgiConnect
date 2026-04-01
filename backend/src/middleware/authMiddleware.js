const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 🔐 PROTECT ROUTE (JWT CHECK)
const protect = async (req, res, next) => {
  try {
    let token;

    // Check if Authorization header exists and starts with Bearer
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Extract token
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request (without password)
      req.user = await User.findById(decoded.id).select("-password");

      next();
    } else {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// 🔥 ROLE-BASED ACCESS CONTROL (RBAC)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied for role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };