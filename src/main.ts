import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts"; //Fixes missing marker images
import luck from "./luck.ts"; //Random number generator

//Creating Constant Gameplay Variables
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
let playerCoins = 0;

//Creating Initial Location, Map, and Player
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});
leaflet
  .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("YOU");
playerMarker.addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Player Coins: 0";

//FLYWEIGHT PATTERN
const cacheFlyweightFactory = (() => {
  const cacheProperties = {
    tileDegrees: TILE_DEGREES,
    spawnProbability: CACHE_SPAWN_PROBABILITY,
  };

  function calculateBounds(
    latBase: number,
    longBase: number,
    i: number,
    j: number,
  ) {
    const lat1 = latBase + i * cacheProperties.tileDegrees;
    const lat2 = latBase + (i + 1) * cacheProperties.tileDegrees;
    const long1 = longBase + j * cacheProperties.tileDegrees;
    const long2 = longBase + (j + 1) * cacheProperties.tileDegrees;

    if (isNaN(lat1) || isNaN(lat2) || isNaN(long1) || isNaN(long1)) {
      console.error(
        `Invalid LatLng values: (${lat1}, ${long1}, ${lat2}, ${long2})`,
      );
    }

    const bounds = leaflet.latLngBounds([
      [lat1, long1],
      [lat2, long2],
    ]);

    return bounds;
  }

  function shouldSpawnCache(i: number, j: number): boolean {
    return luck([i, j].toString()) < cacheProperties.spawnProbability;
  }

  return { calculateBounds, shouldSpawnCache };
})();

//FUNCTIONS --------------------
function spawnCache(i: number, j: number) {
  const bounds = cacheFlyweightFactory.calculateBounds(
    OAKES_CLASSROOM.lat,
    OAKES_CLASSROOM.lng,
    i,
    j,
  );
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    let coinCount = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    const popUpDiv = document.createElement("div");
    popUpDiv.innerHTML =
      `<div>Cache at "${i}, ${j}". Coins: <span id="value">${coinCount}</span>.</div><button id="collect">Collect</button>`;
    popUpDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        coinCount -= 1;
        popUpDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = coinCount
          .toString();
        playerCoins += 1;
        statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
      });

    return popUpDiv;
  });
}

function generateCaches(): void {
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      if (cacheFlyweightFactory.shouldSpawnCache(i, j)) {
        spawnCache(i, j);
      }
    }
  }
}

//MAIN FUNCTION CALLS
generateCaches();
