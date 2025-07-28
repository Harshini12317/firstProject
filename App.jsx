import React, { useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import './RouteMap.css';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// OpenRouteService API Key (Replace with your own key)
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjMyZTQwZWFkZmRjNzRmNGJhMDEyMDdmNThjM2U2MzNjIiwiaCI6Im11cm11cjY0In0=';

const App = () => {
  // State management
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [routes, setRoutes] = useState({});
  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState([]);
  const [selectedMode, setSelectedMode] = useState('driving-car');
  const [routeDetails, setRouteDetails] = useState({});

  // Transportation modes configuration
  const transportModes = [
    { 
      id: 'driving-car', 
      name: 'Car', 
      icon: '🚗', 
      color: '#2563eb',
      description: 'Fastest route by car'
    },
    { 
      id: 'cycling-regular', 
      name: 'Bicycle', 
      icon: '🚲', 
      color: '#059669',
      description: 'Bike-friendly route'
    },
    { 
      id: 'foot-walking', 
      name: 'Walking', 
      icon: '🚶‍♂️', 
      color: '#dc2626',
      description: 'Pedestrian route'
    },
    { 
      id: 'public-transport', 
      name: 'Bus/Transit', 
      icon: '🚌', 
      color: '#f59e0b',
      description: 'Public transportation route'
    }
  ];

  // Geocoding function to convert place names to coordinates
  const fetchCoordinates = async (place) => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${place}, Surat, India`,
          format: 'json',
          limit: 1
        }
      });
      
      if (response.data.length === 0) {
        throw new Error(`Location not found: ${place}`);
      }
      
      const data = response.data[0];
      return [parseFloat(data.lon), parseFloat(data.lat)];
    } catch (error) {
      console.error('Error fetching coordinates:', error);
      throw error;
    }
  };

  // Fetch route for a specific transportation mode
  const fetchRouteForMode = async (mode, fromCoord, toCoord) => {
    try {
      const response = await axios.post(
        `https://api.openrouteservice.org/v2/directions/${mode}/geojson`,
        { 
          coordinates: [fromCoord, toCoord],
          options: {
            avoid_features: [],
            round_trip: false
          }
        },
        {
          headers: {
            Authorization: ORS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.features[0];
    } catch (error) {
      console.error(`Error fetching route for ${mode}:`, error);
      return null;
    }
  };

  // Main function to fetch all routes
  const fetchAllRoutes = async () => {
    if (!from || !to) return;

    setLoading(true);
    try {
      // Get coordinates for both locations
      const fromCoord = await fetchCoordinates(from);
      const toCoord = await fetchCoordinates(to);
      setCoordinates([fromCoord, toCoord]);

      // Fetch routes for all transportation modes in parallel
      const routePromises = transportModes.map(async (mode) => {
        const route = await fetchRouteForMode(mode.id, fromCoord, toCoord);
        return { mode: mode.id, route };
      });

      const results = await Promise.all(routePromises);
      const newRoutes = {};
      const newDetails = {};

      // Process results and extract route details
      results.forEach(({ mode, route }) => {
        if (route) {
          newRoutes[mode] = route;
          const summary = route.properties.summary;
          newDetails[mode] = {
            distance: (summary.distance / 1000).toFixed(1), // Convert to km
            duration: Math.round(summary.duration / 60), // Convert to minutes
          };
        }
      });

      setRoutes(newRoutes);
      setRouteDetails(newDetails);

      // Select the fastest route by default
      if (Object.keys(newDetails).length > 0) {
        const fastestMode = Object.keys(newDetails).reduce((fastest, current) => {
          return newDetails[current].duration < newDetails[fastest].duration ? current : fastest;
        });
        setSelectedMode(fastestMode);
      }

    } catch (error) {
      console.error('Error fetching routes:', error);
      alert('Error fetching routes. Please check the location names and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleGetRoute = async (e) => {
    e.preventDefault();
    await fetchAllRoutes();
  };

  // Utility function to format duration
  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} mins`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Get configuration for a specific transportation mode
  const getModeConfig = (modeId) => {
    return transportModes.find(mode => mode.id === modeId);
  };

  return (
    <div className="route-finder-container">
      {/* Header */}
      <h2>🗺️ Smart Route Finder</h2>

      {/* Input Form */}
      <form onSubmit={handleGetRoute} className="input-section">
        <input
          type="text"
          placeholder="From (e.g. SVNIT, Adajan)"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="To (e.g. Surat Railway Station)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Finding Routes...' : 'Find Routes'}
        </button>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Calculating routes for all transportation modes...</p>
        </div>
      )}

      {/* Results Section */}
      {Object.keys(routes).length > 0 && !loading && (
        <>
          {/* Transportation Mode Tabs */}
          <div className="transport-tabs">
            {transportModes.map((mode) => (
              <button
                key={mode.id}
                className={`transport-tab ${selectedMode === mode.id ? 'active' : ''} ${!routes[mode.id] ? 'disabled' : ''}`}
                onClick={() => routes[mode.id] && setSelectedMode(mode.id)}
                disabled={!routes[mode.id]}
                style={{ '--tab-color': mode.color }}
              >
                <span className="tab-icon">{mode.icon}</span>
                <span className="tab-name">{mode.name}</span>
                {routeDetails[mode.id] && (
                  <span className="tab-time">
                    {formatDuration(routeDetails[mode.id].duration)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Map Container */}
          <div className="map-container">
            <MapContainer 
              center={[21.1702, 72.8311]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              {/* Map Tiles */}
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Route Polylines */}
              {Object.entries(routes).map(([modeId, route]) => {
                const modeConfig = getModeConfig(modeId);
                const isSelected = modeId === selectedMode;
                return (
                  <Polyline
                    key={modeId}
                    positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                    color={modeConfig.color}
                    weight={isSelected ? 6 : 3}
                    opacity={isSelected ? 0.9 : 0.4}
                    eventHandlers={{
                      click: () => setSelectedMode(modeId)
                    }}
                  />
                );
              })}

              {/* Start and End Markers */}
              {coordinates.length === 2 && (
                <>
                  <Marker position={coordinates[0].slice().reverse()}>
                    <Popup>
                      <strong>Start:</strong> {from}
                    </Popup>
                  </Marker>
                  <Marker position={coordinates[1].slice().reverse()}>
                    <Popup>
                      <strong>Destination:</strong> {to}
                    </Popup>
                  </Marker>
                </>
              )}
            </MapContainer>
          </div>

          {/* Route Details Panel */}
          <div className="route-details-panel">
            {/* Selected Route Information */}
            <div className="selected-route-info">
              <h3>
                {getModeConfig(selectedMode).icon} {getModeConfig(selectedMode).name} Route
              </h3>
              <p className="route-description">
                {getModeConfig(selectedMode).description}
              </p>
              {routeDetails[selectedMode] && (
                <div className="route-stats">
                  <div className="stat">
                    <span className="stat-label">Duration:</span>
                    <span className="stat-value">
                      {formatDuration(routeDetails[selectedMode].duration)}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Distance:</span>
                    <span className="stat-value">
                      {routeDetails[selectedMode].distance} km
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* All Routes Comparison */}
            <div className="routes-comparison">
              <h4>All Routes Comparison</h4>
              <div className="comparison-grid">
                {transportModes.map((mode) => {
                  const details = routeDetails[mode.id];
                  const isAvailable = !!details;
                  const isFastest = isAvailable && Object.keys(routeDetails).every(
                    modeKey => routeDetails[modeKey].duration >= details.duration
                  );
                  
                  return (
                    <div 
                      key={mode.id} 
                      className={`comparison-card ${!isAvailable ? 'unavailable' : ''} ${isFastest ? 'fastest' : ''}`}
                      onClick={() => isAvailable && setSelectedMode(mode.id)}
                    >
                      <div className="card-header">
                        <span className="card-icon">{mode.icon}</span>
                        <span className="card-title">{mode.name}</span>
                        {isFastest && <span className="fastest-badge">Fastest</span>}
                      </div>
                      {isAvailable ? (
                        <div className="card-details">
                          <div className="detail-row">
                            <span>⏱️ {formatDuration(details.duration)}</span>
                          </div>
                          <div className="detail-row">
                            <span>📏 {details.distance} km</span>
                          </div>
                        </div>
                      ) : (
                        <div className="card-unavailable">
                          <span>Route not available</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;