from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

from buses import BUSES
from routes import ROUTES
from firebase_db import db


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)
CORS(app)


# ============================================================
# MEMBER 3 TRACKING API
# ============================================================

# Member 3's laptop IP address
MEMBER3_API = "http://172.25.241.37:3001"


# ============================================================
# FIRESTORE HELPERS
# ============================================================

def get_firestore_bus(bus_id):
    """
    Read a bus directly from Firestore.
    """

    try:
        doc = db.collection("buses").document(bus_id).get()

        if not doc.exists:
            return None

        return doc.to_dict()

    except Exception as error:
        print(f"Firestore read error for {bus_id}: {error}")
        return None


def load_bus_from_firestore(bus_id):
    """
    Load Firestore data and merge it into the local bus data.
    """

    firestore_data = get_firestore_bus(bus_id)

    if firestore_data is None:
        return BUSES.get(bus_id)

    local_data = BUSES.get(bus_id, {}).copy()

    local_data.update(firestore_data)

    return local_data


# ============================================================
# RESPONSE FORMAT
# ============================================================

def prepare_bus_response(bus_id):
    """
    Prepare a consistent bus response for Admin and Conductor.
    """

    bus = load_bus_from_firestore(bus_id)

    if bus is None:
        return None

    route_id = (
        bus.get("routeId")
        or bus.get("route_id")
        or bus.get("routeNumber")
        or bus.get("route_number")
    )

    bus_number = (
        bus.get("busNumber")
        or bus.get("bus_number")
        or bus_id.replace("BUS", "")
    )

    status = bus.get("status", "UNKNOWN")

    eta = (
        bus.get("etaMinutes")
        if bus.get("etaMinutes") is not None
        else bus.get("eta_minutes")
    )

    current_stop = (
        bus.get("currentStop")
        or bus.get("current_stop")
    )

    next_stop = (
        bus.get("nextStop")
        or bus.get("next_stop")
    )

    latitude = bus.get("latitude")
    longitude = bus.get("longitude")

    speed = bus.get("speed", 0)

    route_number = (
        bus.get("routeNumber")
        or bus.get("route_number")
        or route_id
    )

    route_name = bus.get("route_name")

    if not route_name and route_id in ROUTES:
        route_name = ROUTES[route_id].get("name")

    timestamp = bus.get("timestamp")

    if timestamp is not None:
        try:
            timestamp = str(timestamp)
        except Exception:
            timestamp = None

    return {
        "id": bus_id,
        "bus_id": bus_id,

        "busNumber": bus_number,
        "bus_number": bus_number,

        "routeId": route_id,
        "route_id": route_id,

        "routeNumber": route_number,
        "route_number": route_number,

        "route_name": route_name,

        "status": status,

        "latitude": latitude,
        "longitude": longitude,

        "speed": speed,

        "currentStop": current_stop,
        "current_stop": current_stop,

        "nextStop": next_stop,
        "next_stop": next_stop,

        "etaMinutes": eta,
        "eta_minutes": eta,

        "timestamp": timestamp
    }


# ============================================================
# ROOT
# ============================================================

@app.route("/")
def home():

    return jsonify({
        "success": True,
        "message": "YUKTIX Flask API is running",
        "member3_api": MEMBER3_API
    })


# ============================================================
# GET ALL BUSES
# ============================================================

@app.route("/api/buses", methods=["GET"])
def get_all_buses():

    buses = []

    for bus_id in BUSES.keys():

        bus = prepare_bus_response(bus_id)

        if bus:
            buses.append(bus)

    return jsonify(buses)


# ============================================================
# GET SINGLE BUS
# ============================================================

@app.route("/api/buses/<bus_id>", methods=["GET"])
def get_single_bus(bus_id):

    bus = prepare_bus_response(bus_id)

    if bus is None:
        return jsonify({
            "success": False,
            "message": "Bus not found"
        }), 404

    return jsonify(bus)


