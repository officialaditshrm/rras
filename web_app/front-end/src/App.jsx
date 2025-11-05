import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import TrainList from "./components/TrainList";
import TrainDetail from "./components/TrainDetail";
import TrainManager from "./components/TrainManager";
import StationManager from "./components/StationManager"; // <-- import the new page

export default function App() {
  const [selectedTrain, setSelectedTrain] = useState(null);

  return (
    <Router>
      {/* ======= NAVBAR ======= */}
      <nav className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">Railway Rescheduler</h1>
        <div className="space-x-4">
          <Link to="/" className="hover:text-blue-400 transition">
            Home
          </Link>
          <Link to="/manage" className="hover:text-blue-400 transition">
            Manage Trains
          </Link>
          <Link to="/stations" className="hover:text-blue-400 transition">
            Manage Stations
          </Link>
        </div>
      </nav>

      {/* ======= ROUTES ======= */}
      <main className="p-4">
        <Routes>
          <Route
            path="/"
            element={
              selectedTrain ? (
                <TrainDetail
                  train={selectedTrain}
                  goBack={() => setSelectedTrain(null)}
                />
              ) : (
                <TrainList onSelectTrain={setSelectedTrain} />
              )
            }
          />

          {/* Train admin page */}
          <Route path="/manage" element={<TrainManager />} />

          {/* Station admin page */}
          <Route path="/stations" element={<StationManager />} />
        </Routes>
      </main>
    </Router>
  );
}
