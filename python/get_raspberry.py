#!/usr/bin/env python

from pathlib import Path
import sys
import obspy
from obspy.clients.fdsn import Client

def loadTimeWindow(start,
                   timewidth,
                   station="R71D7",
                   hostUrl="http://eeyore.seis.sc.edu"):
    """
    Loads a timewindow of data for a raspberry shake from eeyore.
    """
    service_mappings={'event': None, 'station': None}
    scsn = Client(hostUrl, service_mappings=service_mappings)

    waveform_start = obspy.UTCDateTime(start)
    networkCode="AM"
    locCode="00"

    bulk = []
    for chanCode in ["EHZ", "EHN", "EHE", "HHZ"]:
        bulk.append( (networkCode, station, locCode, chanCode, waveform_start, waveform_start+timewidth))
    for b in bulk:
        print(b)
    st = scsn.get_waveforms_bulk(bulk)
    return st

def main():
    dataDir=Path("data")
    dataDir.mkdir(exist_ok=True)
    station="R71D7"

    # load 120 seconds of data starting at the given time
    st = loadTimeWindow("2025-08-27T01:02:03", 120)
    # save as miniseed
    st.write("raw_waveform.mseed", format="MSEED")

    # load inventory (station metadata)
    inv_file = f"../response/AM_{station}.staml"
    if Path(inv_file).exists():
        inv = obspy.read_inventory(inv_file)

        st.remove_response(inventory=inv, output="DISP")
        st.write("disp.mseed", format="MSEED")

    sacDir = Path(dataDir, "sac")
    sacDir.mkdir(exist_ok=True)
    for tr in st:
        tr.write(f"{sacDir}/{tr.id}.sac", format="SAC")
    return 0

if __name__ == "__main__":
    sys.exit(main())
