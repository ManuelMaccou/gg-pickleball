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

const locations = [
  { value: "next.js", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt.js", label: "Nuxt.js" },
  { value: "remix", label: "Remix" },
  { value: "astro", label: "Astro" },
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
          className="w-[200px] justify-between"
        >
          {value
            ? locations.find((locations) => locations.value === value)?.label
            : "Select court..."}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search courts..." className="h-9" />
          <CommandList>
            <CommandEmpty>Court not added. Check back soon.</CommandEmpty>
            <CommandGroup>
              {locations.map((locations) => (
                <CommandItem
                  key={locations.value}
                  value={locations.value}
                  onSelect={(currentValue) => {
                    const newValue = currentValue === value ? "" : currentValue
                    console.log("Selected location in child component:", newValue);
                    setValue(newValue)
                    setOpen(false)
                    onLocationSelect(newValue)
                  }}
                >
                  {locations.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === locations.value ? "opacity-100" : "opacity-0"
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
