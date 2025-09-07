// snip start querystation
import * as sp from "./seisplotjs_3.1.5-SNAPSHOT_standalone.js";
sp.util.updateVersionText(".sp_version");

const timeWindow = sp.util.startDuration("2025-09-07T01:00:00Z", 7100);

document.querySelector("button.kickoff").addEventListener("click", () => {
  loadData(timeWindow);
});

function loadData(timeWindow) {
  const seisurl = "http://192.168.88.10/mseed/AM/R0381/2025/250/AM.R0381.00.EHZ.2025.250.02"
  const baseUrl = "http://eeyore.seis.sc.edu/scsn/stadiumdata/mseed";
  let mseedQ = new sp.mseedarchive.MSeedArchive(
            baseUrl,
            "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H",
          );


  let sdd_1c = sp.seismogram.SeismogramDisplayData.fromCodesAndTimes(
    "AM", "R0381","00","EHZ",
    timeWindow.start,timeWindow.end
  );
  let markList = [
    {
  	  name: "kickoff",
  	  time: sp.util.checkStringOrDate("2025-09-07T01:21:00Z")
    }
  ];

  const div = document.querySelector("div#myseismograph");
  div.innerHTML = "";
  let seisConfig = new sp.seismographconfig.SeismographConfig();
  seisConfig.amplitudeMean();
  let seisData = [sdd_1c];
  seisData.forEach( sdd => {
      markList.forEach( m => {
  	sdd.addMarker(m);
      });
  });

  let graph = new sp.seismograph.Seismograph(seisData, seisConfig);
  div.appendChild(graph);

  mseedQ.loadSeismograms(seisData)
    .then((seisArray) => {
  	  graph.seisData = seisData;
  	  graph.redraw();
    })
    .catch(function (error) {
      const div = document.querySelector("div#myseismograph");
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
