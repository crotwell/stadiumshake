#!/usr/bin/env python

import sys
from pathlib import Path
import sys
import obspy
from obspy.clients.fdsn import Client
from get_raspberry import loadTimeWindow


def main():

    dataDir=Path("data")
    dataDir.mkdir(exist_ok=True)
    station="R71D7"

    # load 120 seconds of data starting at the given time
    start = "2025-08-27T01:02:03"
    duration = 120
    st = loadTimeWindow(start, duration, station=station)
    # save as miniseed into data dir
    mseedFile = Path(dataDir, "raw_waveform.mseed")
    st.write(mseedFile, format="MSEED")

    # load inventory (station metadata)
    inv_file = f"../response/AM_{station}.staml"
    if Path(inv_file).exists():
        inv = obspy.read_inventory(inv_file)

        # correct for instrument response
        st.remove_response(inventory=inv, output="DISP")
        mseedFile = Path(dataDir, "displacement.mseed")
        st.write(mseedFile, format="MSEED")

        # also save response corrected data as sac
        sacDir = Path(dataDir, "sac")
        sacDir.mkdir(exist_ok=True)
        for tr in st:
            sacFile = Path(sacDir, f"{sacDir}/{tr.id}.sac")
            tr.write(sacFile, format="SAC")

    # plot it on screen
    st.plot()
    return 0


if __name__ == "__main__":
    sys.exit(main())
