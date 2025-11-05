import mongoose from "mongoose";

const stationSchema = new mongoose.Schema({
  station_code: { type: String, required: true },
  station_name: { type: String, required: true },
  lat: Number,
  lon: Number,
  altitude: Number,
  day_of_week: String,
  day_of_journey: Number,
  tracks_on_route: Number,
  trains_nearby: Number,
  scheduled_arrival: Date
});

const trainScheduleSchema = new mongoose.Schema({
  train_number: { type: Number, required: true },
  train_name: { type: String, required: true },
  origin_code: { type: String, required: true },
  origin_name: { type: String, required: true },
  dest_code: { type: String, required: true },
  dest_name: { type: String, required: true },
  total_journey_days: Number,
  schedule: [stationSchema]
}, { timestamps: true });

export default mongoose.model("TrainSchedule", trainScheduleSchema);
