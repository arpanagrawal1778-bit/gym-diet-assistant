const express = require("express");

const router = express.Router();

const {
  createProgress,
  getProgress,
  getProgressById,
  deleteProgress,
  completeMealProgress,
  completeWorkoutProgress,
} = require("../controllers/progressController");

const validate = require("../middleware/validationMiddleware");

const { progressSchema } = require("../validators");

const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/",
  authMiddleware,
  validate(progressSchema),
  createProgress
);

router.post(
  "/meal-complete",
  authMiddleware,
  completeMealProgress
);

router.post(
  "/workout-complete",
  authMiddleware,
  completeWorkoutProgress
);

router.get(
  "/",
  authMiddleware,
  getProgress
);

router.get(
  "/:id",
  authMiddleware,
  getProgressById
);

router.delete(
  "/:id",
  authMiddleware,
  deleteProgress
);

module.exports = router;