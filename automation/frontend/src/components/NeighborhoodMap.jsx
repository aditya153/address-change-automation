import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './NeighborhoodMap.css';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different categories
const createIcon = (emoji) => L.divIcon({
    html: `<div class="custom-marker">${emoji}</div>`,
    className: 'custom-marker-container',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
});

const categories = [
    { id: 'all', name: 'All', emoji: '📍' },
    { id: 'shopping', name: 'Shopping', emoji: '🛒' },
    { id: 'health', name: 'Health', emoji: '🏥' },
    { id: 'transit', name: 'Transit', emoji: '🚌' },
    { id: 'food', name: 'Food', emoji: '🍕' },
];

// Sample nearby places
const getSamplePlaces = (lat, lng) => [
    { id: 1, name: 'REWE Supermarket', category: 'shopping', lat: lat + 0.002, lng: lng + 0.0015, distance: '300m' },
    { id: 2, name: 'EDEKA Market', category: 'shopping', lat: lat - 0.0015, lng: lng + 0.003, distance: '450m' },
    { id: 3, name: 'Dr. Müller Practice', category: 'health', lat: lat + 0.003, lng: lng - 0.0015, distance: '500m' },
    { id: 4, name: 'City Pharmacy', category: 'health', lat: lat - 0.001, lng: lng + 0.002, distance: '350m' },
    { id: 5, name: 'Bus Stop 101', category: 'transit', lat: lat + 0.0008, lng: lng + 0.0008, distance: '150m' },
    { id: 6, name: 'S-Bahn Station', category: 'transit', lat: lat - 0.004, lng: lng - 0.002, distance: '700m' },
    { id: 7, name: 'Pizza Roma', category: 'food', lat: lat + 0.0015, lng: lng - 0.002, distance: '400m' },
    { id: 8, name: 'Döner House', category: 'food', lat: lat - 0.002, lng: lng + 0.001, distance: '350m' },
];

function MapUpdater({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, 15);
    }, [center, map]);
    return null;
}

export default function NeighborhoodMap({ address }) {
    const [activeCategory, setActiveCategory] = useState('all');
    const [center, setCenter] = useState([49.4401, 7.7491]); // Default: Kaiserslautern
    const [places, setPlaces] = useState([]);

    useEffect(() => {
        // Initialize places immediately
        setPlaces(getSamplePlaces(center[0], center[1]));

        // Try to geocode if address provided
        if (address) {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data[0]) {
                        const lat = parseFloat(data[0].lat);
                        const lng = parseFloat(data[0].lon);
                        setCenter([lat, lng]);
                        setPlaces(getSamplePlaces(lat, lng));
                    }
                })
                .catch(err => console.log('Geocoding skipped'));
        }
    }, [address]);

    const filteredPlaces = activeCategory === 'all'
        ? places
        : places.filter(p => p.category === activeCategory);

    const getCategoryEmoji = (category) => {
        const cat = categories.find(c => c.id === category);
        return cat ? cat.emoji : '📍';
    };

    return (
        <div className="neighborhood-map-container">
            <div className="map-header">
                <h3>📍 Explore Your New Neighborhood</h3>
                <p>Discover what's around your new home</p>
            </div>

            <div className="category-filters">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                    >
                        <span className="cat-emoji">{cat.emoji}</span>
                        <span className="cat-name">{cat.name}</span>
                        {activeCategory === cat.id && cat.id !== 'all' && (
                            <span className="cat-count">
                                {places.filter(p => p.category === cat.id).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="map-content">
                <div className="map-wrapper">
                    <MapContainer center={center} zoom={15} className="leaflet-map">
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapUpdater center={center} />

                        {/* Home marker */}
                        <Marker position={center} icon={createIcon('🏠')}>
                            <Popup><strong>🏠 Your New Home</strong></Popup>
                        </Marker>

                        {/* Place markers - always rendered based on filter */}
                        {filteredPlaces.map((place) => (
                            <Marker
                                key={place.id}
                                position={[place.lat, place.lng]}
                                icon={createIcon(getCategoryEmoji(place.category))}
                            >
                                <Popup>
                                    <strong>{place.name}</strong><br />
                                    📍 {place.distance}
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                <div className="places-list">
                    <h4>Nearby ({filteredPlaces.length})</h4>
                    {filteredPlaces.length === 0 ? (
                        <p className="no-places">No places in this category</p>
                    ) : (
                        <div className="places-grid">
                            {filteredPlaces.map((place) => (
                                <div key={place.id} className="place-card">
                                    <span className="place-emoji">{getCategoryEmoji(place.category)}</span>
                                    <div className="place-info">
                                        <strong>{place.name}</strong>
                                        <span>{place.distance}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
