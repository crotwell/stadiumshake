#!/usr/bin/env python

import math
import sys
import asyncio
from functools import partial
from datetime import timedelta
import numpy as np

import simpledali
import simplemseed

networkCode = "AM"
stationCode = "R0381"

class EnergyMag:
    def __init__(self, dali):
        self.dali = dali
        self.lastTime = None
        self.prev_msr = None
        self.prev_msr_list = []
        self.dist = 100 # m
        self.rho = 2500 # kg/m3
        self.beta = 350 # m/s
        self.q_sr_r = 0.0625
        self.mul_factor = 4*math.pi*self.dist*self.dist*self.rho*self.beta
        self.gain = 360000000 # Raspberry shake counts per m/s
        self.window_millis = 1000 # window size in milliseconds
    async def calc(self, daliPacket, windowLength=None):
        out = []
        if daliPacket.streamIdType() == simpledali.MSEED_TYPE:
            msr = simplemseed.unpackMiniseedRecord(daliPacket.data)
            windowStart = self.lastTime
            sampPeriod = timedelta(seconds=1/msr.header.sampleRate)
            if len(self.prev_msr_list) != 0:
                self.prev_msr = self.prev_msr_list[-1]
                td = msr.starttime() - self.prev_msr.next_starttime()
                if td / sampPeriod < 0.25:
                    # continuous
                    #print("continuous")

                    prevTS = self.prev_msr.decompress()
                    currTS = msr.decompress()
                    ts = np.concatenate( (prevTS, currTS) )
                    tsStart = self.prev_msr.starttime()

                    if windowStart is None:
                        windowStart = self.prev_msr.starttime().replace(microsecond=0) + timedelta(milliseconds=1000)
                else:
                    print(f"gap {td}")
                    windowStart = msr.starttime().replace(microsecond=0) + timedelta(milliseconds=1000);
                    tsStart = self.msr.starttime()
                    ts = msr.decompress()
            else:
                ts = msr.decompress()
                tsStart = msr.starttime()
                windowStart = msr.starttime().replace(microsecond=0) + timedelta(milliseconds=1000);
            if windowStart < tsStart:
                windowStart = tsStart.replace(microsecond=0) + timedelta(milliseconds=1000);
            if windowLength is None:
                windowLength = timedelta(seconds=1)
            npts = int(windowLength.total_seconds() / sampPeriod.total_seconds())
            #print(f"npts={npts}   sampPeriod={sampPeriod}  windowLength={windowLength}")
            startOffset = int((windowStart-tsStart).total_seconds() / sampPeriod.total_seconds())

            if self.dali.dlproto == simpledali.DLPROTO_1_0:
                # old style
                streamid = f"{msr.header.network}_{msr.header.station}_00_MAG/JSON"
            else:
                sid = simplemseed.FDSNSourceId.fromNslc(msr.header.network, msr.header.station,"00","MAG")
                streamid = simpledali.fdsnSourceIdToStreamId(sid, simpledali.JSON_TYPE)
            mean = 0
            all_npts = 0
            for pmsr in self.prev_msr_list:
                for x in pmsr.decompress():
                    mean += x
                all_npts += len(pmsr.decompress())
            # curr packet
            for x in msr.decompress():
                mean += x
            all_npts += len(msr.decompress())
            mean = mean / all_npts
            print(f"mean: {mean} over {all_npts} points")

            while startOffset+npts < len(ts):
                #print(f"tsStart={tsStart}  windowStart={windowStart} startOffset={startOffset}")
                energy = 0
                for i in range(npts):
                    val = (ts[startOffset+i]-mean)/self.gain
                    energy += 3*val*val
                energy = self.mul_factor * self.q_sr_r * math.sqrt(energy)
                ergs = energy/1e7
                mag_per_sec = (math.log(ergs) - 9.05)/1.96
                print(f"{windowStart} energy {energy}  mag/s: {mag_per_sec}")
                jsonMessage = {
                    "st": windowStart.isoformat().replace("+00:00", "Z"),
                    "erg": ergs,
                    "mps": mag_per_sec,
                    "sid": str(msr.header.fdsnSourceId())
                }
                out.append(jsonMessage)
                hpdatastart = simpledali.datetimeToHPTime(windowStart)
                hpdataend = simpledali.datetimeToHPTime(windowStart+windowLength)
                sendResult = await self.dali.writeJSON(streamid, hpdatastart, hpdataend, jsonMessage)
                #print(f"send: {jsonMessage['st']}")
                windowStart += windowLength
                startOffset = int((windowStart-tsStart).total_seconds() / sampPeriod.total_seconds())
            self.lastTime = windowStart

            self.prev_msr = msr
            self.prev_msr_list.append(msr)
            if len(self.prev_msr_list) >= 10:
                self.prev_msr_list = self.prev_msr_list[-10:]
        return out

    def extract(self, msr, start, width):
        prevTS = self.prev_msr.decompress()
        currTS = msr.decompress()
        ts = np.concatenate(prevTS, currTS)


async def slinkConnect(packetFun):
    host = "192.168.88.10"
    host = "eeyore.seis.sc.edu"
    prefix = "ringserver"
    uri = f"ws://{host}/{prefix}/datalink"
    verbose = False

    programname = "simpleDali"
    username = "dragrace"
    processid = 0
    architecture = "python"

    max = 0

    print()
    print(f"Attempt web socket datalink to read: {uri}")
    async with simpledali.WebSocketDataLink(uri, verbose=verbose) as dali:
        serverId = await dali.id(programname, username, processid, architecture)
        print(f"Connect to {uri} via websocket")
        print(f"WebSocket Id: {serverId.message}")

        if dali.dlproto == simpledali.DLPROTO_1_0:
            matchPattern = f"^{networkCode}_{stationCode}.*"
            matchPattern = f"^{networkCode}_{stationCode}_00_HHZ.*"
        else:
            matchPattern = f"FDSN:{networkCode}_{stationCode}.*"
            matchPattern = f"FDSN:{networkCode}_{stationCode}_00_H_H_Z.*"
        print(f"Match packets: {matchPattern}")
        await dali.match(matchPattern)


        count=0
        prev_msr = None
        async for daliPacket in dali.stream():
            count += 1
            print(f"Got Dali packet: {daliPacket}")
            jdataList = await packetFun(daliPacket)
            if max > 0 and count > max:
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
    # init sending datalink
    host = "localhost"
    port = 16008
    programname = "simpleDali"
    username = "dragrace"
    processid = 0
    architecture = "python"
    verbose = False
    print(f"Attempt datalink connect {host}:{port} to write")
    async with simpledali.SocketDataLink(host, port, verbose=verbose) as dali:
        serverId = await dali.id(programname, username, processid, architecture)
        print(f"Dali Id: {serverId} to write")
        energyMag = EnergyMag(dali)
        packetFun = partial(energyMag.calc)
        await slinkConnect(packetFun)
    return 0

if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
