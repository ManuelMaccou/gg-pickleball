// Converts a time range (e.g., 9:00 AM - 10:30 AM) to 30-min blocks
const generate30MinBlocks = (start: string, end: string): string[] => {
  const times = [];
  const timeToMinutes = (time: string) => {
    const [hour, minute] = time.split(/:| /);
    const period = time.includes("AM") ? "AM" : "PM";
    let hourNum = parseInt(hour, 10);
    if (period === "PM" && hourNum !== 12) hourNum += 12;
    if (period === "AM" && hourNum === 12) hourNum = 0;
    return hourNum * 60 + parseInt(minute, 10);
  };

  const minutesToTime = (minutes: number) => {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${minute === 0 ? "00" : "30"} ${period}`;
  };

  let startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  while (startMinutes < endMinutes) {
    const endBlockMinutes = startMinutes + 30;
    times.push(
      `${minutesToTime(startMinutes)}-${minutesToTime(endBlockMinutes)}`
    );
    startMinutes = endBlockMinutes;
  }

  return times;
};

const formatTimeRange = (start: string, end: string): string => {
  const formatStartTime = (time: string): string => {
    const [hour, minute] = time.split(/:| /);
    const hourNum = parseInt(hour, 10);
    const minutePart = minute === "00" ? "" : `:30`;
    return `${hourNum}${minutePart}`;
  };

  const formatEndTime = (time: string): string => {
    const [hour, minute, period] = time.split(/:| /);
    const hourNum = parseInt(hour, 10);
    const minutePart = minute === "00" ? "" : `:30`;
    const amPm = period.toLowerCase();
    return `${hourNum}${minutePart}${amPm}`;
  };

  const formattedStart = formatStartTime(start);
  const formattedEnd = formatEndTime(end);

  return `${formattedStart}-${formattedEnd}`;
};

export const transformAvailabilityToBlocks = (availability: Record<string, { start: string; end: string }[]>) => {
  const results: { day: string; time: string }[] = [];

  Object.entries(availability).forEach(([day, blocks]) => {
    blocks.forEach(({ start, end }) => {
      const intervals = generate30MinBlocks(start, end);
      intervals.forEach((interval) => {
        const [intervalStart, intervalEnd] = interval.split("-");
        const formattedTime = formatTimeRange(intervalStart.trim(), intervalEnd.trim());
        results.push({ day, time: formattedTime });
      });
    });
  });

  return results;
};
