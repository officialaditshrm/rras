import StationData from "../models/StationData.js";

// @desc    Get all station data (with pagination)
// @route   GET /api/stations?page=1&limit=10
export const getAllStations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // default page 1
    const limit = parseInt(req.query.limit) || 10; // default limit 10
    const skip = (page - 1) * limit;

    const total = await StationData.countDocuments();
    const stations = await StationData.find().skip(skip).limit(limit);

    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      count: stations.length,
      stations,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get station by code
// @route   GET /api/stations/:station_code
export const getStationByCode = async (req, res) => {
  try {
    const station = await StationData.findOne({ station_code: req.params.station_code });
    if (!station) return res.status(404).json({ message: "Station not found" });
    res.json(station);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Add new station data
// @route   POST /api/stations
export const createStationData = async (req, res) => {
  try {
    const newStation = new StationData(req.body);
    await newStation.save();
    res.status(201).json(newStation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Update station data by station_code
// @route   PUT /api/stations/:station_code
export const updateStationData = async (req, res) => {
  try {
    const updatedStation = await StationData.findOneAndUpdate(
      { station_code: req.params.station_code },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedStation) return res.status(404).json({ message: "Station not found" });
    res.json(updatedStation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
