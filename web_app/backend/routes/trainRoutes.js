import express from "express";
import {
  getAllTrains,
  getTrainByNumber,
  createTrainSchedule,
  updateTrainSchedule
} from "../controllers/trainController.js";

const router = express.Router();

// @route   GET /api/trains?page=1&limit=10
router.get("/", getAllTrains);
router.get("/:train_number", getTrainByNumber);
router.post("/", createTrainSchedule);
router.put("/:train_number", updateTrainSchedule);

export default router;
