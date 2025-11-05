import React, { useState } from "react";
import TrainList from "./components/TrainList";
import TrainDetail from "./components/TrainDetail";

function App() {
  const [selectedTrain, setSelectedTrain] = useState(null);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-4 text-center">Railway Schedule ML Viewer</h1>
      {!selectedTrain ? (
        <TrainList onSelectTrain={setSelectedTrain} />
      ) : (
        <TrainDetail train={selectedTrain} goBack={() => setSelectedTrain(null)} />
      )}
    </div>
  );
}

export default App;