# ============================================================
# GET ROUTES
# ============================================================

@app.route("/api/routes", methods=["GET"])
def get_routes():

    return jsonify(ROUTES)


# ============================================================
# UPDATE BUS STATUS
# ============================================================

@app.route("/api/buses/<bus_id>/status", methods=["PUT"])
def update_bus_status(bus_id):

    data = request.get_json(silent=True) or {}

    status = data.get("status")

    if not status:
        return jsonify({
            "success": False,
            "message": "Status is required"
        }), 400

    allowed_statuses = [
        "ON_ROUTE",
        "DELAYED",
        "BREAKDOWN",
        "COMPLETED"
    ]

    if status not in allowed_statuses:

        return jsonify({
            "success": False,
            "message": (
                f"Invalid status '{status}'. "
                f"Allowed statuses: {', '.join(allowed_statuses)}"
            )
        }), 400

    # --------------------------------------------------------
    # Send status update to Member 3's API
    # --------------------------------------------------------

    try:

        response = requests.patch(
            f"{MEMBER3_API}/buses/{bus_id}/status",
            json={
                "status": status
            },
            timeout=5
        )

        try:
            result = response.json()
        except Exception:
            result = {
                "message": response.text
            }

        if not response.ok:

            return jsonify({
                "success": False,
                "message": (
                    result.get("message")
                    or result.get("error")
                    or "Member 3 API rejected the status update"
                )
            }), response.status_code

        return jsonify({
            "success": True,
            "message": "Bus status updated successfully",
            "status": status,
            "member3_response": result
        })

    except requests.exceptions.ConnectionError:

        return jsonify({
            "success": False,
            "message": (
                "Member 3 Tracking API could not be reached "
                "at 172.25.241.37:3001."
            )
        }), 503

    except requests.exceptions.Timeout:

        return jsonify({
            "success": False,
            "message": (
                "Member 3 Tracking API request timed out."
            )
        }), 504

    except Exception as error:

        print(f"Status update error: {error}")

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ============================================================
# START TRIP
# ============================================================

@app.route("/api/buses/<bus_id>/start", methods=["POST"])
def start_trip(bus_id):

    return update_status_internal(
        bus_id,
        "ON_ROUTE",
        "Trip started successfully."
    )


# ============================================================
# END TRIP
# ============================================================

@app.route("/api/buses/<bus_id>/end", methods=["POST"])
def end_trip(bus_id):

    return update_status_internal(
        bus_id,
        "COMPLETED",
        "Trip completed successfully."
    )


# ============================================================
# INTERNAL STATUS UPDATE
# ============================================================

def update_status_internal(bus_id, status, success_message):

    try:

        response = requests.patch(
            f"{MEMBER3_API}/buses/{bus_id}/status",
            json={
                "status": status
            },
            timeout=5
        )

        try:
            result = response.json()
        except Exception:
            result = {
                "message": response.text
            }

        if not response.ok:

            return jsonify({
                "success": False,
                "message": (
                    result.get("message")
                    or result.get("error")
                    or "Member 3 API rejected the request"
                )
            }), response.status_code

        return jsonify({
            "success": True,
            "message": success_message,
            "status": status,
            "member3_response": result
        })

    except requests.exceptions.ConnectionError:

        return jsonify({
            "success": False,
            "message": (
                "Member 3 Tracking API is not reachable "
                "at 172.25.241.37:3001."
            )
        }), 503

    except requests.exceptions.Timeout:

        return jsonify({
            "success": False,
            "message": (
                "Member 3 Tracking API request timed out."
            )
        }), 504

    except Exception as error:

        print(f"Trip status error: {error}")

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    print("==========================================")
    print("YUKTIX Flask API")
    print("==========================================")
    print("Flask API: http://127.0.0.1:5000")
    print(f"Member 3 API: {MEMBER3_API}")
    print("==========================================")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False
    )