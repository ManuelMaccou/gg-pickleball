import * as React from "react";
import { useEffect, useState } from "react";
import axios from "axios";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CourtSelect({ onCourtSelect }: { onCourtSelect: (court: string) => void }) {
  const [courts, setCourts] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const response = await axios.get("/api/courts");
        setCourts(response.data);
      } catch (error) {
        console.error("Error fetching courts:", error);
      }
    };

    fetchCourts();
  }, []);

  return (
    <Select onValueChange={onCourtSelect}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a court" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Courts</SelectLabel>
          {courts.length > 0 ? (
            courts.map((court) => (
              <SelectItem key={court._id} value={court.name}>
                {court.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value="">
              No courts available
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
