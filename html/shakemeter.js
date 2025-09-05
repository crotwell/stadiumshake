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
const METER_MAX = 1.5;     // jsc=1.5, rasp=2.5
const METER_OFFSET = -7.8; // jsc=>-7.8, rasp=-5.5
export const METER_DELAY = sp.luxon.Duration.fromObject({seconds: 10});
export const METER_WIDTH = sp.luxon.Duration.fromObject({seconds: 1});//from magcalc.py
const MAX_PRIOR_VALUES = 15;

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

let priorMagValue = 0;
function updateMeter(val, start, sid) {
  const myPriorVal = priorMagValue;
  sp.transition.transition( (x) => {
    const curVal = myPriorVal + x * (val-myPriorVal);
    const path = document.querySelector("div#shakemeter svg path");
    let d_attr = path.getAttribute("d");
    if (curVal < 0) {
      d_attr = createArcPath(0, METER_MAX);
    } else if (curVal > METER_MAX) {
      d_attr = createArcPath(METER_MAX, METER_MAX);
    } else {
      d_attr = createArcPath(curVal, METER_MAX);
    }
    path.setAttribute("d", d_attr);
  }, 1000);
  document.querySelector("#mag").textContent=`${val.toFixed(2)}`;
  document.querySelector("#mag_offset").textContent=`${METER_OFFSET} range: ${METER_MAX}`;

  const textDiv = document.querySelector("div#shakevalues ul");
  const h = document.createElement("li");
  h.textContent = `${val.toFixed(2)}    ${start.toISO()}  ${sid}`;
  textDiv.insertBefore(h, textDiv.firstChild);
  while (textDiv.childElementCount > MAX_PRIOR_VALUES) {
    textDiv.removeChild(textDiv.lastChild);
  }
  priorMagValue = val;
}

let packetHandler = (daliPacket) => {
  document.querySelector("#sid").textContent=`${daliPacket.streamId}`;
  if (daliPacket.isJson()) {
    const jdata = daliPacket.asJson();
    const st = sp.luxon.DateTime.fromISO(jdata.st);
    const delay = sp.luxon.Interval.fromDateTimes(st, sp.luxon.DateTime.utc());
    const delayMillis = METER_DELAY.toMillis()-delay.toDuration().toMillis();

    if (delayMillis > 0) {
      setTimeout( () => {
        updateMeter((jdata.mps-METER_OFFSET), st, jdata.sid);
      }, delayMillis);
    } else {
      updateMeter((jdata.mps-METER_OFFSET), st, jdata.sid);
    }
  }
};

let errorHandler = (error) => {
  addToDebug(`ERROR: ${error}`)
}

//const magRing = "http://localhost:16000/datalink"
const magRing = "http://eeyore.seis.sc.edu/stadiumringserver/datalink"

const dali = new sp.datalink.DataLinkConnection(
  magRing,
  packetHandler,
  errorHandler
)
drawMeter();
dali.connect()
.catch( err => {
  addToDebug(`unable to connet to mag ring: ${magRing}`);
  throw err;
}).then( response => {
  if (dali.dlproto === "1.0") {
    return dali.match(".*_MAG/JSON");
  } else {
    return dali.match(".*_M_A_G/JSON");
  }
}).then( response => {
  const start_dali = sp.luxon.DateTime.utc().minus(METER_DELAY);
  addToDebug(`Start dali for mag at ${start_dali.toISO()}`);
  return dali.positionAfter(start_dali);
}).then( response => {
  return dali.stream();
});
