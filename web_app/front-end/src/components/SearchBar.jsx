import React from "react";
import { FaSearch, FaCalendarAlt } from "react-icons/fa";

export default function SearchBar({ searchTerm, setSearchTerm, dateFilter, setDateFilter }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      
      {/* Text search */}
      <div className="relative flex-1 group">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-300" />
        <input
          type="text"
          placeholder="Search by train name, number, station..."
          className="
            w-full p-3 pl-10 border border-gray-300 rounded-xl 
            focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:shadow-lg transition-all duration-300 
            placeholder-gray-400 hover:border-blue-400
            bg-white hover:bg-blue-50
            group-focus-within:scale-105
          "
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Date picker */}
      <div className="relative w-52 group">
        <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-300" />
        <input
          type="date"
          className="
            w-full p-3 pl-10 border border-gray-300 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:shadow-lg transition-all duration-300 
            hover:border-blue-400 cursor-pointer
            bg-white hover:bg-blue-50
            group-focus-within:scale-105
          "
          value={dateFilter || ""}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>
    </div>
  );
}
