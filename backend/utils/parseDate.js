function parseDateInput(input) {
  if (!input) return null;
  const s = String(input);

  // Handle date-only inputs safely: interpret in local time by using midday.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    return new Date(`${y}-${mo}-${d}T12:00:00`);
  }

  const dt = new Date(s);
  return dt;
}

module.exports = { parseDateInput };

