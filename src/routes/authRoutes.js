const express = require("express");
const router = express.Router();
const { signup, login, me, logout } = require("../controllers/authController");
const validate = require("../middleware/validationMiddleware");
const { signupSchema, loginSchema } = require("../validators");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);
router.get("/me", authMiddleware, me);
router.post("/logout", authMiddleware, logout);

module.exports = router;