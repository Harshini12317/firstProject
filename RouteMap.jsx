import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import './RouteMap.css';

import 'leaflet/dist/leaflet.css';

const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjMyZTQwZWFkZmRjNzRmNGJhMDEyMDdmNThjM2U2MzNjIiwiaCI6Im11cm11cjY0In0='; // <-- Replace with your key

const RouteFinder = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [travelTimes, setTravelTimes] = useState({});
  const [coordinates, setCoordinates] = useState([]);

  const transportModes = ['cycling-regular', 'driving-car', 'foot-walking'];

  const fetchCoordinates = async (place) => {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${place}, Surat, India`,
        format: 'json',
        limit: 1
      }
    });
    const data = res.data[0];
    return [parseFloat(data.lon), parseFloat(data.lat)];
  };

  const getFastestRouteIndex = (routes) => {
    return routes.reduce((fastest, current, idx, arr) => {
      return current.properties.summary.duration < arr[fastest].properties.summary.duration ? idx : fastest;
    }, 0);
  };

  const fetchRoutes = async () => {
    if (!from || !to) return;

    try {
      const fromCoord = await fetchCoordinates(from);
      const toCoord = await fetchCoordinates(to);
      const coords = [fromCoord, toCoord];
      setCoordinates(coords);

      const res = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        { coordinates: coords },
        {
          headers: {
            Authorization: ORS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      const routeData = res.data.features;
      setRoutes(routeData);
      setSelectedRouteIdx(getFastestRouteIndex(routeData));
    } catch (err) {
      alert('Error fetching routes. Check place names or API key.');
      console.error(err);
    }
  };

  const fetchTravelTimes = async () => {
    if (!from || !to) return;
    const times = {};
    try {
      const fromCoord = await fetchCoordinates(from);
      const toCoord = await fetchCoordinates(to);
      for (let mode of transportModes) {
        try {
          const res = await axios.post(
            `https://api.openrouteservice.org/v2/directions/${mode}`,
            { coordinates: [fromCoord, toCoord] },
            {
              headers: {
                Authorization: ORS_API_KEY,
                'Content-Type': 'application/json'
              }
            }
          );
          times[mode] = Math.round(res.data.routes[0].summary.duration / 60);
        } catch {
          times[mode] = '-';
        }
      }
    } catch {
      times['all'] = '-';
    }
    setTravelTimes(times);
  };

  const handleGetRoute = async (e) => {
    e.preventDefault();
    await fetchRoutes();
    await fetchTravelTimes();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Commuto - Surat Route Finder</h1>

      <form onSubmit={handleGetRoute} style={styles.form}>
        <input
          type="text"
          placeholder="From (e.g. SVNIT)"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={styles.input}
          required
        />
        <input
          type="text"
          placeholder="To (e.g. Surat Railway Station)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={styles.input}
          required
        />
        <button type="submit" style={styles.button}>Get Route</button>
      </form>

      {routes.length > 0 && (
        <>
          <MapContainer center={[21.1702, 72.8311]} zoom={13} style={styles.map}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {routes.map((route, idx) => (
              <Polyline
                key={idx}
                positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                color={idx === selectedRouteIdx ? 'darkblue' : 'lightblue'}
                weight={idx === selectedRouteIdx ? 6 : 4}
                opacity={0.8}
                eventHandlers={{
                  click: () => setSelectedRouteIdx(idx)
                }}
              />
            ))}

            {coordinates.length === 2 && (
              <>
                <Marker position={coordinates[0].slice().reverse()}>
                  <Popup>Start: {from}</Popup>
                </Marker>
                <Marker position={coordinates[1].slice().reverse()}>
                  <Popup>End: {to}</Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          <div style={styles.estimates}>
            <h3>Estimated Travel Time:</h3>
            <ul style={styles.ul}>
              <li>🚗 Car: {travelTimes['driving-car']} mins</li>
              <li>🚲 Bike: {travelTimes['cycling-regular']} mins</li>
              <li>🚶‍♂️ Walk: {travelTimes['foot-walking']} mins</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};



export default RouteFinder;
