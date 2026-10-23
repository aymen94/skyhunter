export function createFlightEffects({ THREE, app, dronePos, state }) {
  const linkBars = document.querySelector('#signalBars');
  const bars = linkBars ? Array.from(linkBars.children) : [];
  const linkStatus = document.querySelector('#linkStatus');
  const linkOrigin = new THREE.Vector3(0, 7, 14);

  function update() {
    const distance = dronePos.distanceTo(linkOrigin);
    const quality = THREE.MathUtils.clamp(100 - Math.max(0, distance - 34) * 1.15, 8, 100);
    state.linkQuality = Math.round(quality);
    const linkLabel = quality < 24 ? 'WEAK' : quality < 52 ? 'DEGRADED' : 'STABLE';
    if (linkStatus && linkStatus.textContent !== linkLabel) linkStatus.textContent = linkLabel;
    if (linkBars) {
      bars.forEach((bar, index) => {
        bar.style.opacity = quality > index * 25 ? '1' : '.18';
      });
      linkBars.classList.toggle('weak', quality < 35);
    }
    app.classList.toggle('low-link', quality < 35);
  }

  return { update };
}
