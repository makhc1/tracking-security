"""
Garuda Sentinel // GeoIP Enrichment & Perimeter Geodesic Calculations
Calculates forward azimuth, bearing, and bounding box intersections for tactical perimeter entry.
"""

import math

# Indonesia Tactical Viewport Bounding Box
BBOX = {
    "lat_min": -11.5,
    "lat_max": 6.5,
    "lng_min": 95.0,
    "lng_max": 141.0
}

def calculate_azimuth(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculates initial forward bearing (azimuth in degrees [0, 360)) from point 1 to point 2.
    Formula:
      theta = atan2(sin(dLng)*cos(lat2), cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(dLng))
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lng2 - lng1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    theta = math.atan2(y, x)
    bearing = (math.degrees(theta) + 360.0) % 360.0
    return round(bearing, 1)

def calculate_perimeter_entry(origin_lat: float, origin_lng: float, target_lat: float, target_lng: float) -> dict:
    """
    Finds the intersection point where a ray from the target towards the origin
    crosses the Indonesian tactical bounding box.
    """
    # Bearing from origin to target
    azimuth = calculate_azimuth(origin_lat, origin_lng, target_lat, target_lng)

    # Vector from target toward origin
    d_lat = origin_lat - target_lat
    d_lng = origin_lng - target_lng

    # If origin is already inside Indonesia boundary, treat as domestic source
    if (BBOX["lat_min"] <= origin_lat <= BBOX["lat_max"] and
        BBOX["lng_min"] <= origin_lng <= BBOX["lng_max"]):
        return {
            "sector": "DOMESTIC AIRSPACE",
            "azimuth_deg": azimuth,
            "lat": round(origin_lat, 4),
            "lng": round(origin_lng, 4),
            "is_domestic": True
        }

    intersections = []

    # Check top boundary (lat = lat_max)
    if d_lat > 0:
        t = (BBOX["lat_max"] - target_lat) / d_lat
        if t > 0:
            lng = target_lng + t * d_lng
            if BBOX["lng_min"] - 0.5 <= lng <= BBOX["lng_max"] + 0.5:
                intersections.append((t, BBOX["lat_max"], max(BBOX["lng_min"], min(BBOX["lng_max"], lng)), "NORTH"))

    # Check bottom boundary (lat = lat_min)
    if d_lat < 0:
        t = (BBOX["lat_min"] - target_lat) / d_lat
        if t > 0:
            lng = target_lng + t * d_lng
            if BBOX["lng_min"] - 0.5 <= lng <= BBOX["lng_max"] + 0.5:
                intersections.append((t, BBOX["lat_min"], max(BBOX["lng_min"], min(BBOX["lng_max"], lng)), "SOUTH"))

    # Check left boundary (lng = lng_min)
    if d_lng < 0:
        t = (BBOX["lng_min"] - target_lng) / d_lng
        if t > 0:
            lat = target_lat + t * d_lat
            if BBOX["lat_min"] - 0.5 <= lat <= BBOX["lat_max"] + 0.5:
                intersections.append((t, max(BBOX["lat_min"], min(BBOX["lat_max"], lat)), BBOX["lng_min"], "WEST"))

    # Check right boundary (lng = lng_max)
    if d_lng > 0:
        t = (BBOX["lng_max"] - target_lng) / d_lng
        if t > 0:
            lat = target_lat + t * d_lat
            if BBOX["lat_min"] - 0.5 <= lat <= BBOX["lat_max"] + 0.5:
                intersections.append((t, max(BBOX["lat_min"], min(BBOX["lat_max"], lat)), BBOX["lng_max"], "EAST"))

    if not intersections:
        # Fallback clamped perimeter entry
        p_lat = max(BBOX["lat_min"], min(BBOX["lat_max"], origin_lat))
        p_lng = max(BBOX["lng_min"], min(BBOX["lng_max"], origin_lng))
        return {
            "sector": "OUTER PERIMETER",
            "azimuth_deg": azimuth,
            "lat": round(p_lat, 4),
            "lng": round(p_lng, 4),
            "is_domestic": False
        }

    # Pick the intersection closest along the ray (minimal positive t)
    intersections.sort(key=lambda x: x[0])
    _, p_lat, p_lng, side = intersections[0]

    # Name the tactical sector
    sector = determine_sector_name(side, p_lat, p_lng)

    return {
        "sector": sector,
        "azimuth_deg": azimuth,
        "lat": round(p_lat, 4),
        "lng": round(p_lng, 4),
        "is_domestic": False
    }

def determine_sector_name(side: str, lat: float, lng: float) -> str:
    if side == "NORTH":
        if lng < 106.0:
            return "NORTH-WEST PERIMETER"
        elif lng > 130.0:
            return "NORTH-EAST PERIMETER"
        else:
            return "NORTH PERIMETER"
    elif side == "SOUTH":
        if lng < 106.0:
            return "SOUTH-WEST PERIMETER"
        elif lng > 130.0:
            return "SOUTH-EAST PERIMETER"
        else:
            return "SOUTH PERIMETER"
    elif side == "WEST":
        if lat > 0:
            return "NORTH-WEST PERIMETER"
        else:
            return "WEST PERIMETER"
    else: # EAST
        if lat > 0:
            return "NORTH-EAST PERIMETER"
        else:
            return "EAST PERIMETER"
