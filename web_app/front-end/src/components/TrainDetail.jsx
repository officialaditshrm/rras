import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function TrainDetail({ train, goBack }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!train?.train_number) return;
    setLoading(true);
    axios
      .get(
        `https://railway-rescheduling-automation-system.onrender.com/api/trains/${train.train_number}`
      )
      .then((res) => setSchedule(res.data))
      .catch((err) => console.error("Schedule fetch error:", err))
      .finally(() => setLoading(false));
  }, [train.train_number]);

  const fetchSimulation = async () => {
    setAnalyzing(true);
    try {
      const res = await axios.post(
        `https://rras-ml.onrender.com/api/ml/simulate`,
        { train_number: train.train_number }
      );
      setResult(res.data);
    } catch (err) {
      console.error("Simulation fetch error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 border-4 border-blue-200 rounded-full animate-ping"></div>
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-lg font-medium text-gray-700 animate-pulse">
          Loading original train schedule...
        </p>
      </div>
    );

  // ===== Dashboard Analytics Preparation =====
  const chartData =
    result?.detail_df?.map((r, idx) => ({
      station: r.station_name,
      delay: r.predicted_delay,
      cumulative: r.cumulative_delay,
      index: idx + 1,
    })) || [];

  const avgDelay =
    result?.detail_df?.reduce((acc, r) => acc + r.predicted_delay, 0) /
      result?.detail_df?.length || 0;

  const maxDelayStation =
    result?.detail_df?.reduce(
      (max, r) =>
        r.predicted_delay > max.predicted_delay ? r : max,
      result?.detail_df?.[0] || {}
    ) || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto p-6 bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl shadow-lg"
    >
      {/* Back Button */}
      <button
        onClick={goBack}
        className="mb-6 inline-flex items-center px-5 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all duration-300 shadow-md"
      >
        ← Back to List
      </button>

      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {train.train_name}{" "}
          <span className="text-blue-600 font-semibold">
            ({train.train_number})
          </span>
        </h2>
        <p className="text-gray-500 italic">
          Live Schedule and Alternate Delay Analysis
        </p>
      </div>

      {/* ===== Original Schedule ===== */}
      {schedule ? (
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Current Train Schedule
          </h3>
          <div className="overflow-x-auto bg-white rounded-2xl shadow-md border border-gray-200 mb-10">
            <table className="min-w-full text-sm text-gray-700">
              <thead className="bg-gradient-to-r from-gray-700 to-gray-900 text-white">
                <tr>
                  <th className="px-5 py-3 text-left">Station</th>
                  <th className="px-5 py-3 text-center">Scheduled Arrival</th>
                  <th className="px-5 py-3 text-center">Latitude</th>
                  <th className="px-5 py-3 text-center">Longitude</th>
                  <th className="px-5 py-3 text-center">Altitude</th>
                  <th className="px-5 py-3 text-center">Day</th>
                </tr>
              </thead>
              <tbody>
                {schedule.schedule.map((s, idx) => (
                  <tr
                    key={idx}
                    className={`text-center ${
                      idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-blue-50 transition`}
                  >
                    <td className="px-5 py-3 text-left font-medium">
                      {s.station_name} ({s.station_code})
                    </td>
                    <td className="px-5 py-3">
                      {new Date(s.scheduled_arrival).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">{s.lat?.toFixed(3)}</td>
                    <td className="px-5 py-3">{s.lon?.toFixed(3)}</td>
                    <td className="px-5 py-3">{s.altitude}</td>
                    <td className="px-5 py-3">{s.day_of_week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!result && (
            <div className="text-center">
              <button
                onClick={fetchSimulation}
                disabled={analyzing}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md ${
                  analyzing
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {analyzing
                  ? "Running Alternate Schedule Simulation..."
                  : "Show Alternate Schedule Analysis"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-gray-500 mt-8">
          Could not fetch schedule data.
        </p>
      )}

      {/* ===== Alternate Schedule Analysis ===== */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-12 space-y-10"
          >
            {/* Best Variant Summary */}
            <div className="bg-white p-6 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-200">
              <div>
                <p className="text-gray-600 font-medium mb-1">
                  Best Departure Time
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {new Date(result.best_variant.start_time_variant).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium mb-1">
                  Minimum Total Delay
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {result.best_variant.total_delay.toFixed(2)} min
                </p>
              </div>
            </div>

            {/* All Variants Table */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Delay Summary by Departure Variant
              </h3>
              <div className="overflow-x-auto bg-white rounded-2xl shadow-md border border-gray-200">
                <table className="min-w-full text-sm text-gray-700">
                  <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <tr>
                      <th className="px-5 py-3 text-left">Start Time Variant</th>
                      <th className="px-5 py-3 text-center">Total Delay (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.all_variants.map((v, idx) => {
                      const isBest =
                        v.start_time_variant ===
                        result.best_variant.start_time_variant;
                      return (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`text-center transition ${
                            isBest
                              ? "bg-blue-50 border-l-4 border-blue-600 font-semibold"
                              : idx % 2 === 0
                              ? "bg-gray-50"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-5 py-3 text-left">
                            {new Date(v.start_time_variant).toLocaleString()}
                          </td>
                          <td
                            className={`px-5 py-3 ${
                              isBest
                                ? "text-blue-700 font-bold"
                                : "text-gray-800"
                            }`}
                          >
                            {v.total_delay.toFixed(2)}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== Dashboard Analytics Section ===== */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                📊 Analytics Dashboard
              </h3>

              {/* Cards */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-blue-50 rounded-xl shadow-sm border border-blue-200">
                  <p className="text-gray-600 text-sm">Average Predicted Delay</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {avgDelay.toFixed(2)} min
                  </p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl shadow-sm border border-red-200">
                  <p className="text-gray-600 text-sm">Max Delay Station</p>
                  <p className="text-2xl font-bold text-red-700">
                    {maxDelayStation?.station_name || "—"}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl shadow-sm border border-green-200">
                  <p className="text-gray-600 text-sm">Total Stations Analyzed</p>
                  <p className="text-2xl font-bold text-green-700">
                    {result.detail_df.length}
                  </p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Line Chart - Cumulative Delay */}
                <div className="h-64">
                  <h4 className="text-gray-700 font-semibold mb-2">
                    Cumulative Delay Over Stations
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="station" hide />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        stroke="#2563eb"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart - Delay by Station */}
                <div className="h-64">
                  <h4 className="text-gray-700 font-semibold mb-2">
                    Predicted Delay per Station
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="station" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="delay" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
