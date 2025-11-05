import mongoose from "mongoose";

const forecastSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  tracks_on_route: Number,
  maintenance_type: { type: String, enum: ["None", "Minor", "Major"], default: "None" },
  trains_nearby: Number
});

const stationDataSchema = new mongoose.Schema({
  station_code: { type: String, required: true },
  station_name: { type: String, required: true },
  lat: Number,
  lon: Number,
  altitude: Number,
  forecasts: [forecastSchema]
}, { timestamps: true });

export default mongoose.model("StationData", stationDataSchema);
