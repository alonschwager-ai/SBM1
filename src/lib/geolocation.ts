// Thin Promise wrapper around the browser Geolocation API, shared by the
// officer check-in flow (/officer/dashboard) and the Emergency SOS widget.
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("שירותי מיקום אינם זמינים במכשיר זה"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () =>
      reject(new Error("לא ניתן היה לאתר את המיקום - יש לאשר גישה למיקום"))
    );
  });
}
