export const demoAreas = [
  { farmerId: 'demo-farmer', areaName: 'Waluj', village: 'Waluj', taluka: 'Gangapur', district: 'Chhatrapati Sambhajinagar', latitude: 19.8636, longitude: 75.2161, crop: 'Sugarcane', sowingDate: '2025-08-15', farmSize: 4.5, soilType: 'Black cotton soil', growthStage: 'Grand growth' },
  { farmerId: 'demo-farmer', areaName: 'Shendra', village: 'Shendra', taluka: 'Aurangabad', district: 'Chhatrapati Sambhajinagar', latitude: 19.9467, longitude: 75.5676, crop: 'Cotton', sowingDate: '2025-07-20', farmSize: 3.2, soilType: 'Medium black soil', growthStage: 'Flowering' },
  { farmerId: 'demo-farmer', areaName: 'Chikalthana', village: 'Chikalthana', taluka: 'Aurangabad', district: 'Chhatrapati Sambhajinagar', latitude: 19.8762, longitude: 75.3981, crop: 'Soybean', sowingDate: '2025-06-25', farmSize: 2.8, soilType: 'Loamy soil', growthStage: 'Pod filling' },
  { farmerId: 'demo-farmer', areaName: 'Kanchanwadi', village: 'Kanchanwadi', taluka: 'Aurangabad', district: 'Chhatrapati Sambhajinagar', latitude: 19.8487, longitude: 75.3396, crop: 'Onion', sowingDate: '2025-09-01', farmSize: 1.7, soilType: 'Sandy loam', growthStage: 'Bulb development' },
  { farmerId: 'demo-farmer', areaName: 'Paithan Road', village: 'Paithan Road', taluka: 'Aurangabad', district: 'Chhatrapati Sambhajinagar', latitude: 19.8354, longitude: 75.3692, crop: 'Wheat', sowingDate: '2025-11-10', farmSize: 5.1, soilType: 'Deep black soil', growthStage: 'Tillering' }
];

export const cropFactors = { Sugarcane: 1.2, Cotton: 1.05, Soybean: 0.9, Onion: 1.0, Wheat: 0.85 };

export const cropStandards = {
  Sugarcane: { intervalDays: 4, hoursPerAcre: 6, label: 'water every 4 days' },
  Cotton: { intervalDays: 6, hoursPerAcre: 6, label: 'water every 6 days' },
  Soybean: { intervalDays: 7, hoursPerAcre: 6, label: 'water every 7 days' },
  Onion: { intervalDays: 3, hoursPerAcre: 6, label: 'water every 3 days' },
  Wheat: { intervalDays: 8, hoursPerAcre: 6, label: 'water every 8 days' },
  default: { intervalDays: 7, hoursPerAcre: 6, label: 'water every 7 days' }
};
