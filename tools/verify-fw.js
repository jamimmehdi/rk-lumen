// Read-only checks against the freshly flashed firmware (no writes besides nothing).
const { ViaDevice } = require('../electron/via');
const v = new ViaDevice();
v.on('connect', async (i) => {
  try {
    console.log('device:', i.product, i.manufacturer, i.pid.toString(16));
    const info = await v.readInfo();
    console.log('via protocol:', info.protocol, 'layers:', info.layers);
    console.log('lighting:', JSON.stringify(await v.readLighting()));
    const km = await v.readKeymap(info.layers, 6, 15);
    const hex = (c) => c.toString(16).padStart(4, '0');
    console.log('L0 row0:', km[0][0].map(hex).join(' '));
    console.log('L0 row5:', km[0][5].map(hex).join(' '));
    console.log('L1 row0:', km[1][0].map(hex).join(' '));
    console.log('L2 row0:', km[2][0].map(hex).join(' '));
  } catch (e) { console.log('error', e.message); }
  process.exit(0);
});
v.start();
setTimeout(() => { console.log('no device'); process.exit(1); }, 8000);
