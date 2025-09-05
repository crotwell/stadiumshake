

export function createWebSocketURL(linktype) {
  const loc = new URL(`/${linktype}`, window.location.href);
  if (loc.hostname.startsWith("eeyore")) {
    loc.pathname = `/intringserver/${linktype}`;
  } else if (loc.hostname === "localhost") {
    if (linktype === "seedlink") {
      loc.hostname = "eeyore.seis.sc.edu";
      loc.port = "443";
      loc.protocol = "wss";
      loc.pathname = `/intringserver/${linktype}`;
    } else {
      loc.pathname = `/${linktype}`;
      loc.port = 16000;
      loc.protocol = loc.protocol.replace("http", "ws");
    }
  } else {
    // assume onlogic
    loc.pathname = `/ring/${linktype}`;
  }
  if (loc.protocol === "https") {
    loc.protocol = loc.protocol.replace("https", "wss");
  } else {
    loc.protocol = loc.protocol.replace("http", "ws");
  }
  return loc;
}
