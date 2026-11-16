import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Tent,
  Utensils,
  Beer,
  ShoppingBag,
  Bed,
  Castle,
  Coffee,
  Fuel,
  Camera,
  MapPin,
  Flag,
  Waves,
} from 'lucide-react';

export type WaypointCategory =
  | 'camp'
  | 'food'
  | 'pub'
  | 'cafe'
  | 'shop'
  | 'lodging'
  | 'castle'
  | 'water'
  | 'fuel'
  | 'view'
  | 'start'
  | 'pin';

export interface WaypointMetadata {
  category: WaypointCategory;
  color: string;
}

const CATEGORY_COLORS: Record<WaypointCategory, string> = {
  camp: '#16a34a',     // green
  food: '#ea580c',     // orange
  pub: '#ca8a04',      // amber/gold
  cafe: '#d97706',     // amber
  shop: '#0284c7',     // blue
  lodging: '#7c3aed',  // purple
  castle: '#475569',   // slate
  water: '#0ea5e9',    // light blue
  fuel: '#dc2626',     // red
  view: '#059669',     // emerald
  start: '#2563eb',    // royal blue
  pin: '#e11d48',      // rose/red
};

/**
 * Classifies waypoint based on its name, description/comment, or symbol.
 */
export function classifyWaypoint(props: Record<string, any>): WaypointMetadata {
  const text = `${props.name || ''} ${props.description || ''} ${props.desc || ''} ${props.cmt || ''} ${props.sym || ''}`.toLowerCase();
  const amenity = String(props.amenity || '').toLowerCase();
  const tourism = String(props.tourism || '').toLowerCase();
  const historic = String(props.historic || '').toLowerCase();

  let category: WaypointCategory = 'pin';

  if (props.shop) {
    category = 'shop';
  } else if (amenity === 'cafe') {
    category = 'cafe';
  } else if (['restaurant', 'fast_food', 'food_court'].includes(amenity)) {
    category = 'food';
  } else if (['pub', 'bar', 'biergarten'].includes(amenity)) {
    category = 'pub';
  } else if (['camp_site', 'caravan_site'].includes(tourism)) {
    category = 'camp';
  } else if (['hotel', 'hostel', 'guest_house', 'motel'].includes(tourism)) {
    category = 'lodging';
  } else if (amenity === 'drinking_water') {
    category = 'water';
  } else if (amenity === 'fuel') {
    category = 'fuel';
  } else if (tourism === 'viewpoint') {
    category = 'view';
  } else if (historic) {
    category = 'castle';
  } else if (text.includes('camp') || text.includes('bivvy') || text.includes('tent') || text.includes('shelter')) {
    category = 'camp';
  } else if (text.includes('pub') || text.includes('bar') || text.includes('inn') || text.includes('brewery') || text.includes('beer')) {
    category = 'pub';
  } else if (text.includes('cafe') || text.includes('coffee') || text.includes('tea room') || text.includes('bakery')) {
    category = 'cafe';
  } else if (text.includes('food') || text.includes('restaurant') || text.includes('chips') || text.includes('burger') || text.includes('pizza') || text.includes('diner') || text.includes('eats')) {
    category = 'food';
  } else if (text.includes('shop') || text.includes('resupply') || text.includes('store') || text.includes('supermarket') || text.includes('grocery') || text.includes('market')) {
    category = 'shop';
  } else if (text.includes('yha') || text.includes('hostel') || text.includes('hotel') || text.includes('motel') || text.includes('b&b') || text.includes('bed') || text.includes('caravan')) {
    category = 'lodging';
  } else if (text.includes('castle') || text.includes('ruin') || text.includes('monument') || text.includes('tower') || text.includes('church') || text.includes('bridge')) {
    category = 'castle';
  } else if (text.includes('water') || text.includes('beach') || text.includes('tap') || text.includes('spring') || text.includes('lake') || text.includes('river')) {
    category = 'water';
  } else if (text.includes('petrol') || text.includes('gas') || text.includes('fuel')) {
    category = 'fuel';
  } else if (text.includes('view') || text.includes('scenic') || text.includes('lookout') || text.includes('photo')) {
    category = 'view';
  } else if (text.includes('start') || text.includes('finish') || text.includes('end')) {
    category = 'start';
  }

  return {
    category,
    color: CATEGORY_COLORS[category],
  };
}

/**
 * Renders the Lucide icon SVG element as static markup.
 */
function getIconSvg(category: WaypointCategory, size = 13): string {
  const iconProps = { size, color: '#ffffff', strokeWidth: 2.25 };
  let elem: React.ReactElement;

  switch (category) {
    case 'camp': elem = React.createElement(Tent, iconProps); break;
    case 'pub': elem = React.createElement(Beer, iconProps); break;
    case 'food': elem = React.createElement(Utensils, iconProps); break;
    case 'cafe': elem = React.createElement(Coffee, iconProps); break;
    case 'shop': elem = React.createElement(ShoppingBag, iconProps); break;
    case 'lodging': elem = React.createElement(Bed, iconProps); break;
    case 'castle': elem = React.createElement(Castle, iconProps); break;
    case 'water': elem = React.createElement(Waves, iconProps); break;
    case 'fuel': elem = React.createElement(Fuel, iconProps); break;
    case 'view': elem = React.createElement(Camera, iconProps); break;
    case 'start': elem = React.createElement(Flag, iconProps); break;
    default: elem = React.createElement(MapPin, iconProps); break;
  }

  return renderToStaticMarkup(elem);
}

/**
 * Generates teardrop map marker HTML with embedded Lucide SVG.
 */
export function createWaypointMarkerHtml(category: WaypointCategory, overrideColor?: string): string {
  const color = overrideColor || CATEGORY_COLORS[category];
  const iconSvg = getIconSvg(category, 13);

  return `
    <div class="waypoint-pin-container" style="--pin-color: ${color}">
      <div class="waypoint-pin-body">
        <div class="waypoint-pin-icon">
          ${iconSvg}
        </div>
      </div>
      <div class="waypoint-pin-tip"></div>
      <div class="waypoint-pin-shadow"></div>
    </div>
  `;
}
