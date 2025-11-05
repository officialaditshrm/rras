import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE =
  "https://railway-rescheduling-automation-system.onrender.com/api";

export default function StationManager() {
  const [stations, setStations] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 10;

  const [editingStation, setEditingStation] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [formTracks, setFormTracks] = useState("");
  const [formNearby, setFormNearby] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Fetch stations with pagination
  const fetchStations = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/stations?page=${page}&limit=${perPage}`
      );
      setStations(res.data?.stations || []);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      console.error("Error fetching stations:", err);
    }
  };

  useEffect(() => {
    fetchStations();
  }, [page]);

  // Open modal to edit a station (default first forecast)
  const handleEditStation = (station) => {
    if (!station.forecasts?.length) {
      alert("No forecasts found for this station.");
      return;
    }

    setEditingStation(station);
    setEditIdx(0); // default to first entry
    const f = station.forecasts[0];
    setFormTracks(String(f.tracks_on_route ?? ""));
    setFormNearby(String(f.trains_nearby ?? ""));
    setShowForm(true);
  };

  // When selecting a different timestamp in the dropdown
  const handleForecastChange = (idx) => {
    setEditIdx(idx);
    const f = editingStation.forecasts[idx];
    setFormTracks(String(f.tracks_on_route ?? ""));
    setFormNearby(String(f.trains_nearby ?? ""));
  };

  // Submit update
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingStation || editIdx == null) return;

    const tracksNum = Number(formTracks);
    const nearbyNum = Number(formNearby);
    if (isNaN(tracksNum) || isNaN(nearbyNum)) {
      alert("Please enter valid numeric values.");
      return;
    }

    const updated = {
      ...editingStation,
      forecasts: editingStation.forecasts.map((f, i) =>
        i === editIdx
          ? {
              ...f,
              tracks_on_route: tracksNum,
              trains_nearby: nearbyNum,
            }
          : f
      ),
    };

    try {
      await axios.put(
        `${API_BASE}/stations/${editingStation.station_code}`,
        updated
      );
      alert("Station forecast updated successfully");
      setShowForm(false);
      setEditingStation(null);
      setEditIdx(null);
      fetchStations();
    } catch (err) {
      console.error(err);
      alert("Failed to update station forecast");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Station Forecast Manager
        </h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-200">
        <table className="min-w-full text-sm text-gray-700">
          <thead className="bg-gradient-to-r from-gray-700 to-gray-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left">Station Name</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-center"># Forecasts</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr
                key={s._id || s.station_code}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="px-4 py-3 font-medium text-left">
                  {s.station_name}
                </td>
                <td className="px-4 py-3 text-left">{s.station_code}</td>
                <td className="px-4 py-3 text-center">
                  {s.forecasts?.length || 0}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => handleEditStation(s)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {stations.length === 0 && (
              <tr>
                <td
                  colSpan="4"
                  className="text-center text-gray-500 py-4 italic"
                >
                  No stations available.
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
          onClick={() => setPage((p) => Math.max(1, p - 1))}
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
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>

      {/* Edit Modal */}
      {showForm && editingStation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 relative">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingStation(null);
                setEditIdx(null);
              }}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
              aria-label="Close"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold mb-2 text-gray-800 text-center">
              Edit Forecast
            </h3>
            <p className="text-center text-sm text-gray-500 mb-4">
              {editingStation.station_name} ({editingStation.station_code})
            </p>

            {/* Timestamp Dropdown */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Select Forecast Timestamp:
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={editIdx ?? ""}
                onChange={(e) => handleForecastChange(Number(e.target.value))}
              >
                {(editingStation.forecasts || []).map((f, i) => (
                  <option key={i} value={i}>
                    {new Date(f.timestamp).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Edit form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Tracks on Route
                </label>
                <input
                  type="number"
                  min="0"
                  value={formTracks}
                  onChange={(e) => setFormTracks(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Trains Nearby
                </label>
                <input
                  type="number"
                  min="0"
                  value={formNearby}
                  onChange={(e) => setFormNearby(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingStation(null);
                    setEditIdx(null);
                  }}
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
