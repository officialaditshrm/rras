import express from "express";
import axios from "axios";

const router = express.Router();
const ML_BASE_URL = process.env.ML_BASE_URL; // set this on Render

router.post("/simulate", async (req, res) => {
  try {
    const { train_number } = req.body;
    if (!train_number) {
      return res.status(400).json({ error: "train_number is required" });
    }
    const { data } = await axios.post(`${ML_BASE_URL}/api/ml/simulate`, { train_number });
    res.json(data);
  } catch (err) {
    console.error("ML proxy error:", err?.response?.data || err.message);
    res.status(500).json({ error: "ML simulation failed" });
  }
});

export default router;
