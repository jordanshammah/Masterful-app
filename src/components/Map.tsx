import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle } from 'lucide-react';

interface MapProps {
  professionals: Array<{
    id: string;
    display_name?: string;
    business_name?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
    rating?: number;
    hourly_rate?: number;
  }>;
  onMarkerClick?: (id: string) => void;
}

const Map = ({ professionals, onMarkerClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initAttempted = useRef(false);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      setMapError('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    if (!mapContainer.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-98.5795, 39.8283], // Center of USA
        zoom: 3,
      });

      map.current.on('load', () => {
        setIsInitialized(true);
        setMapError(null);
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Failed to load map');
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setIsInitialized(false);
      initAttempted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !isInitialized) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;

    professionals.forEach((pro) => {
      if (!pro.latitude || !pro.longitude) return;

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#D9743A'; // Brand color: Burnt Orange
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '12px';
      el.textContent = `${(pro.rating || 0).toFixed(1)}⭐`;

      try {
        // Create popup content safely without using innerHTML
        const popupDiv = document.createElement('div');
        popupDiv.style.cssText = 'padding: 8px; color: #000;';
        
        const title = document.createElement('h3');
        title.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        title.textContent = pro.display_name || pro.business_name || 'Professional';
        
        const city = document.createElement('p');
        city.style.cssText = 'margin: 4px 0;';
        city.textContent = pro.city || '';
        
        const rate = document.createElement('p');
        rate.style.cssText = 'margin: 4px 0;';
        rate.textContent = `$${pro.hourly_rate || 0}/hr`;
        
        const rating = document.createElement('p');
        rating.style.cssText = 'margin: 4px 0;';
        rating.textContent = `⭐ ${(pro.rating || 0).toFixed(1)}`;
        
        popupDiv.appendChild(title);
        popupDiv.appendChild(city);
        popupDiv.appendChild(rate);
        popupDiv.appendChild(rating);
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([pro.longitude, pro.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setDOMContent(popupDiv)
          )
          .addTo(map.current);

        if (onMarkerClick) {
          el.addEventListener('click', () => {
            onMarkerClick(pro.id);
          });
        }

        markers.current.push(marker);
        bounds.extend([pro.longitude, pro.latitude]);
        hasValidBounds = true;
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    });

    if (hasValidBounds && professionals.length > 0) {
      try {
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
        });
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    } else if (professionals.length === 0 && map.current) {
      // Reset to default view if no professionals
      map.current.setCenter([-98.5795, 39.8283]);
      map.current.setZoom(3);
    }
  }, [professionals, onMarkerClick, isInitialized]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-4">
          <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">{mapError}</p>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full rounded-lg" />;
};

export default Map;
