import time
import math
import json

from buses import BUSES
from routes import ROUTES
from firebase_db import db
from firebase_admin import firestore


# ============================================================
# FIRESTORE STATUS MAPPING
# ============================================================

# Our existing frontend/simulator status
#        ↓
# Firestore status

STATUS_TO_FIRESTORE = {
    "ON_TIME": "ON_ROUTE",
    "DELAYED": "DELAYED",
    "BREAKDOWN": "BREAKDOWN",
    "STOPPED": "COMPLETED"
}


# Firestore status
#        ↓
# Our existing frontend/simulator status

STATUS_FROM_FIRESTORE = {
    "ON_ROUTE": "ON_TIME",
    "DELAYED": "DELAYED",
    "BREAKDOWN": "BREAKDOWN",
    "COMPLETED": "STOPPED"
}


# ============================================================
# DISTANCE CALCULATION
# ============================================================

def calculate_distance(lat1, lon1, lat2, lon2):

    return math.sqrt(
        (lat2 - lat1) ** 2 +
        (lon2 - lon1) ** 2
    )


# ============================================================
# ETA CALCULATION
# ============================================================

def calculate_eta(distance, speed):

    if speed <= 0:
        return 0

    distance_km = distance * 111

    eta_hours = distance_km / speed

    eta_minutes = eta_hours * 60

    return round(eta_minutes, 1)


# ============================================================
# LOAD BUS FROM FIRESTORE
# ============================================================

def load_bus_from_firestore(bus_id, bus):

    doc = (
        db.collection("buses")
        .document(bus_id)
        .get()
    )

    if not doc.exists:
        print(f"⚠️ {bus_id} not found in Firestore")
        return False

    data = doc.to_dict()

    # --------------------------------------------------------
    # LOCATION
    # --------------------------------------------------------

    if "latitude" in data:
        bus["latitude"] = float(data["latitude"])

    if "longitude" in data:
        bus["longitude"] = float(data["longitude"])


    # --------------------------------------------------------
    # SPEED
    # --------------------------------------------------------

    if "speed" in data:
        bus["speed"] = float(data["speed"])


    # --------------------------------------------------------
    # ROUTE
    # --------------------------------------------------------

    if "routeId" in data:

        route_id = data["routeId"]

        if route_id in ROUTES:
            bus["route_id"] = route_id


    # --------------------------------------------------------
    # STATUS
    # --------------------------------------------------------

    if "status" in data:

        firestore_status = data["status"]

        bus["status"] = STATUS_FROM_FIRESTORE.get(
            firestore_status,
            "ON_TIME"
        )


    # --------------------------------------------------------
    # TRY TO FIND CURRENT STOP
    # --------------------------------------------------------

    current_stop = data.get("currentStop")

    if current_stop:

        route = ROUTES.get(bus["route_id"])

        if route:

            for index, stop in enumerate(route["stops"]):

                if stop["name"] == current_stop:

                    bus["stop_index"] = index
                    break


    return True


# ============================================================
# SAVE BUS TO FIRESTORE
# ============================================================

def save_bus_to_firestore(bus_id, bus):

    route_id = bus["route_id"]

    route = ROUTES[route_id]

    stops = route["stops"]

    stop_index = bus["stop_index"]

    current_stop = stops[stop_index]["name"]

    next_index = (
        stop_index + 1
    ) % len(stops)

    next_stop = stops[next_index]["name"]


    firestore_status = STATUS_TO_FIRESTORE.get(
        bus["status"],
        "ON_ROUTE"
    )


    update_data = {

        # Existing Firestore fields
        "latitude": round(
            bus["latitude"],
            6
        ),

        "longitude": round(
            bus["longitude"],
            6
        ),

        "speed": bus["speed"],

        "status": firestore_status,

        "routeId": route_id,

        "currentStop": current_stop,

        "nextStop": next_stop,

        "timestamp": firestore.SERVER_TIMESTAMP
    }


    (
        db.collection("buses")
        .document(bus_id)
        .update(update_data)
    )


