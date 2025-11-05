import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import trainRoutes from "./routes/trainRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import stationRoutes from "./routes/stationRoutes.js";
import mlRouter from "./routes/ml.js";


dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/trains", trainRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/ml", mlRouter);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
