const express = require("express");
const router = express.Router();
const {
  createWeight,
  getWeight,
  getLatestWeight,
  getWeightTrend,
  deleteWeight,
} = require("../controllers/weightController");
const validate = require("../middleware/validationMiddleware");
const { weightSchema } = require("../validators");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, validate(weightSchema), createWeight);
router.get("/", authMiddleware, getWeight);
router.get("/latest", authMiddleware, getLatestWeight);
router.get("/trend", authMiddleware, getWeightTrend);
router.delete("/:id", authMiddleware, deleteWeight);

module.exports = router;