"""Nearest branch of a chain to a ZIP code, from OpenStreetMap (Nominatim + Overpass; free, keyless).
Address and distance only. Never prices: those stay chain-level online listings."""
import math
import time

import requests

from .schemas import NearbyStore

_UA = {"User-Agent": "FairFare-hackathon/1.0 (meal planner demo)"}
_BRAND_QUERY = {"kroger": "Kroger", "walmart": "Walmart", "aldi": "ALDI", "target": "Target", "publix": "Publix"}
_cache: dict[tuple[str, str], tuple[float, NearbyStore | None]] = {}
_geo_cache: dict[str, tuple[float, float] | None] = {}
CACHE_S = 6 * 3600


def geocode_zip(zip_code: str) -> tuple[float, float] | None:
    """ZIP -> (lat, lon) via Nominatim; None when unknown or the service is unreachable."""
    z = zip_code.strip()
    if z in _geo_cache:
        return _geo_cache[z]
    try:
        r = requests.get("https://nominatim.openstreetmap.org/search",
                         params={"postalcode": z, "country": "US", "format": "json", "limit": 1},
                         headers=_UA, timeout=10)
        r.raise_for_status()
        hits = r.json()
        out = (float(hits[0]["lat"]), float(hits[0]["lon"])) if hits else None
    except Exception:
        out = None
    _geo_cache[z] = out
    return out


def _miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 7917.5 * math.asin(math.sqrt(a))


def _address(tags: dict) -> str:
    parts = [" ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x), tags.get("addr:city")]
    return ", ".join(x for x in parts if x) or (tags.get("name") or "")


def nearest(store: str, lat: float, lon: float, radius_m: int = 30000) -> NearbyStore | None:
    """Closest OSM supermarket tagged with the chain's brand within radius_m; None if none or on any error."""
    brand = _BRAND_QUERY.get(store)
    if not brand:
        return None
    key = (store, f"{lat:.3f},{lon:.3f}")
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_S:
        return hit[1]
    query = (
        f'[out:json][timeout:20];(node["shop"]["brand"~"{brand}",i](around:{radius_m},{lat},{lon});'
        f'way["shop"]["brand"~"{brand}",i](around:{radius_m},{lat},{lon});'
        f'node["shop"]["name"~"{brand}",i](around:{radius_m},{lat},{lon});'
        f'way["shop"]["name"~"{brand}",i](around:{radius_m},{lat},{lon}););out center tags;'
    )
    result: NearbyStore | None = None
    try:
        r = requests.post("https://overpass-api.de/api/interpreter", data={"data": query}, headers=_UA, timeout=25)
        r.raise_for_status()
        best = None
        for el in r.json().get("elements", []):
            plat = el.get("lat") or (el.get("center") or {}).get("lat")
            plon = el.get("lon") or (el.get("center") or {}).get("lon")
            if plat is None or plon is None:
                continue
            d = _miles(lat, lon, plat, plon)
            if best is None or d < best[0]:
                best = (d, plat, plon, el.get("tags", {}))
        if best:
            d, plat, plon, tags = best
            result = NearbyStore(store=store, name=tags.get("name") or brand, address=_address(tags),
                                 distance_miles=round(d, 1), lat=plat, lon=plon,
                                 maps_url=f"https://www.google.com/maps/search/?api=1&query={plat},{plon}")
    except Exception:
        return None  # service hiccup: do not cache, so the next request tries again
    _cache[key] = (time.time(), result)
    return result


def nearby_for_zip(zip_code: str, store_ids: list[str]) -> list[NearbyStore]:
    """Nearest branch of each chain to a ZIP; chains with no hit are simply absent."""
    geo = geocode_zip(zip_code)
    if not geo:
        return []
    out: list[NearbyStore] = []
    for sid in store_ids:
        hit = nearest(sid, *geo)
        if hit:
            out.append(hit)
    return out
