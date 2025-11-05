import express from "express";
import Weather from "../models/Weather.js";

const router = express.Router();

// GET weather for a station
router.get("/:station_code", async (req, res) => {
  try {
    const { station_code } = req.params;
    const weatherData = await Weather.find({ station_code }).sort({ timestamp: 1 });
    res.json(weatherData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST generate fake weather for a day (every 15 mins)
router.post("/simulate/:station_code", async (req, res) => {
  try {
    const { station_code } = req.params;
    const startTime = new Date(req.body.start || new Date());
    const endTime = new Date(req.body.end || new Date(startTime.getTime() + 24*60*60*1000)); // default 24h

    const records = [];
    let currentTime = new Date(startTime);

    while (currentTime <= endTime) {
      records.push({
        station_code,
        timestamp: new Date(currentTime),
        temperature: parseFloat((-5 + Math.random() * 60).toFixed(1)), // 15-35°C
        rainfall: parseFloat((Math.random() * 10).toFixed(1)),          // 0-10 mm
        wind_speed: parseFloat((5 + Math.random() * 20).toFixed(1)),    // 5-25 km/h
        visibility: parseFloat((1000 + Math.random() * 9000).toFixed(0)), // 1km-10km
        condition: ["Sunny","Cloudy","Rainy","Stormy","Foggy","Snowy"][Math.floor(Math.random()*6)]
      });

      // Increment 15 minutes
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    }

    const inserted = await Weather.insertMany(records);
    res.json({ inserted_count: inserted.length, station_code });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
