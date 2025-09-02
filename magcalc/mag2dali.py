#!/usr/bin/env python

import math
import sys
import asyncio
from functools import partial
from datetime import timedelta
import numpy as np

import simpledali
import simplemseed

class EnergyMag:
    def __init__(self):
        self.lastTime = None
        self.prev_msr = None
        pass
    def calc(self, daliPacket, windowLength=None):
        if daliPacket.streamIdType() == simpledali.MSEED_TYPE:
            msr = simplemseed.unpackMiniseedRecord(daliPacket.data)
            windowStart = self.lastTime
            sampPeriod = timedelta(seconds=1/msr.header.sampleRate)
            if self.prev_msr is not None:
                td = msr.starttime() - self.prev_msr.next_starttime()
                if td / sampPeriod < 0.25:
                    # continuous
                    print("continuous")

                    prevTS = self.prev_msr.decompress()
                    currTS = msr.decompress()
                    ts = np.concatenate( (prevTS, currTS) )
                    tsStart = self.prev_msr.starttime()

                    if windowStart is None:
                        windowStart = self.prev_msr.starttime()
                else:
                    print(f"gap {td}")
                    windowStart = self.msr.starttime()
                    tsStart = self.msr.starttime()
                    ts = msr.decompress()
            else:
                ts = msr.decompress()
                tsStart = msr.starttime()
                windowStart = msr.starttime()
            if windowStart < tsStart:
                windowStart = tsStart
            if windowLength is None:
                windowLength = timedelta(seconds=1)
            npts = int(windowLength.total_seconds() / sampPeriod.total_seconds())
            print(f"npts={npts}   sampPeriod={sampPeriod}  windowLength={windowLength}")
            startOffset = int((windowStart-tsStart).total_seconds() / sampPeriod.total_seconds())
            while startOffset+npts < len(ts):
                print(f"tsStart={tsStart}  windowStart={windowStart} startOffset={startOffset}")
                energy = 0
                for i in range(npts):
                    energy += 3*ts[startOffset+i]*ts[startOffset+i]
                energy = math.sqrt(energy)
                print(f"{windowStart} energy {energy}")
                windowStart += windowLength
                startOffset = int((windowStart-tsStart).total_seconds() / sampPeriod.total_seconds())
            self.lastTime = windowStart + windowLength

        self.prev_msr = msr
        return 1
    def extract(self, msr, start, width):
        prevTS = self.prev_msr.decompress()
        currTS = msr.decompress()
        ts = np.concatenate(prevTS, currTS)


async def slinkConnect(packetFun):
    host = "eeyore.seis.sc.edu"
    prefix = "ringserver"
    uri = f"ws://{host}/{prefix}/datalink"
    verbose = True

    programname = "simpleDali"
    username = "dragrace"
    processid = 0
    architecture = "python"

    max = 5

    print()
    print("Attempt web socket datalink:")
    async with simpledali.WebSocketDataLink(uri, verbose=verbose) as dali:
        serverId = await dali.id(programname, username, processid, architecture)
        print(f"Connect to {uri} via websocket")
        print(f"WebSocket Id: {serverId.message}")

        networkCode = "CO"
        if dali.dlproto == simpledali.DLPROTO_1_0:
            matchPattern = f"^{networkCode}_.*"
            matchPattern = f"^{networkCode}_BIRD_00_HHZ.*"
        else:
            matchPattern = f"FDSN:{networkCode}_.*"
            matchPattern = f"FDSN:{networkCode}_BIRD_00_H_H_Z.*"
        print(f"Match packets: {matchPattern}")
        await dali.match(matchPattern)


        count=0
        prev_msr = None
        async for daliPacket in dali.stream():
            count += 1
            print(f"Got Dali packet: {daliPacket}")
            prev_msr = packetFun(daliPacket)
            if count > max:
                await dali.close()
                break

def justPrint(daliPacket, prev_msr=None):
    if daliPacket.streamIdType() == simpledali.MSEED_TYPE:
        msr = simplemseed.unpackMiniseedRecord(daliPacket.data)
        if prev_msr is not None:
            td = msr.starttime() - prev_msr.next_starttime()
            sampPeriod = timedelta(seconds=1/msr.header.sampleRate)
            if td / sampPeriod < 0.25:
                # continuous
                print("continuous")
        return msr
    return None

async def main():
    energyMag = EnergyMag()
    packetFun = partial(energyMag.calc)
    await slinkConnect(packetFun)
    return 0

if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
