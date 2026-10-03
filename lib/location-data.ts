export interface LocationOption {
  value: string;
  label: string;
}

export interface RegionData {
  label: string;
  states: LocationOption[];
}

export interface CountryData {
  label: string;
  regions: Record<string, RegionData>;
}

export const LOCATION_DATA: Record<string, CountryData> = {
  France: {
    label: "France",
    regions: {
      "North West": {
        label: "Nord-Ouest",
        states: [
          { value: "Brittany", label: "Bretagne" },
          { value: "Normandy", label: "Normandie" },
          { value: "Pays de la Loire", label: "Pays de la Loire" },
        ],
      },
      "North East": {
        label: "Nord-Est",
        states: [
          { value: "Hauts-de-France", label: "Hauts-de-France" },
          { value: "Grand Est", label: "Grand Est" },
        ],
      },
      "Parisian Region": {
        label: "Île-de-France",
        states: [
          { value: "Paris", label: "Paris" },
          { value: "Seine-et-Marne", label: "Seine-et-Marne" },
          { value: "Yvelines", label: "Yvelines" },
        ],
      },
      "South West": {
        label: "Sud-Ouest",
        states: [
          { value: "Nouvelle-Aquitaine", label: "Nouvelle-Aquitaine" },
          { value: "Occitanie", label: "Occitanie" },
        ],
      },
      "South East": {
        label: "Sud-Est",
        states: [
          { value: "Auvergne-Rhône-Alpes", label: "Auvergne-Rhône-Alpes" },
          { value: "Provence-Alpes-Côte d'Azur", label: "PACA" },
          { value: "Corsica", label: "Corse" },
        ],
      },
    },
  },
  "United States": {
    label: "États-Unis",
    regions: {
      West: {
        label: "West",
        states: [
          { value: "California", label: "California" },
          { value: "Washington", label: "Washington" },
          { value: "Oregon", label: "Oregon" },
        ],
      },
      Northeast: {
        label: "Northeast",
        states: [
          { value: "New York", label: "New York" },
          { value: "Massachusetts", label: "Massachusetts" },
          { value: "Pennsylvania", label: "Pennsylvania" },
        ],
      },
    },
  },
};
