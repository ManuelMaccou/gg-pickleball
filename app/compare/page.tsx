"use client";

import { useState } from "react";

export default function CompareAvailabilityPage() {
  const [userIds, setUserIds] = useState<string[]>(Array(8).fill(""));
  const [results, setResults] = useState<
    { user1Name: string; user1SkillLevel: string; user2Name: string; user2SkillLevel: string; matches: number }[]
  | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (index: number, value: string) => {
    const updatedIds = [...userIds];
    updatedIds[index] = value;
    setUserIds(updatedIds);
  };

  const handleCompare = async () => {
    setError(null);
    setResults(null);
    setLoading(true);

    try {
      const response = await fetch("/api/compare-availabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: userIds.filter((id) => id.trim() !== "") }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setResults(data.results);
      }
    } catch (err) {
      console.error("An error occured:", err);
      setError("An error occurred. Please try again.");
    }

    setLoading(false);
  };

  const addUserField = () => {
    setUserIds([...userIds, ""]); // Add an empty input field
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-xl font-bold mb-4">Compare User Availability</h2>

      {userIds.map((id, index) => (
        <input
          key={index}
          type="text"
          value={id}
          onChange={(e) => handleChange(index, e.target.value)}
          placeholder={`User ID ${index + 1}`}
          className="w-full border rounded p-2 mb-2"
        />
      ))}

      <button
        onClick={addUserField}
        className="w-full bg-green-500 text-white p-2 rounded mt-2 hover:bg-green-600"
      >
        + Add More Users
      </button>

      <button
        onClick={handleCompare}
        className="w-full bg-blue-600 text-white p-2 rounded mt-2 hover:bg-blue-700"
        disabled={loading}
      >
        {loading ? "Comparing..." : "Compare"}
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      {results && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Top Matching Pairs:</h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">User 1</th>
                <th className="border p-2">Skill Level</th>
                <th className="border p-2">User 2</th>
                <th className="border p-2">Skill Level</th>
                <th className="border p-2">Matches</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? (
                results.map((pair, index) => (
                  <tr key={index} className="text-center">
                    <td className="border p-2">{pair.user1Name}</td>
                    <td className="border p-2">{pair.user1SkillLevel}</td>
                    <td className="border p-2">{pair.user2Name}</td>
                    <td className="border p-2">{pair.user2SkillLevel}</td>
                    <td className="border p-2">{pair.matches}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center p-2">No matching availability found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
