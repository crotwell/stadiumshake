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
const SH_HEIGHT = 300
const SH_HALF = SH_HEIGHT
const GARNET = "#73000a";
const METER_MAX = 0.5;
const METER_OFFSET = -7.1;
const METER_DELAY = sp.luxon.Duration.fromObject({seconds: 10});

function drawMeter() {
  const meterDiv = document.querySelector("div#shakemeter");
  if (!meterDiv) {
    return;
  }
  let rad = 179*Math.PI/180;
  let meterPathD = createArcPath(0, METER_MAX)
  meterDiv.innerHTML = `
  <svg>
    <rect x="0" y="0" width="${2*SH_HEIGHT}" height="${SH_HEIGHT}" stroke="grey" stroke-width="1" />
    <circle cx="${SH_HEIGHT}" cy="${SH_HEIGHT}" r="${SH_HEIGHT}" fill="black"/>
    <path d="${meterPathD}"
        fill="${GARNET}" stroke="${GARNET}" stroke-width="3" >

    </path>
  </svg>
  `;
}

function createArcPath(val, max) {
  const rad = ((val/max*180))*Math.PI/180;
  return `M0,${SH_HALF}  A${SH_HALF},${SH_HALF} 0 0,1 ${SH_HALF*(1-Math.cos(rad))},${SH_HALF*(1-Math.sin(rad))} L${SH_HALF},${SH_HALF} Z`
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
  document.querySelector("#mag").textContent=`${val}`;
  document.querySelector("#mag_offset").textContent=`${METER_OFFSET} range: ${METER_MAX}`;
}

let packetHandler = (daliPacket) => {
  document.querySelector("#sid").textContent=`${daliPacket.streamId}`;
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
  const start_dali = sp.luxon.DateTime.utc().minus(METER_DELAY);
  addToDebug(`Start dali for mag at ${start_dali.toISO()}`);
  return dali.positionAfter(start_dali);
}).then( response => {
  return dali.stream();
});
