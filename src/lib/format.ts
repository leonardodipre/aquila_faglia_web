export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatCompactNumber(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatScientific(value: number, digits = 3) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  if (value === 0) {
    return "0";
  }
  const abs = Math.abs(value);
  if (abs >= 1e3 || abs < 1e-2) {
    return value.toExponential(digits);
  }
  return value.toFixed(digits);
}

export function overlapDateRanges(
  stationStart: string,
  stationEnd: string,
  filterStart: string,
  filterEnd: string,
) {
  const stationStartMs = new Date(stationStart).getTime();
  const stationEndMs = new Date(stationEnd).getTime();
  const filterStartMs = new Date(filterStart).getTime();
  const filterEndMs = new Date(filterEnd).getTime();
  return stationEndMs >= filterStartMs && stationStartMs <= filterEndMs;
}

