import React, { useState, useEffect } from "react";
import axios from "axios";

export default function TrainManager() {
  const [trains, setTrains] = useState([]);
  const [editingTrain, setEditingTrain] = useState(null);
  const [newStartTime, setNewStartTime] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 10;

  // Helper: convert any ISO to a datetime-local value (no timezone letter)
  const isoToLocalInput = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d)) return "";
    // datetime-local expects local time; adjust from current TZ offset
    const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d.getTime() - tzOffsetMs);
    return local.toISOString().slice(0, 16);
  };

  // Helper: convert a datetime-local value back to ISO (UTC Z)
  const localInputToISO = (localValue) => {
    // localValue like "2025-11-05T13:45"
    const localDate = new Date(localValue);
    return localDate.toISOString();
  };

  // Fetch trains
  const fetchTrains = async () => {
    try {
      const res = await axios.get(
        `https://railway-rescheduling-automation-system.onrender.com/api/trains?page=${page}&limit=${perPage}`
      );
      setTrains(res.data.trains || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error("Error fetching trains:", err);
    }
  };

  useEffect(() => {
    fetchTrains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Delete train
  const handleDelete = async (train_number) => {
    if (!window.confirm("Are you sure you want to delete this train?")) return;
    try {
      await axios.delete(
        `https://railway-rescheduling-automation-system.onrender.com/api/trains/${train_number}`
      );
      alert("Train deleted successfully");
      fetchTrains();
    } catch (err) {
      console.error(err);
      alert("Failed to delete train");
    }
  };

  // Edit train (open modal)
  const handleEdit = (train) => {
    setEditingTrain(train);

    const firstStation = train.schedule?.[0] || null;
    const startTime =
      firstStation?.scheduled_arrival ||
      firstStation?.scheduled_departure ||
      "";

    setNewStartTime(startTime ? isoToLocalInput(startTime) : "");
    setShowForm(true);
  };

  // Save new start time (shift all later scheduled_arrival by same delta)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingTrain) return;

    // 1) New start time from input (local) -> ISO
    const newStartISO = localInputToISO(newStartTime);

    // 2) Compute delta from the original first-station start
    const origFirst =
      editingTrain?.schedule?.[0]?.scheduled_arrival ||
      editingTrain?.schedule?.[0]?.scheduled_departure;

    const origFirstISO = origFirst ? new Date(origFirst).toISOString() : null;
    const deltaMs = origFirstISO
      ? new Date(newStartISO).getTime() - new Date(origFirstISO).getTime()
      : 0;

    // 3) Build updated payload with shifted arrivals
    const updated = { ...editingTrain };
    const schedule = Array.isArray(updated.schedule)
      ? updated.schedule.map((s) => ({ ...s }))
      : [];

    if (schedule.length === 0) {
      // Ensure at least one schedule entry exists
      schedule.push({
        station_name: "Origin Station",
        station_code: "ORG",
        scheduled_arrival: newStartISO,
        scheduled_departure: newStartISO,
      });
    } else {
      // Update first station (keep departure in sync)
      schedule[0] = {
        ...schedule[0],
        scheduled_arrival: newStartISO,
        scheduled_departure: newStartISO,
      };

      // Shift ONLY scheduled_arrival for all subsequent stations by delta
      if (deltaMs !== 0) {
        for (let i = 1; i < schedule.length; i++) {
          const s = schedule[i];

          if (s?.scheduled_arrival) {
            const origArrMs = new Date(s.scheduled_arrival).getTime();
            if (!isNaN(origArrMs)) {
              const shiftedArrISO = new Date(origArrMs + deltaMs).toISOString();
              schedule[i] = { ...s, scheduled_arrival: shiftedArrISO };
            }
          }


          if (s?.scheduled_departure) {
            const origDepMs = new Date(s.scheduled_departure).getTime();
            if (!isNaN(origDepMs)) {
              const shiftedDepISO = new Date(origDepMs + deltaMs).toISOString();
              schedule[i] = { ...schedule[i], scheduled_departure: shiftedDepISO };
            }
          }
        }
      }
    }

    updated.schedule = schedule;

    try {
      await axios.put(
        `https://railway-rescheduling-automation-system.onrender.com/api/trains/${editingTrain.train_number}`,
        updated
      );
      alert("Train start time updated successfully");
      setShowForm(false);
      fetchTrains();
    } catch (err) {
      console.error(err);
      alert("Failed to update start time");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Train Start Time Management
        </h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-200">
        <table className="min-w-full text-sm text-gray-700">
          <thead className="bg-gradient-to-r from-gray-700 to-gray-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left">Train Name</th>
              <th className="px-4 py-3 text-center">Number</th>
              <th className="px-4 py-3 text-center">Origin</th>
              <th className="px-4 py-3 text-center">Start Time</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trains.map((t) => {
              const startTime =
                t.schedule?.[0]?.scheduled_arrival ||
                t.schedule?.[0]?.scheduled_departure;

              return (
                <tr
                  key={t._id || `${t.train_number}-${t.origin_code || "X"}`}
                  className="border-t hover:bg-gray-50 transition text-center"
                >
                  <td className="px-4 py-3 text-left font-medium">
                    {t.train_name}
                  </td>
                  <td className="px-4 py-3">{t.train_number}</td>
                  <td className="px-4 py-3">{t.origin_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {startTime
                      ? new Date(startTime).toLocaleString()
                      : "N/A"}
                  </td>
                  <td className="px-4 py-3 flex justify-center gap-3">
                    <button
                      onClick={() => handleEdit(t)}
                      className="text-blue-600 hover:underline"
                    >
                      Change Start Time
                    </button>
                    <button
                      onClick={() => handleDelete(t.train_number)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {trains.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="text-center text-gray-500 py-4 italic"
                >
                  No trains available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center flex-wrap gap-2 mt-6">
        <button
          className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Prev
        </button>

        {[...Array(totalPages)].map((_, idx) => {
          const pageNum = idx + 1;
          return (
            <button
              key={pageNum}
              className={`px-3 py-1 rounded-md font-medium transition ${
                pageNum === page
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
              onClick={() => setPage(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>

      {/* Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">
              Update Start Time for {editingTrain?.train_name} (
              {editingTrain?.train_number})
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-gray-700 text-sm font-medium mb-1">
                New Scheduled Start Time:
              </label>
              <input
                type="datetime-local"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
