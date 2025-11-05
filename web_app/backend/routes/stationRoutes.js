import express from "express";
import {
  getAllStations,
  getStationByCode,
  createStationData,
  updateStationData
} from "../controllers/stationController.js";

const router = express.Router();

// @route   GET /api/stations?page=1&limit=10
router.get("/", getAllStations);
router.get("/:station_code", getStationByCode);
router.post("/", createStationData);
router.put("/:station_code", updateStationData);

export default router;
