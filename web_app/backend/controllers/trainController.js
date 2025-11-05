import TrainSchedule from "../models/TrainSchedule.js";

// @desc    Get all train schedules (with pagination and optional date filter)
// @route   GET /api/trains?page=1&limit=10&date=YYYY-MM-DD

export const getAllTrains = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.date) {
      const date = new Date(req.query.date);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      // Use $elemMatch to match at least one schedule with scheduled_arrival in range
      filter.schedule = {
        $elemMatch: {
          scheduled_arrival: { $gte: startOfDay, $lte: endOfDay }
        }
      };
    }

    

    const total = await TrainSchedule.countDocuments(filter);
    const trains = await TrainSchedule.find(filter).skip(skip).limit(limit);

    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      count: trains.length,
      trains
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getTrainByNumber = async (req, res) => {
  try {
    const train = await TrainSchedule.findOne({ train_number: req.params.train_number });
    if (!train) return res.status(404).json({ message: "Train not found" });
    res.json(train);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// @desc    Add a new train schedule
// @route   POST /api/trains
export const createTrainSchedule = async (req, res) => {
  try {
    const newTrain = new TrainSchedule(req.body);
    await newTrain.save();
    res.status(201).json(newTrain);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Update a train schedule by train_number
// @route   PUT /api/trains/:train_number
export const updateTrainSchedule = async (req, res) => {
  try {
    const updatedTrain = await TrainSchedule.findOneAndUpdate(
      { train_number: req.params.train_number },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedTrain) return res.status(404).json({ message: "Train not found" });
    res.json(updatedTrain);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
