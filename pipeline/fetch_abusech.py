"""
Garuda Sentinel // abuse.ch & OSINT Threat Fetcher (`pipeline/fetch_abusech.py`)
Collects botnet C2 nodes, brute-force indicators, and malware distribution hosts
from abuse.ch (Feodo Tracker, ThreatFox) and SANS ISC DShield.
"""

import json
import urllib.request
from typing import List, Dict, Any

FEODO_BLOCKLIST_URL = "https://feodotracker.abuse.ch/downloads/ipblocklist.json"
DSHIELD_TOP_URL = "https://secure.dshield.org/api/topips/records/25?json"

def fetch_feodo_c2_nodes() -> List[Dict[str, Any]]:
    """Fetches high-confidence botnet C2 servers from Feodo Tracker."""
    iocs = []
    try:
        req = urllib.request.Request(
            FEODO_BLOCKLIST_URL,
            headers={"User-Agent": "GarudaSentinel-ThreatWatch/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for entry in data:
                ip = entry.get("ip_address")
                if ip:
                    iocs.append({
                        "ip": ip,
                        "port": entry.get("port", 443),
                        "status": entry.get("status", "unknown"),
                        "asn": f"AS{entry.get('as_number', '0')}",
                        "as_name": entry.get("as_name", "Unknown ASN"),
                        "country": entry.get("country", "ZZ"),
                        "malware": entry.get("malware", "Botnet C2"),
                        "first_seen": entry.get("first_seen", ""),
                        "source": "abuse.ch (Feodo Tracker)"
                    })
    except Exception as e:
        print(f"[WARN] Failed to fetch Feodo Tracker feed: {e}")
    return iocs

def fetch_dshield_scanners() -> List[Dict[str, Any]]:
    """Fetches top attack origin scanners from SANS ISC DShield."""
    scanners = []
    try:
        req = urllib.request.Request(
            DSHIELD_TOP_URL,
            headers={"User-Agent": "GarudaSentinel-ThreatWatch/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for entry in data:
                ip = entry.get("source")
                if ip:
                    scanners.append({
                        "ip": ip,
                        "reports": entry.get("reports", 0),
                        "targets": entry.get("targets", 0),
                        "source": "SANS ISC DShield"
                    })
    except Exception as e:
        print(f"[WARN] Failed to fetch DShield top IPs: {e}")
    return scanners

if __name__ == "__main__":
    feodo = fetch_feodo_c2_nodes()
    print(f"Feodo nodes found: {len(feodo)}")
    dshield = fetch_dshield_scanners()
    print(f"DShield scanners found: {len(dshield)}")
