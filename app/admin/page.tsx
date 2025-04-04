"use client";

import { Card, Flex, Text, Select } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { ITeam } from "../types/databaseTypes";

export default function CompareAvailabilityPage() {
  const [userIds, setUserIds] = useState<string[]>(Array(8).fill(""));
  const [results, setResults] = useState<
    {
      user1Name: string;
      user1SkillLevel: string;
      user2Name: string;
      user2SkillLevel: string;
      user1TotalAvailabilities: number;
      user2TotalAvailabilities: number;
      matches: number;
      user1Availabilities: { day: string; time: string }[];
      user2Availabilities: { day: string; time: string }[];
      matchedTimes: { day: string; time: string }[];
    }[]
  | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [teams, setTeams] = useState<ITeam[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
        const res = await fetch(`/api/teams${query}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.userMessage || 'Error fetching teams');

        setTeams(data);
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [statusFilter]);
  
  const handleChange = (index: number, value: string) => {
    const updatedIds = [...userIds];
    updatedIds[index] = value;
    setUserIds(updatedIds);
  };

  const handleCompare = async () => {
    setError(null);
    setResults(null);
    setLoading(true);

    const filteredUserIds = userIds.map(id => id.trim()).filter(id => id.length > 0);
    if (filteredUserIds.length < 2) {
      setError("Please enter at least two valid User IDs.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/compare-availabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: filteredUserIds }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setResults(data.results);
      }
    } catch (err) {
      console.log(err)
      setError("An error occurred. Please try again.");
    }

    setLoading(false);
  };

  const addUserField = () => {
    setUserIds([...userIds, ""]); // Add an empty input field
  };

  return (
    <>
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Teams</h1>

      <Flex direction={'column'}>
        <Text>Filter by status</Text>
        <Select.Root onValueChange={setStatusFilter} defaultValue="ALL">
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="ALL">All</Select.Item>
            <Select.Item value="REGISTERED">Registered</Select.Item>
            <Select.Item value="PAYMENT_READY">Payment Ready</Select.Item>
            <Select.Item value="PAID">Paid</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {loading ? (
        <p>Loading teams...</p>
      ) : !Array.isArray(teams) || teams.length === 0 ? (
        <p>No teams found.</p>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <Card key={team._id} className="p-4">
              <h2 className="text-lg font-semibold mb-2">Status: {team.status}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Array.isArray(team.teammates) ? (
                  team.teammates.map((mate) => (
                    <div key={mate._id} className="flex items-center space-x-2">
                      <div>
                        <p className="text-sm font-medium">{mate.name}</p>
                        <p className="text-xs text-muted-foreground">{mate.skillLevel}</p>
                        <p className="text-xs text-muted-foreground">{mate.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No teammates</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>



    <div className="w-[80%] mx-auto p-6 bg-white shadow-lg rounded-lg">
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
          <h3 className="text-lg font-semibold text-black">Top Matching Pairs:</h3>
          <table className="w-full border-collapse border border-gray-300 text-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">User 1</th>
                <th className="border p-2">Skill Level</th>
                <th className="border p-2">Total Availabilities</th>
                <th className="border p-2">User 2</th>
                <th className="border p-2">Skill Level</th>
                <th className="border p-2">Total Availabilities</th>
                <th className="border p-2">Matches</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? (
                results.map((pair, index) => (
                  <>
                    <tr
                      key={index}
                      className="text-center cursor-pointer hover:bg-gray-200 text-black"
                      onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                    >
                      <td className="border p-2">{pair.user1Name}</td>
                      <td className="border p-2">{pair.user1SkillLevel}</td>
                      <td className="border p-2">{pair.user1TotalAvailabilities}</td>
                      <td className="border p-2">{pair.user2Name}</td>
                      <td className="border p-2">{pair.user2SkillLevel}</td>
                      <td className="border p-2">{pair.user2TotalAvailabilities}</td>
                      <td className="border p-2">{pair.matches}</td>
                    </tr>
                    {expandedRow === index && (
                      <tr>
                        <td colSpan={7} className="border p-2 bg-gray-100 text-black">
                          <h4 className="font-semibold">Availability Details</h4>
                          <table className="w-full mt-2 border-collapse border border-gray-300">
                            <thead>
                              <tr className="bg-gray-200 text-black">
                                <th className="border p-2">{pair.user1Name} Availability</th>
                                <th className="border p-2">{pair.user2Name} Availability</th>
                                <th className="border p-2">Shared Availability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pair.user1Availabilities.map((slot, idx) => (
                                <tr key={idx} className="text-center">
                                  <td className="border p-2">{slot.day} - {slot.time}</td>
                                  <td className="border p-2">
                                    {pair.user2Availabilities[idx]
                                      ? `${pair.user2Availabilities[idx].day} - ${pair.user2Availabilities[idx].time}`
                                      : ""}
                                  </td>
                                  <td className="border p-2 text-green-600">
                                    {pair.matchedTimes.some(m => m.day === slot.day && m.time === slot.time)
                                      ? `${slot.day} - ${slot.time}`
                                      : ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr><td colSpan={7} className="text-center p-2">No matching availability found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>

    </>
  );
}
