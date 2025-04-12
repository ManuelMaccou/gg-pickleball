"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Text } from "@radix-ui/themes"

const locations = [
  { value: "California Smash" },
  { value: "Pickle Pop" },
  { value: "Santa Monica Pickleball Center" },
  { value: "Memorial Park" },
  { value: "PowerPlay Pickleball" },
  { value: "Wolf & Bear" },
  { value: "Smash Dink" },
  { value: "West Hollywood Park" },
  { value: "Plummer Park" },
  { value: "Angel City Pickleball" },
  { value: "Mix Park" },
  { value: "Allendale Park" },
  { value: "Brenner Park" },
  { value: "Independence Park" },
  { value: "Westchester Pickleball" },
  { value: "Galaxy Park" },
  { value: "Monrovia Recreation Park" },
  { value: "Los Cab" },
  { value: "Calabasas Pickleball Club" },
  { value: "Roxbury Park" },
  { value: "Altadena Town & Country Club" },
  { value: "La Mirada Community Regional Park" },
  { value: "El Segundo Parks & Recreation" },
  { value: "Houghton Park" },
  { value: "iPickle Arcadia" },
  { value: "iPickle Cerritos" },
  { value: "iPickle Arroyo Seco" },
  { value: "iPickle La Habra" },
  { value: "iPickle “The Narrows”" },
  { value: "iPickle Marengo" },
  { value: "Bayshore" },
  { value: "Billie Jean King Tennis Center" },
  { value: "Marina Vista" },
  { value: "Junipero Beach" },
  { value: "El Dorado Park West" },
  { value: "Somerset Park" },
  { value: "Veterans Park" },
  { value: "DeForest Park" },
  { value: "Burbank Tennis Center" },
  { value: "Culver West Alexander Park" },
  { value: "Manhattan Heights Community Center" },
  { value: "Perry Park" },
  { value: "Marina Racquet Club" },
  { value: "Palisades Tennis Center" },
  { value: "Westwood Tennis Center" },
  { value: "Cheviot Hills Tennis Center" },
  { value: "Eagle Rock Recreation Center" },
  { value: "Cornishon Pickleball Court" },
  { value: "Smith Park" },
  { value: "Darby Park" },
  { value: "Liberty Park and Fitness Center" },
  { value: "Live Oak Park" },
  { value: "Van Nuys Sherman Oaks Rec Center" },
  { value: "Don Knabe Community Regional Park" },
  { value: "La Cienega Tennis Center" },
  { value: "Disco Court at La Peer Hotel" },
  { value: "Alhambra Park" },
  { value: "Glen Alla Park" },
  { value: "Hemingway Park" },
  { value: "Fox Hills Park" },
  { value: "Syd Kronenthal Park" },
  { value: "Franklin Park" },
  { value: "Anderson Park" },
  { value: "Dale Page Park" },
]

interface LocationSearchProps {
  onLocationSelect: (location: string | null) => void;
  selectedLocation: string | null;
}

export default function LocationSearch({ onLocationSelect, selectedLocation }: LocationSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  React.useEffect(() => {
    if (selectedLocation === 'Other') {
      setValue('')
    } else {
      setValue(selectedLocation || "")
    }
  }, [selectedLocation])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[100%] justify-between py-[10px]"
        >
          <Text wrap={'pretty'}>
            {value || "Select court..."}
          </Text>
          
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          <CommandInput placeholder="Search courts..." className="h-9" />
          <CommandList>
            <CommandEmpty>Court not added. Check back soon.</CommandEmpty>
            <CommandGroup>
            {locations
              .slice() // Create a copy to avoid mutating the original array
              .sort((a, b) => a.value.localeCompare(b.value)) // Sort alphabetically
              .map((location) => (
                <CommandItem
                  key={location.value}
                  value={location.value}
                  onSelect={(currentValue) => {
                    const newValue = currentValue === value ? "" : currentValue
                    setValue(newValue)
                    setOpen(false)
                    onLocationSelect(newValue)
                  }}
                >
                  {location.value}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === location.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
