export interface AqiCategory {
  label: string
  range: string
  max: number
  color: string
  textColor: string
}

export const AQI_CATEGORIES: AqiCategory[] = [
  { label: 'Good', range: '0-50', max: 50, color: '#00b050', textColor: '#09090b' },
  { label: 'Satisfactory', range: '51-100', max: 100, color: '#92d050', textColor: '#09090b' },
  { label: 'Moderate', range: '101-200', max: 200, color: '#ffff00', textColor: '#09090b' },
  { label: 'Poor', range: '201-300', max: 300, color: '#ff9900', textColor: '#09090b' },
  { label: 'Very Poor', range: '301-400', max: 400, color: '#ff0000', textColor: '#09090b' },
  { label: 'Severe', range: '401+', max: Infinity, color: '#800000', textColor: '#fafafa' },
]

export function getAqiCategory(aqi: number): AqiCategory {
  return AQI_CATEGORIES.find((category) => aqi <= category.max) ?? AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
}
