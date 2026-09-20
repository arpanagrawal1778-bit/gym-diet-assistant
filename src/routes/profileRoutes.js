const express = require("express");
const router = express.Router();
const { createProfile, getProfile, updateProfile } = require("../controllers/profileController");
const validate = require("../middleware/validationMiddleware");
const { profileSchema } = require("../validators");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, validate(profileSchema), createProfile);
router.get("/", authMiddleware, getProfile);
router.put("/", authMiddleware, validate(profileSchema), updateProfile);

module.exports = router;