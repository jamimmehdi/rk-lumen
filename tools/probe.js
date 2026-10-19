const H=require('node-hid');
const d=H.devices().find(d=>d.vendorId==0x342d&&d.usagePage==0xff60);
console.log(d.productId.toString(16), d.release);
const h=new H.HID(d.path);
function q(name,bytes){
  const b=new Array(33).fill(0); bytes.forEach((v,i)=>b[i+1]=v);
  h.write(b);
  const r=h.readTimeout(500);
  console.log(name, r&&r.length? Buffer.from(r).toString('hex').slice(0,64):'(no reply)');
}
q('via protocol ver',[0x01]);
q('via rgbmatrix brightness',[0x08,0x03,0x01]);
q('via rgbmatrix effect',[0x08,0x03,0x02]);
q('via rgbmatrix speed',[0x08,0x03,0x03]);
q('via rgbmatrix color',[0x08,0x03,0x04]);
q('vial keyboard id',[0xfe,0x00]);
q('vialrgb info',[0xfe,0x40]);
q('via layer count',[0x11]);
h.close();
