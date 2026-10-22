export function createBatterySystem({ state, dronePos, velocity, stations, keys, groundY, toast, batteryBar, batteryText, batteryHint, beep }) {
  let lastToast = 0;

  function showToast(message, force = false) {
    if (!force && performance.now() - lastToast < 1800) return;
    toast.innerHTML = message;
    toast.classList.add('show');
    state.toastAt = performance.now();
    lastToast = state.toastAt;
  }

  function stationNearby() {
    const available = stations[state.mission] ?? [];
    return available.find((station) => dronePos.distanceTo(station.userData.chargePoint) < 5.4) ?? null;
  }

  function update(dt) {
    if (!state.started || state.gameOver) return;

    const station = stationNearby();
    const landedAtStation = station && dronePos.y <= groundY + 2.8;
    const stopped = velocity.length() < 2.1;
    state.charging = Boolean(landedAtStation && stopped && !state.batteryDepleted);

    if (!state.batteryDepleted) {
      if (state.charging) {
        const previousBattery = state.battery;
        state.battery = Math.min(100, state.battery + dt * 24);
        if (previousBattery < 100 && state.battery === 100) {
          showToast('BATTERY FULL <span>READY TO LAUNCH</span>');
          beep(620, .1, 'triangle', .025);
        }
      } else {
        state.battery = Math.max(0, state.battery - dt * (.28 + velocity.length() * .045 + (keys.has('shift') ? .35 : 0)));
      }

      if (state.battery === 0) {
        state.batteryDepleted = true;
        state.charging = false;
        state.firing = false;
        keys.clear();
        showToast('BATTERY DEPLETED <span>AUTO-LANDING</span>', true);
        beep(130, .28, 'sawtooth', .04);
      }
    }

    batteryBar.style.width = `${state.battery}%`;
    batteryBar.classList.toggle('critical', state.battery < 22);
    batteryText.textContent = `${Math.ceil(state.battery)}%`;
    batteryHint.textContent = state.batteryDepleted
      ? state.flightStopped ? 'AIRFRAME SHUT DOWN' : 'AUTO-LANDING'
      : state.charging ? `CHARGING • ${station.userData.label}`
        : landedAtStation && !stopped ? 'STOP TO CHARGE'
          : station ? 'CHARGE PAD IN RANGE'
            : 'LAND ON A PAD TO CHARGE';
  }

  function reset() {
    state.battery = 100;
    state.batteryDepleted = false;
    state.flightStopped = false;
    state.charging = false;
    batteryBar.style.width = '100%';
    batteryBar.classList.remove('critical');
    batteryText.textContent = '100%';
    batteryHint.textContent = 'LAND ON A PAD TO CHARGE';
  }

  return { update, reset };
}
