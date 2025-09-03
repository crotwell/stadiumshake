import * as sp from "./seisplotjs_3.1.5-SNAPSHOT_standalone.js";


function addToDebug(message) {
  const debugDiv = document.querySelector("div#debug");
  if (!debugDiv) {
    return;
  }
  const pre = debugDiv.appendChild(document.createElement("pre"));
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = message;
}
const GARNET = "#73000a";
const METER_MAX = 0.5;
const METER_OFFSET = -7.1;
const METER_DELAY = sp.luxon.Duration.fromObject({seconds: 10});

function drawMeter() {
  const meterDiv = document.querySelector("div#shakemeter");
  if (!meterDiv) {
    return;
  }
  // <path d="M0,150  a150,150 0 0,1 ${150*(1+Math.cos(rad))},${150*(1-Math.sin(rad))} z"
  let rad = 179*Math.PI/180;
  let meterPathD = createArcPath(0, METER_MAX)
  meterDiv.innerHTML = `
  <svg>
    <rect x="0" y="0" width="300" height="300" stroke="black" stroke-width="1" />
    <circle cx="150" cy="150" r="150" fill="black"/>
    <path d="${meterPathD}"
        fill="${GARNET}" stroke="${GARNET}" stroke-width="3" >

    </path>
  </svg>
  `;
}

function createArcPath(val, max) {
  const rad = ((val/max*180))*Math.PI/180;
  return `M0,150  A150,150 0 0,1 ${150*(1-Math.cos(rad))},${150*(1-Math.sin(rad))} L150,150 Z`
}

function updateMeter(val) {
  const path = document.querySelector("div#shakemeter svg path");
  let d_attr = path.getAttribute("d");
  if (val < 0) {
    d_attr = createArcPath(0, METER_MAX);
  } else if (val > METER_MAX) {
    d_attr = createArcPath(METER_MAX, METER_MAX);
  } else {
    d_attr = createArcPath(val, METER_MAX);
  }
  path.setAttribute("d", d_attr);
}

let packetHandler = (daliPacket) => {
  addToDebug(`Packet: ${daliPacket.streamId}`);
  if (daliPacket.isJson()) {
    const jdata = daliPacket.asJson();
    const st = sp.luxon.DateTime.fromISO(jdata.st);
    const delay = sp.luxon.Interval.fromDateTimes(st, sp.luxon.DateTime.utc());
    const delayMillis = delay.toDuration().toMillis();
    if (delayMillis > 0) {
      setTimeout( () => {
        updateMeter((jdata.mps-METER_OFFSET));
      }, delayMillis);
    } else {
      updateMeter((jdata.mps-METER_OFFSET));
    }
  }
};

let errorHandler = (error) => {
  addToDebug(`ERROR: ${error}`)
}

const dali = new sp.datalink.DataLinkConnection(
  "http://localhost:16000/datalink",
  packetHandler,
  errorHandler
)
drawMeter();
dali.connect().then( response => {
  return dali.match(".*_M_A_G/JSON");
}).then( response => {
  return dali.positionAfter(sp.luxon.DateTime.utc().minus(METER_DELAY));
}).then( response => {
  return dali.stream();
});
