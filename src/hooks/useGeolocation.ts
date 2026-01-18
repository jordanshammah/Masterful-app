/**
 * Geolocation Hook
 * Get user's location with proper error handling
 */

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export interface UserLocation {
  lat: number;
  lng: number;
}

export const useGeolocation = (autoRequest = false) => {
  const { toast } = useToast();
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = () => {
    setLoading(true);
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
        toast({
          title: "Location enabled",
          description: "Showing nearby professionals",
        });
      },
      (err) => {
        let errorMessage = "Unable to get your location";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = "Location permission denied";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case err.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        setError(errorMessage);
        setLoading(false);
        toast({
          title: "Location unavailable",
          description: "Showing all professionals sorted by rating",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  useEffect(() => {
    if (autoRequest) {
      requestLocation();
    }
  }, [autoRequest]);

  return {
    location,
    loading,
    error,
    requestLocation,
  };
};

