# Yuktix Tracking API

## Base URL

http://localhost:3001

## Get All Buses

### GET /buses

Returns all buses currently stored in Firestore.

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "BUS101",
      "busNumber": "101",
      "routeId": "R01",
      "status": "ON_ROUTE",
      "speed": 32,
      "latitude": 28.6139,
      "longitude": 77.209
    }
  ]
}