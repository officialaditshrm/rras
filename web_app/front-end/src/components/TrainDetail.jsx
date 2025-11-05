import React, { useState, useEffect } from "react";
import axios from "axios";

export default function TrainDetail({ train, goBack }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setLoading(true);
    // Call your backend API that runs ML simulation for this train
    axios.post(`https://railway-rescheduling-automation-system.onrender.com/api/ml/simulate`, {
      train_number: train.number
    })
    .then(res => setResult(res.data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [train.number]);

  if (loading) return <p className="text-center mt-8">Running ML simulation, please wait...</p>;

  return (
    <div>
      <button onClick={goBack} className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Back to list</button>
      <h2 className="text-xl font-bold mb-2">{train.name} ({train.number}) Simulation Result</h2>
      {result ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-2 border">Station</th>
                <th className="px-4 py-2 border">Original Arrival</th>
                <th className="px-4 py-2 border">Predicted Delay (min)</th>
                <th className="px-4 py-2 border">Cumulative Delay</th>
                <th className="px-4 py-2 border">ETA</th>
              </tr>
            </thead>
            <tbody>
              {result.detail_df.map((row, idx) => (
                <tr key={idx} className="text-center">
                  <td className="border px-4 py-2">{row.station_name} ({row.station_code})</td>
                  <td className="border px-4 py-2">{new Date(row.original_scheduled_arrival).toLocaleTimeString()}</td>
                  <td className="border px-4 py-2">{row.predicted_delay.toFixed(2)}</td>
                  <td className="border px-4 py-2">{row.cumulative_delay.toFixed(2)}</td>
                  <td className="border px-4 py-2">{new Date(row.actual_arrival_predicted).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No simulation result available.</p>
      )}
    </div>
  );
}
