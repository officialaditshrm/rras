import mongoose from "mongoose";

const weatherSchema = new mongoose.Schema({
  station_code: { type: String, required: true },
  timestamp: { type: Date, required: true },
  temperature: Number,      // in Celsius
  rainfall: Number,         // in mm
  wind_speed: Number,       // in km/h
  visibility: Number,       // in meters
  condition: {              // simple condition
    type: String,
    enum: ["Sunny", "Cloudy", "Rainy", "Stormy", "Foggy", "Snowy"],
    default: "Sunny",
  }
});

const Weather = mongoose.model("Weather", weatherSchema);
export default Weather;