# ============================================================
# GET BUS DATA
# ============================================================

def get_bus_data(bus_id, bus):

    route_id = bus["route_id"]

    route = ROUTES[route_id]

    stops = route["stops"]

    stop_index = bus["stop_index"]

    current_stop = stops[stop_index]["name"]

    next_index = (
        stop_index + 1
    ) % len(stops)

    next_stop = stops[next_index]["name"]

    next_lat = stops[next_index]["lat"]

    next_lon = stops[next_index]["lon"]


    distance = calculate_distance(
        bus["latitude"],
        bus["longitude"],
        next_lat,
        next_lon
    )


    eta = calculate_eta(
        distance,
        bus["speed"]
    )


    return {

        "bus_id": bus_id,

        "route_id": route_id,

        "route_name": route["name"],

        "latitude": round(
            bus["latitude"],
            6
        ),

        "longitude": round(
            bus["longitude"],
            6
        ),

        "speed": bus["speed"],

        "status": bus["status"],

        "current_stop": current_stop,

        "next_stop": next_stop,

        "eta_minutes": eta
    }


# ============================================================
# MOVE BUS
# ============================================================

def move_bus(bus_id, bus):

    route = ROUTES[bus["route_id"]]

    stops = route["stops"]

    stop_index = bus["stop_index"]

    next_index = (
        stop_index + 1
    ) % len(stops)

    next_stop = stops[next_index]

    target_lat = next_stop["lat"]

    target_lon = next_stop["lon"]


    # ========================================================
    # STATUS CONTROL
    # ========================================================

    status = bus["status"]


    # BREAKDOWN
    # --------------------------------------------------------

    if status == "BREAKDOWN":

        return


    # STOPPED
    # --------------------------------------------------------

    if status == "STOPPED":

        return


    # DELAYED
    # --------------------------------------------------------

    if status == "DELAYED":

        movement_factor = 0.05


    # ON TIME
    # --------------------------------------------------------

    else:

        movement_factor = 0.10


    # ========================================================
    # MOVE TOWARDS NEXT STOP
    # ========================================================

    bus["latitude"] += (
        target_lat -
        bus["latitude"]
    ) * movement_factor


    bus["longitude"] += (
        target_lon -
        bus["longitude"]
    ) * movement_factor


    # ========================================================
    # CHECK STOP ARRIVAL
    # ========================================================

    distance = calculate_distance(
        bus["latitude"],
        bus["longitude"],
        target_lat,
        target_lon
    )


    if distance < 0.0005:

        bus["latitude"] = target_lat

        bus["longitude"] = target_lon

        bus["stop_index"] = next_index

        print(
            f"🛑 {bus_id} reached "
            f"{next_stop['name']}"
        )


# ============================================================
# START SIMULATION
# ============================================================

def start_simulation():

    print()
    print(
        "YUKTIX FIRESTORE BUS SIMULATION STARTED"
    )

    print(
        "----------------------------------------"
    )


    while True:

        for bus_id, bus in BUSES.items():

            try:

                # ------------------------------------------------
                # 1. Get latest status/location from Firestore
                # ------------------------------------------------

                load_bus_from_firestore(
                    bus_id,
                    bus
                )


                # ------------------------------------------------
                # 2. Move bus locally
                # ------------------------------------------------

                move_bus(
                    bus_id,
                    bus
                )


                # ------------------------------------------------
                # 3. Save new location/status to Firestore
                # ------------------------------------------------

                save_bus_to_firestore(
                    bus_id,
                    bus
                )


                # ------------------------------------------------
                # 4. Display data
                # ------------------------------------------------

                data = get_bus_data(
                    bus_id,
                    bus
                )


                print(
                    json.dumps(
                        data,
                        indent=2
                    )
                )


            except Exception as error:

                print(
                    f"❌ Error updating {bus_id}: "
                    f"{error}"
                )


        print(
            "----------------------------------------"
        )

        time.sleep(2)


# ============================================================
# RUN SIMULATOR DIRECTLY
# ============================================================

if __name__ == "__main__":

    start_simulation()