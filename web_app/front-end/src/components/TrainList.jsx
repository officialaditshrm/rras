import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchBar from "./SearchBar";

export default function TrainList({ onSelectTrain }) {
  const [trains, setTrains] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 10;

  // Fetch trains from API with server-side pagination
  const fetchTrains = async () => {
    try {
      const res = await axios.get(
        `https://railway-rescheduling-automation-system.onrender.com/api/trains?page=${page}&limit=${perPage}`
      );
      setTrains(res.data.trains || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTrains();
  }, [page]);

  // Reset page if search or date changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, dateFilter]);

  const filteredTrains = trains.filter((train) => {
    const term = searchTerm.toLowerCase();

    const matchesText =
      train.train_name.toLowerCase().includes(term) ||
      train.train_number.toString().includes(term) ||
      train.schedule?.some(
        (s) =>
          s.station_name.toLowerCase().includes(term) ||
          s.station_code.toLowerCase().includes(term)
      );

    const matchesDate = dateFilter
      ? train.schedule?.some((s) => {
          if (!s.scheduled_arrival) return false;
          const arrivalDate = new Date(s.scheduled_arrival)
            .toISOString()
            .split("T")[0];
          return arrivalDate === dateFilter;
        })
      : true;

    return matchesText && matchesDate;
  });

  return (
    <div className="max-w-6xl mx-auto p-4">
      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
      />

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrains.map((train) => (
          <li
            key={train._id}
            className="bg-white p-5 rounded-xl shadow-md hover:shadow-xl transition-shadow cursor-pointer hover:bg-blue-50"
            onClick={() => onSelectTrain(train)}
          >
            <div className="flex flex-col space-y-2">
              <p className="font-semibold text-lg text-gray-800">
                {train.train_name} ({train.train_number})
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">From:</span> {train.origin_name || "-"}
                <span className="ml-2 font-medium">To:</span> {train.dest_name || "-"}
              </p>
              {train.date_of_journey && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Journey Date:</span> {train.date_of_journey}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Server-side Pagination */}
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

      {filteredTrains.length === 0 && (
        <p className="text-center text-gray-500 mt-6 text-lg">
          No trains found.
        </p>
      )}
    </div>
  );
}
