function emptySeatStats() {
  return {
    rounds: 0,
    wins: 0,
    tsumoWins: 0,
    dealIns: 0,
    riichiRounds: 0,
    openRounds: 0,
    draws: 0,
    winPointSum: 0,
    dealInPointSum: 0,
  };
}

function seatNumber(value) {
  const seat = Number(value);
  return Number.isInteger(seat) && seat >= 0 && seat < 4 ? seat : null;
}

function numericArray(value) {
  return Array.isArray(value) ? value.map((item) => Number(item) || 0) : [];
}

export function calculateRoundStats(records) {
  const stats = Array.from({ length: 4 }, () => emptySeatStats());
  let lastDiscardSeat = null;
  let riichiSeats = new Set();
  let openSeats = new Set();
  let dealtInSeat = null;

  for (const record of records ?? []) {
    const name = String(record?.name || "");
    const payload = record?.payload ?? {};

    if (name === ".lq.RecordNewRound") {
      for (const seatStats of stats) seatStats.rounds += 1;
      lastDiscardSeat = null;
      riichiSeats = new Set();
      openSeats = new Set();
      dealtInSeat = null;
      continue;
    }

    if (name === ".lq.RecordDiscardTile") {
      const seat = seatNumber(payload.seat);
      if (seat == null) continue;
      lastDiscardSeat = seat;
      if ((payload.is_liqi || payload.is_wliqi) && !riichiSeats.has(seat)) {
        riichiSeats.add(seat);
        stats[seat].riichiRounds += 1;
      }
      continue;
    }

    if (name === ".lq.RecordChiPengGang") {
      const seat = seatNumber(payload.seat);
      if (seat != null && !openSeats.has(seat)) {
        openSeats.add(seat);
        stats[seat].openRounds += 1;
      }
      continue;
    }

    if (name === ".lq.RecordNoTile" || name === ".lq.RecordLiuJu") {
      for (const seatStats of stats) seatStats.draws += 1;
      continue;
    }

    if (name !== ".lq.RecordHule") continue;

    const deltaScores = numericArray(payload.delta_scores);
    const hules = Array.isArray(payload.hules) ? payload.hules : [];
    let hasRon = false;

    for (const hule of hules) {
      const winner = seatNumber(hule?.seat);
      if (winner == null) continue;
      stats[winner].wins += 1;
      if (hule?.zimo) stats[winner].tsumoWins += 1;
      else hasRon = true;

      const delta = Number(deltaScores[winner] ?? 0);
      if (delta > 0) stats[winner].winPointSum += delta;
    }

    if (hasRon && lastDiscardSeat != null && dealtInSeat == null) {
      dealtInSeat = lastDiscardSeat;
      stats[lastDiscardSeat].dealIns += 1;
      const delta = Number(deltaScores[lastDiscardSeat] ?? 0);
      if (delta < 0) stats[lastDiscardSeat].dealInPointSum += -delta;
    }
  }

  return stats;
}

export function mergeRoundStats(target, source) {
  const result = { ...emptySeatStats(), ...(target ?? {}) };
  for (const key of Object.keys(emptySeatStats())) {
    result[key] = Number(result[key] || 0) + Number(source?.[key] || 0);
  }
  return result;
}
