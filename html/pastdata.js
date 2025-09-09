// snip start querystation
import * as sp from "./seisplotjs_3.1.5-SNAPSHOT_standalone.js";
sp.util.updateVersionText(".sp_version");

const timeWindow = sp.util.startDuration("2025-09-07T01:00:00Z", 7100);

document.querySelector("button.kickoff").addEventListener("click", () => {
  loadData(timeWindow);
});

function loadData(timeWindow) {
  const seisurl = "http://192.168.88.10/mseed/AM/R0381/2025/250/AM.R0381.00.EHZ.2025.250.02"
  const baseUrl = "https://eeyore.seis.sc.edu/scsn/stadiumdata/mseed";
  let mseedQ = new sp.mseedarchive.MSeedArchive(
            baseUrl,
            "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H",
          );


  let sdd_1c = sp.seismogram.SeismogramDisplayData.fromCodesAndTimes(
    "AM", "R0381","00","EHZ",
    timeWindow.start,timeWindow.end
  );
  let seisData = [sdd_1c];
  for (let chan of ["EHZ", "EHN", "EHE"]) {
    seisData.push(sp.seismogram.SeismogramDisplayData.fromCodesAndTimes(
      "AM", "R71D7","00",chan,
      timeWindow.start,timeWindow.end
    ));
  }
  let markList = [
    {
  	  name: "kickoff",
  	  time: sp.util.checkStringOrDate("2025-09-07T01:21:00Z")
    },
    {
  	  name: "touchdown1",
  	  time: sp.util.checkStringOrDate("2025-09-07T02:26:33Z")
    },
    {
  	  name: "sandstorm1",
  	  time: sp.util.checkStringOrDate("2025-09-07T02:30:10Z")
    },
    {
  	  name: "touchdown2",
  	  time: sp.util.checkStringOrDate("2025-09-07T02:35:17Z")
    },
    {
  	  name: "sandstorm2",
  	  time: sp.util.checkStringOrDate("2025-09-07T02:37:02Z")
    },
    {
  	  name: "DanTap",
  	  time: sp.util.checkStringOrDate("2025-09-07T00:20:00Z")
    },
    {
  	  name: "DanTapObserved",
  	  time: sp.util.checkStringOrDate("2025-09-06T23:30:00Z")
    },
    {
  	  name: "RampPower",
  	  time: sp.util.checkStringOrDate("2025-09-06T23:20:30Z")
    }
  ];

  const orgDisp = document.querySelector("sp-organized-display");
  let seisConfig = new sp.seismographconfig.SeismographConfig();
  seisConfig.amplitudeMean();
  seisData.forEach( sdd => {
    markList.forEach( m => {
      sdd.addMarker(m);
    });
  });
  orgDisp.seismographConfig = seisConfig;
  orgDisp.seisData = seisData;

  mseedQ.loadSeismograms(seisData)
    .then((seisArray) => {
      orgDisp.redraw();
    })
    .catch(function (error) {
      const div = document.querySelector("div#message");
      div.innerHTML = `
        <p>Error loading data. ${error}</p>
      `;
      console.assert(false, error);
    });
}

const rangeInputList = document.querySelectorAll("sp-timerange");
for (const rangeInput of rangeInputList) {
  rangeInput.updateTimeRange(timeWindow);
  rangeInput.updateCallback = (timeRange) => {
    loadData(timeRange);
  };
}

loadData(timeWindow);
