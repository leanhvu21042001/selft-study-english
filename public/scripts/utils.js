function getGasUrl() {
  return localStorage.getItem('eng_gas_url') || DEFAULT_GAS_URL;
}

function getRequestedDayIndex(days) {
  const requestedDay = Number(new URLSearchParams(window.location.search).get('day'));
  if (!Number.isFinite(requestedDay)) return 0;
  const index = days.findIndex(lesson => Number(lesson.day) === requestedDay);
  return index >= 0 ? index : 0;
}
