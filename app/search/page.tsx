'use client'

import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { DatePicker } from "../components/ui/datePicker";
import { useEffect, useState } from "react";
import axios, { AxiosError } from "axios";
import { ITeam } from "../types/databaseTypes";


export default function Search() {

  const [teams, setTeams] = useState<ITeam[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get<ITeam[]>("/api/teams?regionId=67aaed654bf05bdbe38ca440&activeSeason=true");
        setTeams(response.data);
        setError(null);
      } catch (error: unknown) {
        console.error("Error fetching teams:", error);

        // Check if the error has a response from the API
        if (error instanceof AxiosError && error.response?.data) {
          setError(error.response.data.userMessage || "An unexpected error occurred. Code 432");
        } else {
          setError("Failed to load teams. Please try again later.");
        }
      }
    };

    fetchTeams();
  }, []);

  return (
    <Flex p={"5"} direction={"column"}>
      <Box pb={"5"}>
        <Heading as="h1" weight={"bold"}>Search Teams</Heading>
      </Box>
      <Box>
        <Flex direction={"row"}>
          <Flex gap={'3'} direction={'column'}>
            <Text as="p" weight={"bold"}>Availability</Text>
            <DatePicker onDateSelect={() => {}} />
          </Flex>
        </Flex>
      </Box>
      
      <Box py={'3'}>
        {error && <Text color="red">{error}</Text>}
      </Box>
     

      <Flex direction="row" wrap="wrap" gap="4" mt="4">
        {teams.length > 0 ? (
          teams.map((team, index) => (
            <Card key={index} style={{ padding: "20px", minWidth: "200px" }}>
              {team.teammates.length > 0 && (
                <Box>
                  <Flex direction={'row'} justify={'between'}>
                    <Box>
                    
                    </Box>

                  </Flex>

                </Box>
                
              )}
            </Card>
          ))
        ) : (
          <Text>No teams found.</Text>
        )}
      </Flex>
    </Flex>
  );
}
